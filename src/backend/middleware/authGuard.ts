import { Request, Response, NextFunction } from 'express';
import { SessionUser } from '../../types/models.js';

export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionUser = (req as any).session?.user || (req as any).mockUser;
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

