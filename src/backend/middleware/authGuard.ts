import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SessionUser } from '../../types/models.js';
import { IGitLabService } from '../services/gitlabService.js';
import { ILdapService } from '../services/ldapService.js';
import { DatabaseManager } from '../db.js';

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

export function createBearerAuthMiddleware(
  gitlabService: IGitLabService,
  ldapService: ILdapService,
  dbManager: DatabaseManager
): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user || (req as any).session?.user || (req as any).mockUser) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    try {
      const gitlabUser = await gitlabService.getUserProfile(token);
      const ldapGroups = await ldapService.getUserGroups(gitlabUser.username);
      const activeTeams = dbManager.findActiveTeamsForUser(ldapGroups);

      const sessionUser: SessionUser = {
        gitlabUser,
        ldapGroups,
        activeTeams,
      };

      req.user = sessionUser;
      if ((req as any).session) {
        (req as any).session.accessToken = token;
      }
    } catch {
      // Let downstream requireAuth or requireOnboardedTeam handle unauthorized response
    }

    next();
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionUser = req.user || (req as any).session?.user || (req as any).mockUser;
  if (!sessionUser) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }
  req.user = sessionUser;
  next();
}

export function requireOnboardedTeam(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionUser = req.user || (req as any).session?.user || (req as any).mockUser;
  if (!sessionUser) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  req.user = sessionUser;

  if (!sessionUser.activeTeams || sessionUser.activeTeams.length === 0) {
    res.status(403).json({
      error: 'Access Denied',
      message: 'Your LDAP group is not onboarded to the platform or your team is inactive. Please contact an administrator.',
      username: sessionUser.gitlabUser?.username,
      ldapGroups: sessionUser.ldapGroups || [],
    });
    return;
  }

  next();
}

