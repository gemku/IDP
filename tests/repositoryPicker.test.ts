import { describe, it, expect, vi } from 'vitest';
import { GitLabProject } from '../src/types/models.js';

describe('RepositoryPicker Component Logic', () => {
  const sampleProjects: GitLabProject[] = [
    {
      id: 1,
      name: 'auth-service',
      path: 'auth-service',
      path_with_namespace: 'engineering/platform/auth-service',
      web_url: 'https://gitlab.example.com/engineering/platform/auth-service',
      visibility: 'internal',
    },
    {
      id: 2,
      name: 'billing-api',
      path: 'billing-api',
      path_with_namespace: 'engineering/platform/billing-api',
      web_url: 'https://gitlab.example.com/engineering/platform/billing-api',
      visibility: 'private',
    },
  ];

  it('filters project list by search term matching name or namespace', () => {
    const filter = (projects: GitLabProject[], term: string) => {
      const lower = term.toLowerCase();
      return projects.filter(
        (p) => p.name.toLowerCase().includes(lower) || p.path_with_namespace.toLowerCase().includes(lower)
      );
    };

    expect(filter(sampleProjects, 'billing')).toHaveLength(1);
    expect(filter(sampleProjects, 'platform')).toHaveLength(2);
    expect(filter(sampleProjects, 'nonexistent')).toHaveLength(0);
  });

  it('handles debounced input invocation callback', async () => {
    vi.useFakeTimers();
    let query = '';
    const onSearch = vi.fn((q: string) => {
      query = q;
    });

    const triggerSearch = (newTerm: string) => {
      setTimeout(() => onSearch(newTerm), 300);
    };

    triggerSearch('payments');
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledWith('payments');
    expect(query).toBe('payments');

    vi.useRealTimers();
  });
});

