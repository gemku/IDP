import { Router, Response } from 'express';
import { IGitLabService } from '../services/gitlabService.js';
import { AuthenticatedRequest, requireOnboardedTeam } from '../middleware/authGuard.js';

function parseNumericId(param: string | string[] | undefined): number | null {
  const str = Array.isArray(param) ? param[0] : param;
  if (!str) return null;
  const num = parseInt(str, 10);
  return Number.isNaN(num) ? null : num;
}

export function createReposRouter(gitlabService: IGitLabService): Router {
  const router = Router();

  // GET /api/repos - Scoped to user's onboarded team
  router.get('/', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    let teamIdParam: number | undefined;

    if (req.query.teamId !== undefined) {
      const parsedId = parseNumericId(req.query.teamId as string | string[]);
      if (parsedId === null) {
        res.status(400).json({ error: 'Invalid team ID: must be a numeric identifier' });
        return;
      }
      teamIdParam = parsedId;
    }

    // Find requested team or default to first active team
    const team = teamIdParam !== undefined
      ? user.activeTeams.find((t) => t.id === teamIdParam)
      : user.activeTeams[0];

    if (!team) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of the requested team, or the team is inactive.',
      });
      return;
    }

    const token = (req as any).session?.accessToken || (req.headers.authorization?.replace(/^Bearer\s+/i, '')) || 'dummy-token';

    try {
      const projects = await gitlabService.getGroupProjects(team.gitlab_group_path, token);

      // Search filter
      const search = (req.query.search as string || '').trim().toLowerCase();
      let filtered = projects;
      if (search) {
        filtered = projects.filter(
          (p) =>
            p.name.toLowerCase().includes(search) ||
            p.path.toLowerCase().includes(search) ||
            p.path_with_namespace.toLowerCase().includes(search)
        );
      }

      // Pagination: safely bounded without NaN
      const rawPage = parseInt((req.query.page as string) || '1', 10);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

      const rawLimit = parseInt((req.query.limit as string) || '10', 10);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 10;

      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        team: {
          id: team.id,
          name: team.name,
          gitlab_group_path: team.gitlab_group_path,
        },
        projects: paginated,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to fetch repositories',
        message: err.message,
      });
    }
  });

  return router;
}

