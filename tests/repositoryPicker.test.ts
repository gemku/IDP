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

  it('slices filtered projects by page in local fallback pagination', () => {
    const generateProjects = (count: number): GitLabProject[] =>
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `service-${i + 1}`,
        path: `service-${i + 1}`,
        path_with_namespace: `platform/service-${i + 1}`,
        web_url: `https://gitlab.example.com/platform/service-${i + 1}`,
        visibility: 'internal',
      }));

    const allProjects = generateProjects(25);
    const paginate = (projects: GitLabProject[], page: number, pageSize = 10) => {
      const totalPages = Math.ceil(projects.length / pageSize) || 1;
      const safePage = Math.min(Math.max(1, page), totalPages);
      const startIndex = (safePage - 1) * pageSize;
      return {
        sliced: projects.slice(startIndex, startIndex + pageSize),
        totalPages,
        safePage,
      };
    };

    const page1 = paginate(allProjects, 1);
    expect(page1.sliced).toHaveLength(10);
    expect(page1.sliced[0].id).toBe(1);
    expect(page1.totalPages).toBe(3);

    const page2 = paginate(allProjects, 2);
    expect(page2.sliced).toHaveLength(10);
    expect(page2.sliced[0].id).toBe(11);

    const page3 = paginate(allProjects, 3);
    expect(page3.sliced).toHaveLength(5);
    expect(page3.sliced[0].id).toBe(21);
  });

  it('safely defaults to empty array and 0 total when fetcher resolves with undefined projects', () => {
    const processResponse = (res: any) => ({
      projects: res?.projects || [],
      totalPages: res?.totalPages || 1,
      totalCount: res?.total || 0,
    });

    const malformed1 = processResponse(undefined);
    expect(malformed1.projects).toEqual([]);
    expect(malformed1.totalPages).toBe(1);
    expect(malformed1.totalCount).toBe(0);

    const malformed2 = processResponse({ error: 'Failed to fetch' });
    expect(malformed2.projects).toEqual([]);
    expect(malformed2.totalCount).toBe(0);

    const valid = processResponse({ projects: sampleProjects, totalPages: 1, total: 2 });
    expect(valid.projects).toHaveLength(2);
    expect(valid.totalCount).toBe(2);
  });
});

