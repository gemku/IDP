import React, { useState, useEffect, useCallback } from 'react';
import { FleetDashboard, FleetStats } from './components/FleetDashboard.js';
import { RepositoryPicker } from './components/RepositoryPicker.js';
import { RepositoryDashboard, PipelineStep } from './components/RepositoryDashboard.js';
import { DarkTerminal } from './components/DarkTerminal.js';
import { GitLabProject, OnboardedTeam } from '../types/models.js';

export interface AppProps {
  initialTeams?: OnboardedTeam[];
  initialUser?: { username: string; name: string; email: string };
}

const DEFAULT_TEAMS: OnboardedTeam[] = [
  {
    id: 1,
    name: 'Platform Core',
    ldap_group_dn: 'cn=platform-core,ou=groups,dc=example,dc=com',
    gitlab_group_path: 'platform/core',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Payment Services',
    ldap_group_dn: 'cn=payments,ou=groups,dc=example,dc=com',
    gitlab_group_path: 'payments/checkout',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Data Engineering',
    ldap_group_dn: 'cn=data-eng,ou=groups,dc=example,dc=com',
    gitlab_group_path: 'data/pipelines',
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_STEAMS_PIPELINE: PipelineStep[] = [
  { id: 'kro', name: 'KRO Resource Graph', status: 'succeeded', latencyMs: 320 },
  { id: 'eventsource', name: 'EventSource Triggering', status: 'succeeded', latencyMs: 140 },
  { id: 'workflow', name: 'Argo Workflow Runner', status: 'running', latencyMs: 1850 },
  { id: 'kpack', name: 'Kpack OCI Image Build', status: 'pending' },
];

export const App: React.FC<AppProps> = ({
  initialTeams = DEFAULT_TEAMS,
  initialUser = { username: 'developer', name: 'Platform Engineer', email: 'dev@company.local' },
}) => {
  const [activeTab, setActiveTab] = useState<'fleet' | 'repos'>('fleet');
  const [teams] = useState<OnboardedTeam[]>(initialTeams);
  const [selectedTeam, setSelectedTeam] = useState<OnboardedTeam>(initialTeams[0]);
  const [selectedProject, setSelectedProject] = useState<GitLabProject | null>(null);
  const [fleetStats, setFleetStats] = useState<FleetStats | undefined>(undefined);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  // Fetch fleet stats
  const fetchFleetTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/fleet/health');
      if (res.ok) {
        const data = await res.json();
        setFleetStats(data);
      } else {
        // Fallback demo telemetry
        setFleetStats({
          fleetHealth: 'healthy',
          totalTeams: teams.length,
          activeBuildsCount: 4,
          successRate24h: 98.4,
          avgBuildDurationSeconds: 142,
          teamsActivity: teams.map((t) => ({
            teamName: t.name,
            buildsToday: 12,
            successful: 11,
            failed: 1,
          })),
        });
      }
    } catch {
      setFleetStats({
        fleetHealth: 'healthy',
        totalTeams: teams.length,
        activeBuildsCount: 3,
        successRate24h: 97.5,
        avgBuildDurationSeconds: 156,
        teamsActivity: teams.map((t) => ({
          teamName: t.name,
          buildsToday: 8,
          successful: 8,
          failed: 0,
        })),
      });
    }
  }, [teams]);

  useEffect(() => {
    fetchFleetTelemetry();
  }, [fetchFleetTelemetry]);

  // Project fetcher for repository picker
  const fetchProjects = useCallback(
    async (teamId: number, search: string, page: number) => {
      try {
        const params = new URLSearchParams({
          teamId: String(teamId),
          page: String(page),
          limit: '6',
        });
        if (search) params.set('search', search);

        const res = await fetch(`/api/repos?${params.toString()}`);
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Fallback for offline or local preview
      }

      const team = teams.find((t) => t.id === teamId) || teams[0];
      const mockProjects: GitLabProject[] = [
        {
          id: teamId * 100 + 1,
          name: `${team.name.toLowerCase().replace(/\s+/g, '-')}-service`,
          path: `${team.name.toLowerCase().replace(/\s+/g, '-')}-service`,
          path_with_namespace: `${team.gitlab_group_path}/${team.name.toLowerCase().replace(/\s+/g, '-')}-service`,
          web_url: `https://gitlab.example.com/${team.gitlab_group_path}/service`,
          visibility: 'internal' as const,
          description: `Primary backend microservice for ${team.name}`,
          default_branch: 'main',
        },
        {
          id: teamId * 100 + 2,
          name: `${team.name.toLowerCase().replace(/\s+/g, '-')}-frontend`,
          path: `${team.name.toLowerCase().replace(/\s+/g, '-')}-frontend`,
          path_with_namespace: `${team.gitlab_group_path}/${team.name.toLowerCase().replace(/\s+/g, '-')}-frontend`,
          web_url: `https://gitlab.example.com/${team.gitlab_group_path}/frontend`,
          visibility: 'public' as const,
          description: `Client web application for ${team.name}`,
          default_branch: 'main',
        },
        {
          id: teamId * 100 + 3,
          name: `${team.name.toLowerCase().replace(/\s+/g, '-')}-infra`,
          path: `${team.name.toLowerCase().replace(/\s+/g, '-')}-infra`,
          path_with_namespace: `${team.gitlab_group_path}/${team.name.toLowerCase().replace(/\s+/g, '-')}-infra`,
          web_url: `https://gitlab.example.com/${team.gitlab_group_path}/infra`,
          visibility: 'private' as const,
          description: `Infrastructure and Helm chart definitions for ${team.name}`,
          default_branch: 'main',
        },
      ].filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.path_with_namespace.toLowerCase().includes(search.toLowerCase())
      );

      return {
        projects: mockProjects,
        total: mockProjects.length,
        totalPages: 1,
      };
    },
    [teams]
  );

  const handleTriggerBuild = async () => {
    if (!selectedProject) return;
    setIsTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await fetch(`/api/repos/${selectedProject.id}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: selectedProject.name,
          gitRef: selectedProject.default_branch || 'main',
        }),
      });
      if (res.ok) {
        setTriggerMessage(`Pipeline trigger submitted successfully for ${selectedProject.name}!`);
      } else {
        const data = await res.json().catch(() => ({}));
        setTriggerMessage(`Trigger response: ${data.message || data.error || 'Trigger dispatched.'}`);
      }
    } catch {
      setTriggerMessage(`Pipeline trigger simulated for ${selectedProject.name} (v1.0.0-rc)`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
                IDP
              </div>
              <span className="font-semibold text-lg tracking-tight text-white">
                Developer Platform
              </span>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden sm:flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('fleet');
                  setSelectedProject(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'fleet'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                Fleet Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('repos')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === 'repos'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                Team Repositories
              </button>
            </nav>
          </div>

          {/* User Profile & Team Switcher */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="team-select" className="text-xs text-slate-400 font-medium hidden md:inline">
                Team:
              </label>
              <select
                id="team-select"
                aria-label="Select Team"
                value={selectedTeam.id}
                onChange={(e) => {
                  const team = teams.find((t) => t.id === Number(e.target.value));
                  if (team) {
                    setSelectedTeam(team);
                    setSelectedProject(null);
                  }
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-4">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-medium text-indigo-400">
                {initialUser.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-xs font-medium text-slate-200">{initialUser.name}</div>
                <div className="text-[10px] text-slate-500">{selectedTeam.gitlab_group_path}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeTab === 'fleet' && (
          <div className="flex flex-col items-center space-y-6">
            <FleetDashboard stats={fleetStats} />
            <div className="w-full max-w-6xl flex justify-end">
              <button
                type="button"
                onClick={fetchFleetTelemetry}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
              >
                Refresh Telemetry
              </button>
            </div>
          </div>
        )}

        {activeTab === 'repos' && !selectedProject && (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-full max-w-4xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Repository Catalog</h2>
                <p className="text-sm text-slate-400">
                  Select a repository in <span className="text-indigo-400 font-medium">{selectedTeam.name}</span> to view pipeline telemetry and build logs.
                </p>
              </div>
            </div>

            <RepositoryPicker
              teamId={selectedTeam.id}
              fetchProjects={fetchProjects}
              onSelectProject={(project) => setSelectedProject(project)}
            />
          </div>
        )}

        {activeTab === 'repos' && selectedProject && (
          <div className="flex flex-col items-center space-y-6">
            {/* Breadcrumb & Action bar */}
            <div className="w-full max-w-5xl flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition"
              >
                ← Back to {selectedTeam.name} Repositories
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isTriggering}
                  onClick={handleTriggerBuild}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {isTriggering ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Triggering...
                    </>
                  ) : (
                    <>▶ Run Pipeline</>
                  )}
                </button>
              </div>
            </div>

            {triggerMessage && (
              <div className="w-full max-w-5xl px-4 py-3 bg-indigo-950/40 border border-indigo-800 text-indigo-300 text-xs rounded-xl">
                {triggerMessage}
              </div>
            )}

            {/* Repository Pipeline Dashboard */}
            <RepositoryDashboard
              repoName={selectedProject.name}
              currentTag="v1.0.0"
              steps={DEFAULT_STEAMS_PIPELINE}
              metrics={{
                podName: `${selectedProject.name}-build-worker-0`,
                namespace: 'default',
                cpuUsedCores: 0.28,
                cpuLimitCores: 1.0,
                cpuPercent: 28,
                memoryUsedBytes: 432013312,
                memoryLimitBytes: 1073741824,
                memoryPercent: 40.2,
                timestamp: new Date().toISOString(),
              }}
            />

            {/* Live Terminal Log Stream */}
            <DarkTerminal
              repoName={selectedProject.name}
              streamUrl={`/api/repos/${selectedProject.name}/stream`}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-600">
        Internal Developer Platform • OpenSpec Driven • Kubernetes Orchestrated
      </footer>
    </div>
  );
};
