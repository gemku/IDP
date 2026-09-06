import React from 'react';
import { PodResourceUsage } from '../../backend/services/metricsService.js';

export interface PipelineStep {
  id: 'kro' | 'eventsource' | 'workflow' | 'kpack';
  name: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  latencyMs?: number;
}

export interface RepositoryDashboardProps {
  repoName: string;
  currentTag: string;
  steps: PipelineStep[];
  metrics?: PodResourceUsage;
}

export const RepositoryDashboard: React.FC<RepositoryDashboardProps> = ({
  repoName,
  currentTag,
  steps,
  metrics,
}) => {
  const getStepStatusBadge = (status: PipelineStep['status']) => {
    switch (status) {
      case 'succeeded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
            ✓ Succeeded
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
            Running
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
            ✗ Failed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6 bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-2xl">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{repoName}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
              {currentTag}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">4-Step Cloud-Native Pipeline & Build Status</p>
        </div>
      </div>

      {/* 4-Step Pipeline Visualizer */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Pipeline Milestones (KRO → EventSource → Workflow → Kpack)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(steps || []).map((step, idx) => (
            <div
              key={step.id}
              className={`p-4 rounded-xl border transition-all ${
                step.status === 'running'
                  ? 'bg-indigo-950/30 border-indigo-500/80 ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-500">Step 0{idx + 1}</span>
                {getStepStatusBadge(step.status)}
              </div>
              <h4 className="text-sm font-semibold text-slate-200 truncate">{step.name}</h4>
              {step.latencyMs !== undefined && (
                <span className="text-xs text-slate-500 mt-2 block font-mono">
                  Duration: {step.latencyMs > 1000 ? `${(step.latencyMs / 1000).toFixed(1)}s` : `${step.latencyMs}ms`}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Resource Utilization Gauges */}
      {metrics && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Build Pod Resource Utilization (metrics.k8s.io)
            </h3>
            <span className="text-xs font-mono text-slate-500">Pod: {metrics.podName}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">CPU Utilization</span>
                <span className="text-indigo-400 font-mono font-bold">
                  {metrics.cpuUsedCores} / {metrics.cpuLimitCores} Cores ({metrics.cpuPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.cpuPercent > 85
                      ? 'bg-rose-500'
                      : metrics.cpuPercent > 65
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${metrics.cpuPercent}%` }}
                />
              </div>
            </div>

            {/* Memory Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Memory Utilization (cgroup limit)</span>
                <span className="text-cyan-400 font-mono font-bold">
                  {(metrics.memoryUsedBytes / (1024 * 1024)).toFixed(0)}MB /{' '}
                  {(metrics.memoryLimitBytes / (1024 * 1024)).toFixed(0)}MB ({metrics.memoryPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    metrics.memoryPercent > 85
                      ? 'bg-rose-500'
                      : metrics.memoryPercent > 65
                      ? 'bg-amber-500'
                      : 'bg-cyan-500'
                  }`}
                  style={{ width: `${metrics.memoryPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

