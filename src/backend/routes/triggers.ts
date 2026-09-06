import { Router, Response } from 'express';
import { KroService } from '../services/kroService.js';
import { IGitLabService } from '../services/gitlabService.js';
import { AuthenticatedRequest, requireOnboardedTeam } from '../middleware/authGuard.js';

function parseNumericId(param: string | string[] | undefined): number | null {
  const str = Array.isArray(param) ? param[0] : param;
  if (!str) return null;
  const num = parseInt(str, 10);
  return Number.isNaN(num) ? null : num;
}

export function sanitizeTriggerName(repoName: string): string {
  const clean = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `${clean || 'app'}-trigger`;
}

export function createTriggersRouter(kroService: KroService, gitlabService: IGitLabService): Router {
  const router = Router();

  // POST /api/repos/:projectId/trigger
  router.post('/:projectId/trigger', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseNumericId(req.params.projectId);
    if (projectId === null) {
      res.status(400).json({ error: 'Invalid project ID: must be a numeric identifier' });
      return;
    }
    const { repoUrl, repoName, targetNamespace, tagPattern } = req.body || {};

    if (!repoUrl || !repoName) {
      res.status(400).json({ error: 'Missing required fields: repoUrl, repoName' });
      return;
    }

    const namespace = targetNamespace || 'default';
    const triggerName = sanitizeTriggerName(repoName);
    const token = (req as any).session?.accessToken || (req.headers.authorization?.replace('Bearer ', ''));

    try {
      // 1. Create KRO GitLabTagTrigger custom resource
      const trigger = await kroService.createTagTrigger(namespace, {
        name: triggerName,
        repoUrl,
        projectId,
        targetNamespace: namespace,
        tagPattern: tagPattern || 'refs/tags/*',
      });

      const webhookUrl = `http://gitlab-eventsource-svc.${namespace}.svc.cluster.local:12000/webhook`;
      const secretToken = trigger.spec.secretToken;

      // 2. Automatically register webhook in GitLab CE
      const webhook = await gitlabService.registerProjectWebhook(
        projectId,
        webhookUrl,
        secretToken,
        token
      );

      res.status(201).json({
        success: true,
        trigger,
        webhook,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to provision KRO trigger or register webhook',
        message: err.message,
      });
    }
  });

  // GET /api/repos/:projectId/trigger
  router.get('/:projectId/trigger', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseNumericId(req.params.projectId);
    if (projectId === null) {
      res.status(400).json({ error: 'Invalid project ID: must be a numeric identifier' });
      return;
    }
    const repoName = (req.query.repoName as string) || '';
    const namespace = (req.query.namespace as string) || 'default';
    const triggerName = sanitizeTriggerName(repoName);

    try {
      const trigger = await kroService.getTagTrigger(namespace, triggerName);
      res.json({ trigger });
    } catch (err: any) {
      res.status(404).json({ error: 'Trigger not found', message: err.message });
    }
  });

  // DELETE /api/repos/:projectId/trigger
  router.delete('/:projectId/trigger', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseNumericId(req.params.projectId);
    if (projectId === null) {
      res.status(400).json({ error: 'Invalid project ID: must be a numeric identifier' });
      return;
    }
    const repoName = (req.query.repoName as string) || '';
    const namespace = (req.query.namespace as string) || 'default';
    const triggerName = sanitizeTriggerName(repoName);

    try {
      await kroService.deleteTagTrigger(namespace, triggerName);
      res.json({ success: true, message: `Trigger ${triggerName} deleted` });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete trigger', message: err.message });
    }
  });

  return router;
}

