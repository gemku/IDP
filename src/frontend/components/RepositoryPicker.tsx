import React, { useState, useEffect } from 'react';
import { GitLabProject } from '../../types/models.js';

export interface RepositoryPickerProps {
  teamId?: number;
  initialProjects?: GitLabProject[];
  fetchProjects?: (teamId: number, search: string, page: number) => Promise<{
    projects: GitLabProject[];
    total: number;
    totalPages: number;
  }>;
  onSelectProject: (project: GitLabProject) => void;
  selectedProjectId?: number;
}

export const RepositoryPicker: React.FC<RepositoryPickerProps> = ({
  teamId,
  initialProjects = [],
  fetchProjects,
  onSelectProject,
  selectedProjectId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projects, setProjects] = useState<GitLabProject[]>(initialProjects);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(initialProjects.length);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch projects when debounced search or page or teamId changes
  useEffect(() => {
    let isMounted = true;
    if (fetchProjects && teamId !== undefined) {
      setIsLoading(true);
      fetchProjects(teamId, debouncedSearch, currentPage)
        .then((res) => {
          if (isMounted) {
            setProjects(res.projects);
            setTotalPages(res.totalPages || 1);
            setTotalCount(res.total);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    } else if (!fetchProjects && initialProjects.length > 0) {
      // Local filtering fallback
      const filtered = initialProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.path_with_namespace.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
      setProjects(filtered);
      setTotalCount(filtered.length);
      setTotalPages(Math.ceil(filtered.length / 10) || 1);
    }

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, currentPage, teamId, fetchProjects, initialProjects]);

  const getVisibilityBadge = (visibility: GitLabProject['visibility']) => {
    switch (visibility) {
      case 'public':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
            Public
          </span>
        );
      case 'internal':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/60 text-amber-300 border border-amber-700/50">
            Internal
          </span>
        );
      case 'private':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-900/60 text-purple-300 border border-purple-700/50">
            Private
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-4xl bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-xl p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Select Team Repository</h2>
          <p className="text-sm text-slate-400 mt-1">
            Scoped to your onboarded team GitLab group. Showing {totalCount} repositories.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <div className="relative">
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            {isLoading && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project list */}
      <div className="space-y-2.5">
        {projects.length === 0 && !isLoading ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
            <p className="text-slate-400 text-sm">No repositories found matching your query.</p>
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-800/40 border-slate-800/80 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-4">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-slate-100 truncate">{project.name}</span>
                    {getVisibilityBadge(project.visibility)}
                  </div>
                  <span className="text-xs text-slate-400 font-mono mt-1 truncate">
                    {project.path_with_namespace}
                  </span>
                  {project.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{project.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500 font-mono hidden md:inline">
                    {project.default_branch || 'main'}
                  </span>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-slate-300 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

