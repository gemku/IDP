export interface PodResourceUsage {
  podName: string;
  namespace: string;
  cpuUsedCores: number;
  cpuLimitCores: number;
  cpuPercent: number;
  memoryUsedBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  timestamp: string;
}

export function parseCpuQuantity(cpu: string | number | undefined | null): number {
  if (cpu === undefined || cpu === null || cpu === '') return 0;
  if (typeof cpu === 'number') {
    return Number.isFinite(cpu) ? cpu : 0;
  }
  const str = String(cpu).trim();
  if (!str) return 0;
  if (str.endsWith('m')) {
    const val = parseFloat(str.slice(0, -1)) / 1000;
    return Number.isFinite(val) ? val : 0;
  }
  if (str.endsWith('u')) {
    const val = parseFloat(str.slice(0, -1)) / 1000000;
    return Number.isFinite(val) ? val : 0;
  }
  if (str.endsWith('n')) {
    const val = parseFloat(str.slice(0, -1)) / 1000000000;
    return Number.isFinite(val) ? val : 0;
  }
  const val = parseFloat(str);
  return Number.isFinite(val) ? val : 0;
}

export function parseMemoryQuantity(mem: string | number | undefined | null): number {
  if (mem === undefined || mem === null || mem === '') return 0;
  if (typeof mem === 'number') {
    return Number.isFinite(mem) ? mem : 0;
  }
  const str = String(mem).trim();
  if (!str) return 0;

  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 * 1024,
    Gi: 1024 * 1024 * 1024,
    Ti: 1024 * 1024 * 1024 * 1024,
    Pi: 1024 * 1024 * 1024 * 1024 * 1024,
    k: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
    T: 1000 * 1000 * 1000 * 1000,
    P: 1000 * 1000 * 1000 * 1000 * 1000,
  };

  for (const [unit, multiplier] of Object.entries(units)) {
    if (str.endsWith(unit)) {
      const num = parseFloat(str.slice(0, -unit.length));
      return Number.isFinite(num) ? num * multiplier : 0;
    }
  }

  const val = parseFloat(str);
  return Number.isFinite(val) ? val : 0;
}

export interface IMetricsClient {
  getPodMetrics(namespace: string, podName: string): Promise<any>;
  getPodLimits(namespace: string, podName: string): Promise<{ cpuLimit: string; memLimit: string }>;
}

export class MetricsService {
  constructor(private client: IMetricsClient) {}

  public async getBuildResourceUsage(namespace: string, podName: string): Promise<PodResourceUsage> {
    const [rawMetrics, limits] = await Promise.all([
      this.client.getPodMetrics(namespace, podName),
      this.client.getPodLimits(namespace, podName),
    ]);

    let totalCpuUsed = 0;
    let totalMemUsed = 0;

    if (rawMetrics && rawMetrics.containers) {
      for (const c of rawMetrics.containers) {
        totalCpuUsed += parseCpuQuantity(c.usage?.cpu || '0');
        totalMemUsed += parseMemoryQuantity(c.usage?.memory || '0');
      }
    }

    const cpuLimitCores = Math.max(0.1, parseCpuQuantity(limits.cpuLimit || '2'));
    const memoryLimitBytes = Math.max(1024 * 1024, parseMemoryQuantity(limits.memLimit || '4Gi'));

    const cpuPercent = Math.min(100, Math.round((totalCpuUsed / cpuLimitCores) * 100));
    const memoryPercent = Math.min(100, Math.round((totalMemUsed / memoryLimitBytes) * 100));

    return {
      podName,
      namespace,
      cpuUsedCores: Math.round(totalCpuUsed * 1000) / 1000,
      cpuLimitCores,
      cpuPercent,
      memoryUsedBytes: Math.round(totalMemUsed),
      memoryLimitBytes,
      memoryPercent,
      timestamp: new Date().toISOString(),
    };
  }
}

