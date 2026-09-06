import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../db.js';
import { IGitLabService } from '../services/gitlabService.js';
import { CreateTeamDTO, UpdateTeamDTO } from '../../types/models.js';

function parseNumericId(param: string | string[] | undefined): number | null {
  const str = Array.isArray(param) ? param[0] : param;
  if (!str) return null;
  const num = parseInt(str, 10);
  return Number.isNaN(num) ? null : num;
}

export function createAdminRouter(
  dbManager: DatabaseManager,
  gitlabService: IGitLabService
): Router {
  const router = Router();

  // GET /api/admin/teams
  router.get('/teams', (req: Request, res: Response) => {
    const onlyActive = req.query.active === 'true';
    const teams = dbManager.listTeams(onlyActive);
    res.json({ teams });
  });

  // GET /api/admin/teams/:id
  router.get('/teams/:id', (req: Request, res: Response) => {
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid ID: must be a numeric identifier' });
      return;
    }
    const team = dbManager.getTeamById(id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    res.json({ team });
  });

  // POST /api/admin/teams
  router.post('/teams', async (req: Request, res: Response) => {
    const { name, ldap_group_dn, gitlab_group_path, is_active } = req.body;

    if (!name || !ldap_group_dn || !gitlab_group_path) {
      res.status(400).json({ error: 'Missing required fields: name, ldap_group_dn, gitlab_group_path' });
      return;
    }

    // Validate GitLab group path via GitLab API
    try {
      await gitlabService.validateGroupPath(gitlab_group_path);
    } catch (err: any) {
      res.status(422).json({
        error: 'GitLab Group Validation Failed',
        message: `Group path "${gitlab_group_path}" does not exist in GitLab or is inaccessible: ${err.message}`,
      });
      return;
    }

    try {
      const created = dbManager.createTeam({
        name,
        ldap_group_dn,
        gitlab_group_path,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      });
      res.status(201).json({ team: created });
    } catch (err: any) {
      res.status(409).json({ error: 'Failed to create team (likely duplicate name or LDAP DN)', details: err.message });
    }
  });

  // PUT /api/admin/teams/:id
  router.put('/teams/:id', async (req: Request, res: Response) => {
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid ID: must be a numeric identifier' });
      return;
    }
    const existing = dbManager.getTeamById(id);
    if (!existing) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const { name, ldap_group_dn, gitlab_group_path, is_active } = req.body;

    // If gitlab_group_path is updated, re-validate
    if (gitlab_group_path && gitlab_group_path !== existing.gitlab_group_path) {
      try {
        await gitlabService.validateGroupPath(gitlab_group_path);
      } catch (err: any) {
        res.status(422).json({
          error: 'GitLab Group Validation Failed',
          message: `Group path "${gitlab_group_path}" could not be verified in GitLab: ${err.message}`,
        });
        return;
      }
    }

    const updated = dbManager.updateTeam(id, {
      name,
      ldap_group_dn,
      gitlab_group_path,
      is_active: is_active !== undefined ? Boolean(is_active) : undefined,
    });

    res.json({ team: updated });
  });

  // PATCH /api/admin/teams/:id/toggle
  router.patch('/teams/:id/toggle', (req: Request, res: Response) => {
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid ID: must be a numeric identifier' });
      return;
    }
    const existing = dbManager.getTeamById(id);
    if (!existing) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    const newStatus = existing.is_active === 1 ? false : true;
    const updated = dbManager.updateTeam(id, { is_active: newStatus });
    res.json({ team: updated });
  });

  // DELETE /api/admin/teams/:id
  router.delete('/teams/:id', (req: Request, res: Response) => {
    const id = parseNumericId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: 'Invalid ID: must be a numeric identifier' });
      return;
    }
    const success = dbManager.deleteTeam(id);
    if (!success) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    res.json({ success: true, message: `Team ${id} deleted` });
  });

  return router;
}

