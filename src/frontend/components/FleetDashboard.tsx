import React from 'react';

export interface FleetStats {
  fleetHealth: 'healthy' | 'degraded' | 'unhealthy';
  totalTeams: number;
  activeBuildsCount: number;
  successRate24h: number;
  avgBuildDurationSeconds: number;
  teamsActivity: Array<{
    teamName: string;
    buildsToday: number;
    successful: number;
    failed: number;
  }>;
}

export const FleetDashboard: React.FC<{ stats: FleetStats }> = ({ stats }) => {
  return (
    <div className="w-full max-w-6xl space-y-6 bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Fleet Build Health & Activity</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time pipeline orchestration and build metrics across all onboarded engineering teams.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              stats.fleetHealth === 'healthy'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50'
                : 'bg-amber-950/80 text-amber-400 border border-amber-700/50'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
            Fleet: {stats.fleetHealth}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Builds</span>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{stats.activeBuildsCount}</p>
          <span className="text-xs text-slate-500 mt-1 block">Executing across worker nodes</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">24h Success Rate</span>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{stats.successRate24h}%</p>
          <span className="text-xs text-slate-500 mt-1 block">Across all tagged releases</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Build Duration</span>
          <p className="text-3xl font-extrabold text-cyan-400 mt-2">{stats.avgBuildDurationSeconds}s</p>
          <span className="text-xs text-slate-500 mt-1 block">From tag push to image publish</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Teams</span>
          <p className="text-3xl font-extrabold text-amber-400 mt-2">{stats.totalTeams}</p>
          <span className="text-xs text-slate-500 mt-1 block">Onboarded via LDAP groups</span>
        </div>
      </div>

      {/* Team Activity Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Team Activity Breakdown</h3>
        </div>
        <div className="divide-y divide-slate-800/60">
          {(stats.teamsActivity || []).map((team, idx) => (
            <div key={idx} className="px-5 py-3 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">{team.teamName}</span>
              <div className="flex items-center gap-6">
                <span className="text-xs text-slate-400">Total: {team.buildsToday}</span>
                <span className="text-xs text-emerald-400 font-semibold">{team.successful} passed</span>
                {team.failed > 0 && (
                  <span className="text-xs text-rose-400 font-semibold">{team.failed} failed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

