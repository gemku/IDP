import { describe, it, expect, vi } from 'vitest';
import {
  PostgresDatabaseManager,
  SqliteDatabaseManager,
  DatabaseManager,
  createDatabaseManager,
} from '../src/backend/db.js';

describe('PostgresDatabaseManager & Provider Switching', () => {
  function createMockPool() {
    const executedQueries: Array<{ text: string; values?: any[] }> = [];
    const mockRows: any[] = [];

    const mockPool = {
      executedQueries,
      mockRows,
      query: vi.fn(async (text: string, values?: any[]) => {
        executedQueries.push({ text, values });
        return {
          rows: mockRows,
          rowCount: mockRows.length,
        };
      }),
      end: vi.fn(async () => {}),
    };

    return mockPool;
  }

  it('runs schema migration creating onboarded_teams table and case-insensitive lower index', async () => {
    const mockPool = createMockPool();
    const pgManager = new PostgresDatabaseManager(mockPool as any);

    await pgManager.initialize();

    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const sql = mockPool.executedQueries[0].text;
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS onboarded_teams');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_onboarded_teams_ldap ON onboarded_teams (LOWER(ldap_group_dn))');
  });

  it('executes parameterized INSERT on createTeam with RETURNING clause', async () => {
    const mockPool = createMockPool();
    const now = new Date().toISOString();
    mockPool.mockRows.push({
      id: 42,
      name: 'Cloud Infrastructure',
      ldap_group_dn: 'cn=cloud-infra,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'infra/cloud',
      is_active: 1,
      created_at: now,
      updated_at: now,
    });

    const pgManager = new PostgresDatabaseManager(mockPool as any);
    const team = await pgManager.createTeam({
      name: 'Cloud Infrastructure',
      ldap_group_dn: 'cn=cloud-infra,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'infra/cloud',
      is_active: true,
    });

    expect(team.id).toBe(42);
    expect(team.name).toBe('Cloud Infrastructure');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO onboarded_teams'),
      ['Cloud Infrastructure', 'cn=cloud-infra,ou=groups,dc=example,dc=com', 'infra/cloud', 1]
    );
  });

  it('queries team by LDAP DN using LOWER() for case-insensitive matching', async () => {
    const mockPool = createMockPool();
    mockPool.mockRows.push({
      id: 10,
      name: 'Backend Services',
      ldap_group_dn: 'cn=backend,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'core/backend',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const pgManager = new PostgresDatabaseManager(mockPool as any);
    const result = await pgManager.getTeamByLdapDn('CN=BACKEND,OU=GROUPS,DC=EXAMPLE,DC=COM');

    expect(result).toBeDefined();
    expect(result?.id).toBe(10);
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(ldap_group_dn) = LOWER($1)'),
      ['CN=BACKEND,OU=GROUPS,DC=EXAMPLE,DC=COM']
    );
  });

  it('finds active teams for user with deduplicated, lowercased placeholders', async () => {
    const mockPool = createMockPool();
    mockPool.mockRows.push({
      id: 5,
      name: 'Core Platform',
      ldap_group_dn: 'cn=core-platform,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'platform/core',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const pgManager = new PostgresDatabaseManager(mockPool as any);
    const active = await pgManager.findActiveTeamsForUser([
      'CN=Core-Platform,OU=groups,DC=example,DC=com',
      'cn=core-platform,ou=groups,dc=example,dc=com', // duplicate
      'cn=other-group,ou=groups,dc=example,dc=com',
    ]);

    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Core Platform');
    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(ldap_group_dn) IN ($1,$2)'),
      [
        'cn=core-platform,ou=groups,dc=example,dc=com',
        'cn=other-group,ou=groups,dc=example,dc=com',
      ]
    );
  });

  it('propagates connection pool errors cleanly without unhandled crashes', async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error('connection timeout: could not connect to postgres:5432')),
      end: vi.fn().mockResolvedValue(undefined),
    };

    const pgManager = new PostgresDatabaseManager(mockPool as any);
    await expect(pgManager.listTeams()).rejects.toThrow('connection timeout');
  });

  it('switches between SqliteDatabaseManager and PostgresDatabaseManager based on config', () => {
    // 1. Default config uses SQLite
    const sqliteManager = new DatabaseManager(':memory:');
    expect(sqliteManager.getProvider()).toBeInstanceOf(SqliteDatabaseManager);

    // 2. Explicit client: postgres
    const mockPgPool = createMockPool();
    const pgDbManager = new DatabaseManager({
      client: 'postgres',
      postgres: mockPgPool as any,
    });
    expect(pgDbManager.getProvider()).toBeInstanceOf(PostgresDatabaseManager);

    // 3. PostgreSQL connection string detection
    const connStrManager = createDatabaseManager('postgresql://user:secret@pg.cluster.local:5432/platform');
    expect((connStrManager as DatabaseManager).getProvider()).toBeInstanceOf(PostgresDatabaseManager);
  });
});
