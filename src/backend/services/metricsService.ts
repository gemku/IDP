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

export function parseCpuQuantity(cpu: string): number {
  if (!cpu) return 0;
  if (cpu.endsWith('m')) {
    return parseFloat(cpu.slice(0, -1)) / 1000;
  }
  if (cpu.endsWith('u')) {
    return parseFloat(cpu.slice(0, -1)) / 1000000;
  }
  if (cpu.endsWith('n')) {
    return parseFloat(cpu.slice(0, -1)) / 1000000000;
  }
  return parseFloat(cpu);
}

export function parseMemoryQuantity(mem: string): number {
  if (!mem) return 0;
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 * 1024,
    Gi: 1024 * 1024 * 1024,
    Ti: 1024 * 1024 * 1024 * 1024,
    k: 1000,
    M: 1000 * 1000,
    G: 1000 * 1000 * 1000,
  };

  for (const [unit, multiplier] of Object.entries(units)) {
    if (mem.endsWith(unit)) {
      const num = parseFloat(mem.slice(0, -unit.length));
      return num * multiplier;
    }
  }

  return parseFloat(mem);
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

