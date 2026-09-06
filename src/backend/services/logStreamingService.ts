import { Response } from 'express';
import { EventEmitter } from 'node:events';

export interface ILogSource {
  streamInitContainerLogs(
    namespace: string,
    podName: string,
    containerName: string,
    onLine: (line: string) => void
  ): Promise<void>;
  getBuildPodForRepo(namespace: string, repoName: string): Promise<string | null>;
}

export class MockLogSource implements ILogSource {
  public mockLines: Record<string, string[]> = {
    detect: [
      '===> DETECTING',
      'paketo-buildpacks/nodejs 0.32.0',
      'paketo-buildpacks/npm-install 0.28.1',
      '3 of 6 buildpacks participating',
    ],
    build: [
      '===> BUILDING',
      'Installing dependencies using npm...',
      'added 230 packages in 3.4s',
      'Building application bundle...',
      'Build succeeded without errors.',
    ],
    export: [
      '===> EXPORTING',
      'Reusing layer sha256:4b22770...',
      'Adding layer sha256:9c88210...',
      '*** Images (sha256:d123456789abcdef...):',
      '      registry.company.local/apps/payment-service:v1.2.0',
      'Successfully published image digest.',
    ],
  };

  public async getBuildPodForRepo(namespace: string, repoName: string): Promise<string | null> {
    return `${repoName}-build-1-pod`;
  }

  public async streamInitContainerLogs(
    namespace: string,
    podName: string,
    containerName: string,
    onLine: (line: string) => void
  ): Promise<void> {
    const lines = this.mockLines[containerName] || [`[${containerName}] Starting phase...`, `[${containerName}] Done.`];
    for (const line of lines) {
      onLine(line);
    }
  }
}

export class LogStreamingService {
  private phases = ['detect', 'build', 'export'];

  constructor(private logSource: ILogSource) {}

  public async streamKpackLogs(
    namespace: string,
    repoName: string,
    res: Response,
    delayMs = 10
  ): Promise<void> {
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const podName = await this.logSource.getBuildPodForRepo(namespace, repoName);
    if (!podName) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: `No active build pod found for ${repoName}` })}\n\n`);
      res.end();
      return;
    }

    let isAborted = false;
    const onClose = () => {
      isAborted = true;
    };
    res.on('close', onClose);

    res.write(`event: start\ndata: ${JSON.stringify({ podName, repoName, namespace })}\n\n`);

    try {
      for (const phase of this.phases) {
        if (isAborted) break;
        res.write(`event: phase\ndata: ${JSON.stringify({ phase })}\n\n`);

        await this.logSource.streamInitContainerLogs(namespace, podName, phase, (line) => {
          if (!isAborted) {
            res.write(`data: ${JSON.stringify({ phase, line, timestamp: new Date().toISOString() })}\n\n`);
          }
        });

        if (isAborted) break;

        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      if (!isAborted) {
        res.write(`event: complete\ndata: ${JSON.stringify({ status: 'succeeded', completedAt: new Date().toISOString() })}\n\n`);
      }
    } catch (err: any) {
      if (!isAborted) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    } finally {
      res.removeListener('close', onClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  }
}

