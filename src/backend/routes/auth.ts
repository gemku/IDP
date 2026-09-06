import { Router, Request, Response } from 'express';
import { IGitLabService } from '../services/gitlabService.js';
import { ILdapService } from '../services/ldapService.js';
import { DatabaseManager } from '../db.js';
import { SessionUser } from '../../types/models.js';

export function createAuthRouter(
  gitlabService: IGitLabService,
  ldapService: ILdapService,
  dbManager: DatabaseManager
): Router {
  const router = Router();

  // GET /api/auth/gitlab/login
  router.get('/gitlab/login', (req: Request, res: Response) => {
    const authUrl = gitlabService.getAuthorizationUrl();
    if (req.query.format === 'json') {
      res.json({ url: authUrl });
    } else {
      res.redirect(authUrl);
    }
  });

  // GET or POST /api/auth/gitlab/callback
  router.all('/gitlab/callback', async (req: Request, res: Response) => {
    const code = (req.query.code || req.body.code) as string;
    if (!code) {
      res.status(400).json({ error: 'Missing OAuth authorization code' });
      return;
    }

    try {
      // 1. Exchange code for access token
      const tokenData = await gitlabService.exchangeCodeForToken(code);
      const accessToken = tokenData.access_token;

      // 2. Retrieve GitLab user profile
      const gitlabUser = await gitlabService.getUserProfile(accessToken);

      // 3. Query LDAP memberOf groups directly using ldapjs
      const ldapGroups = await ldapService.getUserGroups(gitlabUser.username);

      // 4. Match against onboarded_teams in database
      const activeTeams = dbManager.findActiveTeamsForUser(ldapGroups);

      const sessionUser: SessionUser = {
        gitlabUser,
        ldapGroups,
        activeTeams,
      };

      // Store in session if present
      if ((req as any).session) {
        (req as any).session.user = sessionUser;
        (req as any).session.accessToken = accessToken;
      }

      // Check if user is onboarded
      if (activeTeams.length === 0) {
        res.status(403).json({
          error: 'Access Denied',
          message: 'Authenticated via GitLab CE, but your LDAP groups are not onboarded or your team is inactive.',
          user: sessionUser,
        });
        return;
      }

      res.json({
        success: true,
        user: sessionUser,
        accessToken,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Authentication failed',
        message: err.message || 'Internal server error during OAuth exchange',
      });
    }
  });

  // GET /api/auth/me
  router.get('/me', (req: Request, res: Response) => {
    const sessionUser = (req as any).session?.user || (req as any).mockUser;
    if (!sessionUser) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    res.json({ user: sessionUser });
  });

  // POST /api/auth/logout
  router.post('/logout', (req: Request, res: Response) => {
    if ((req as any).session) {
      (req as any).session.destroy(() => {
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  return router;
}

