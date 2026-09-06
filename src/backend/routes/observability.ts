import { Router, Response } from 'express';
import { LogStreamingService } from '../services/logStreamingService.js';
import { MetricsService } from '../services/metricsService.js';
import { AuthenticatedRequest, requireOnboardedTeam } from '../middleware/authGuard.js';

export function createFleetRouter(): Router {
  const router = Router();

  // GET /api/fleet/health - Aggregated Fleet Health
  router.get('/health', requireOnboardedTeam, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      timestamp: new Date().toISOString(),
      fleetHealth: 'healthy',
      totalTeams: req.user?.activeTeams.length || 1,
      activeBuildsCount: 2,
      successRate24h: 98.4,
      avgBuildDurationSeconds: 74,
      teamsActivity: [
        { teamName: 'Platform Engineering', buildsToday: 14, successful: 14, failed: 0 },
        { teamName: 'Core Backend', buildsToday: 9, successful: 8, failed: 1 },
      ],
    });
  });

  return router;
}

export function createObservabilityRouter(
  logService: LogStreamingService,
  metricsService: MetricsService
): Router {
  const router = Router();

  // GET /api/repos/:repoName/logs (SSE Stream)
  router.get('/:repoName/logs', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const rawRepoName = Array.isArray(req.params.repoName) ? req.params.repoName[0] : req.params.repoName;
    const repoName = typeof rawRepoName === 'string' ? rawRepoName.trim() : '';
    if (!repoName) {
      res.status(400).json({ error: 'Missing or invalid repository name' });
      return;
    }
    const namespace = (req.query.namespace as string) || 'default';

    await logService.streamKpackLogs(namespace, repoName, res, 5);
  });

  // GET /api/repos/:repoName/metrics
  router.get('/:repoName/metrics', requireOnboardedTeam, async (req: AuthenticatedRequest, res: Response) => {
    const rawRepoName = Array.isArray(req.params.repoName) ? req.params.repoName[0] : req.params.repoName;
    const repoName = typeof rawRepoName === 'string' ? rawRepoName.trim() : '';
    if (!repoName) {
      res.status(400).json({ error: 'Missing or invalid repository name' });
      return;
    }
    const namespace = (req.query.namespace as string) || 'default';
    const podName = (req.query.podName as string) || `${repoName}-build-1-pod`;

    try {
      const usage = await metricsService.getBuildResourceUsage(namespace, podName);
      res.json(usage);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve pod metrics', message: err.message });
    }
  });

  // GET /api/repos/:repoName/pipeline-status
  router.get('/:repoName/pipeline-status', requireOnboardedTeam, (req: AuthenticatedRequest, res: Response) => {
    const rawRepoName = Array.isArray(req.params.repoName) ? req.params.repoName[0] : req.params.repoName;
    const repoName = typeof rawRepoName === 'string' ? rawRepoName.trim() : '';
    if (!repoName) {
      res.status(400).json({ error: 'Missing or invalid repository name' });
      return;
    }
    res.json({
      repoName,
      steps: [
        { id: 'kro', name: 'KRO Trigger Provisioner', status: 'succeeded', latencyMs: 120 },
        { id: 'eventsource', name: 'Argo Events Gateway', status: 'succeeded', latencyMs: 45 },
        { id: 'workflow', name: 'Argo Workflow Runner', status: 'succeeded', latencyMs: 8200 },
        { id: 'kpack', name: 'Kpack Image Builder', status: 'running', latencyMs: 45000 },
      ],
      currentStep: 'kpack',
      overallStatus: 'running',
    });
  });

  return router;
}

