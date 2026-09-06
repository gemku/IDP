import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
import { OnboardedTeam, CreateTeamDTO, UpdateTeamDTO } from '../types/models.js';
import { DatabaseConfig } from './config.js';

export interface IDatabaseManager {
  initialize(): Promise<void>;
  createTeam(dto: CreateTeamDTO): Promise<OnboardedTeam>;
  getTeamById(id: number): Promise<OnboardedTeam | undefined>;
  getTeamByLdapDn(ldapGroupDn: string): Promise<OnboardedTeam | undefined>;
  listTeams(onlyActive?: boolean): Promise<OnboardedTeam[]>;
  updateTeam(id: number, dto: UpdateTeamDTO): Promise<OnboardedTeam | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  findActiveTeamsForUser(userLdapGroupDns: string[]): Promise<OnboardedTeam[]>;
  close(): Promise<void>;
}

export class SqliteDatabaseManager implements IDatabaseManager {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'platform.db');
    if (resolvedPath !== ':memory:') {
      const dir = path.dirname(resolvedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(resolvedPath);
    this.migrateSync();
  }

  public migrateSync(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS onboarded_teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        ldap_group_dn TEXT NOT NULL UNIQUE COLLATE NOCASE,
        gitlab_group_path TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_onboarded_teams_ldap ON onboarded_teams(ldap_group_dn COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_onboarded_teams_active ON onboarded_teams(is_active);
    `);
  }

  public async initialize(): Promise<void> {
    this.migrateSync();
  }

  public createTeamSync(dto: CreateTeamDTO): OnboardedTeam {
    const isActive = dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1;
    const stmt = this.db.prepare(`
      INSERT INTO onboarded_teams (name, ldap_group_dn, gitlab_group_path, is_active)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    const result = stmt.get(dto.name, dto.ldap_group_dn, dto.gitlab_group_path, isActive) as unknown as OnboardedTeam;
    return result;
  }

  public async createTeam(dto: CreateTeamDTO): Promise<OnboardedTeam> {
    return this.createTeamSync(dto);
  }

  public getTeamByIdSync(id: number): OnboardedTeam | undefined {
    const stmt = this.db.prepare(`SELECT * FROM onboarded_teams WHERE id = ?`);
    const team = stmt.get(id) as unknown as OnboardedTeam | undefined;
    return team;
  }

  public async getTeamById(id: number): Promise<OnboardedTeam | undefined> {
    return this.getTeamByIdSync(id);
  }

  public getTeamByLdapDnSync(ldapGroupDn: string): OnboardedTeam | undefined {
    const stmt = this.db.prepare(`SELECT * FROM onboarded_teams WHERE ldap_group_dn COLLATE NOCASE = ?`);
    const team = stmt.get(ldapGroupDn) as unknown as OnboardedTeam | undefined;
    return team;
  }

  public async getTeamByLdapDn(ldapGroupDn: string): Promise<OnboardedTeam | undefined> {
    return this.getTeamByLdapDnSync(ldapGroupDn);
  }

  public listTeamsSync(onlyActive = false): OnboardedTeam[] {
    const query = onlyActive
      ? `SELECT * FROM onboarded_teams WHERE is_active = 1 ORDER BY id ASC`
      : `SELECT * FROM onboarded_teams ORDER BY id ASC`;
    const stmt = this.db.prepare(query);
    return stmt.all() as unknown as OnboardedTeam[];
  }

  public async listTeams(onlyActive = false): Promise<OnboardedTeam[]> {
    return this.listTeamsSync(onlyActive);
  }

  public updateTeamSync(id: number, dto: UpdateTeamDTO): OnboardedTeam | undefined {
    const existing = this.getTeamByIdSync(id);
    if (!existing) return undefined;

    const name = dto.name !== undefined ? dto.name : existing.name;
    const ldapDn = dto.ldap_group_dn !== undefined ? dto.ldap_group_dn : existing.ldap_group_dn;
    const gitlabPath = dto.gitlab_group_path !== undefined ? dto.gitlab_group_path : existing.gitlab_group_path;
    const isActive = dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : existing.is_active;

    const stmt = this.db.prepare(`
      UPDATE onboarded_teams
      SET name = ?, ldap_group_dn = ?, gitlab_group_path = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `);
    return stmt.get(name, ldapDn, gitlabPath, isActive, id) as unknown as OnboardedTeam;
  }

  public async updateTeam(id: number, dto: UpdateTeamDTO): Promise<OnboardedTeam | undefined> {
    return this.updateTeamSync(id, dto);
  }

  public deleteTeamSync(id: number): boolean {
    const stmt = this.db.prepare(`DELETE FROM onboarded_teams WHERE id = ?`);
    const info = stmt.run(id);
    return Number(info.changes) > 0;
  }

  public async deleteTeam(id: number): Promise<boolean> {
    return this.deleteTeamSync(id);
  }

  public findActiveTeamsForUserSync(userLdapGroupDns: string[]): OnboardedTeam[] {
    if (!userLdapGroupDns || userLdapGroupDns.length === 0) {
      return [];
    }
    const uniqueDns = Array.from(
      new Set(userLdapGroupDns.map((dn) => dn && String(dn).trim()).filter(Boolean))
    );
    if (uniqueDns.length === 0) {
      return [];
    }
    const placeholders = uniqueDns.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM onboarded_teams
      WHERE is_active = 1 AND ldap_group_dn COLLATE NOCASE IN (${placeholders})
      ORDER BY name ASC
    `);
    return stmt.all(...uniqueDns) as unknown as OnboardedTeam[];
  }

  public async findActiveTeamsForUser(userLdapGroupDns: string[]): Promise<OnboardedTeam[]> {
    return this.findActiveTeamsForUserSync(userLdapGroupDns);
  }

  public closeSync(): void {
    this.db.close();
  }

  public async close(): Promise<void> {
    this.closeSync();
  }
}

export class PostgresDatabaseManager implements IDatabaseManager {
  public pool: pg.Pool;

  constructor(configOrUrl?: string | pg.PoolConfig | pg.Pool) {
    if (configOrUrl && typeof (configOrUrl as any).query === 'function') {
      // Mock pool or injected pool instance
      this.pool = configOrUrl as pg.Pool;
    } else if (typeof configOrUrl === 'string') {
      this.pool = new pg.Pool({ connectionString: configOrUrl });
    } else if (configOrUrl && typeof configOrUrl === 'object') {
      this.pool = new pg.Pool(configOrUrl as pg.PoolConfig);
    } else if (process.env.DATABASE_URL) {
      this.pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    } else {
      this.pool = new pg.Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'platform',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
      });
    }
  }

  public async initialize(): Promise<void> {
    await this.migrate();
  }

  public async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS onboarded_teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        ldap_group_dn VARCHAR(512) NOT NULL UNIQUE,
        gitlab_group_path VARCHAR(512) NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_onboarded_teams_ldap ON onboarded_teams (LOWER(ldap_group_dn));
      CREATE INDEX IF NOT EXISTS idx_onboarded_teams_active ON onboarded_teams (is_active);
    `);
  }

  public async createTeam(dto: CreateTeamDTO): Promise<OnboardedTeam> {
    const isActive = dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1;
    const res = await this.pool.query(
      `INSERT INTO onboarded_teams (name, ldap_group_dn, gitlab_group_path, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, ldap_group_dn, gitlab_group_path, is_active, created_at, updated_at`,
      [dto.name, dto.ldap_group_dn, dto.gitlab_group_path, isActive]
    );
    const row = res.rows[0];
    return {
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  public async getTeamById(id: number): Promise<OnboardedTeam | undefined> {
    const res = await this.pool.query(`SELECT * FROM onboarded_teams WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  public async getTeamByLdapDn(ldapGroupDn: string): Promise<OnboardedTeam | undefined> {
    const res = await this.pool.query(
      `SELECT * FROM onboarded_teams WHERE LOWER(ldap_group_dn) = LOWER($1)`,
      [ldapGroupDn]
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  public async listTeams(onlyActive = false): Promise<OnboardedTeam[]> {
    const query = onlyActive
      ? `SELECT * FROM onboarded_teams WHERE is_active = 1 ORDER BY id ASC`
      : `SELECT * FROM onboarded_teams ORDER BY id ASC`;
    const res = await this.pool.query(query);
    return res.rows.map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  public async updateTeam(id: number, dto: UpdateTeamDTO): Promise<OnboardedTeam | undefined> {
    const existing = await this.getTeamById(id);
    if (!existing) return undefined;

    const name = dto.name !== undefined ? dto.name : existing.name;
    const ldapDn = dto.ldap_group_dn !== undefined ? dto.ldap_group_dn : existing.ldap_group_dn;
    const gitlabPath = dto.gitlab_group_path !== undefined ? dto.gitlab_group_path : existing.gitlab_group_path;
    const isActive = dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : existing.is_active;

    const res = await this.pool.query(
      `UPDATE onboarded_teams
       SET name = $1, ldap_group_dn = $2, gitlab_group_path = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, ldapDn, gitlabPath, isActive, id]
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  public async deleteTeam(id: number): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM onboarded_teams WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async findActiveTeamsForUser(userLdapGroupDns: string[]): Promise<OnboardedTeam[]> {
    if (!userLdapGroupDns || userLdapGroupDns.length === 0) {
      return [];
    }
    const uniqueLowerDns = Array.from(
      new Set(userLdapGroupDns.map((dn) => dn && String(dn).trim().toLowerCase()).filter(Boolean))
    );
    if (uniqueLowerDns.length === 0) {
      return [];
    }
    const placeholders = uniqueLowerDns.map((_, i) => `$${i + 1}`).join(',');
    const res = await this.pool.query(
      `SELECT * FROM onboarded_teams
       WHERE is_active = 1 AND LOWER(ldap_group_dn) IN (${placeholders})
       ORDER BY name ASC`,
      uniqueLowerDns
    );
    return res.rows.map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export class DatabaseManager implements IDatabaseManager {
  private provider: IDatabaseManager;

  constructor(configOrPath?: string | DatabaseConfig | pg.PoolConfig | pg.Pool) {
    if (
      configOrPath &&
      typeof configOrPath === 'object' &&
      'client' in configOrPath &&
      (configOrPath as DatabaseConfig).client === 'postgres'
    ) {
      const cfg = configOrPath as DatabaseConfig;
      this.provider = new PostgresDatabaseManager(cfg.postgres?.connectionString || cfg.postgres);
    } else if (
      typeof configOrPath === 'string' &&
      (configOrPath.startsWith('postgres://') || configOrPath.startsWith('postgresql://'))
    ) {
      this.provider = new PostgresDatabaseManager(configOrPath);
    } else if (
      process.env.DATABASE_CLIENT === 'postgres' ||
      (process.env.DATABASE_URL &&
        (process.env.DATABASE_URL.startsWith('postgres://') ||
          process.env.DATABASE_URL.startsWith('postgresql://')))
    ) {
      this.provider = new PostgresDatabaseManager(
        typeof configOrPath === 'string' && !configOrPath.includes('/')
          ? undefined
          : (configOrPath as any)
      );
    } else {
      const dbPath =
        typeof configOrPath === 'string'
          ? configOrPath
          : (configOrPath as DatabaseConfig)?.sqlite?.databasePath;
      this.provider = new SqliteDatabaseManager(dbPath);
    }
  }

  public getProvider(): IDatabaseManager {
    return this.provider;
  }

  public async initialize(): Promise<void> {
    return this.provider.initialize();
  }

  public createTeamSync(dto: CreateTeamDTO): OnboardedTeam {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.createTeamSync(dto);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async createTeam(dto: CreateTeamDTO): Promise<OnboardedTeam> {
    return this.provider.createTeam(dto);
  }

  public getTeamByIdSync(id: number): OnboardedTeam | undefined {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.getTeamByIdSync(id);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async getTeamById(id: number): Promise<OnboardedTeam | undefined> {
    return this.provider.getTeamById(id);
  }

  public getTeamByLdapDnSync(ldapGroupDn: string): OnboardedTeam | undefined {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.getTeamByLdapDnSync(ldapGroupDn);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async getTeamByLdapDn(ldapGroupDn: string): Promise<OnboardedTeam | undefined> {
    return this.provider.getTeamByLdapDn(ldapGroupDn);
  }

  public listTeamsSync(onlyActive = false): OnboardedTeam[] {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.listTeamsSync(onlyActive);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async listTeams(onlyActive = false): Promise<OnboardedTeam[]> {
    return this.provider.listTeams(onlyActive);
  }

  public updateTeamSync(id: number, dto: UpdateTeamDTO): OnboardedTeam | undefined {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.updateTeamSync(id, dto);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async updateTeam(id: number, dto: UpdateTeamDTO): Promise<OnboardedTeam | undefined> {
    return this.provider.updateTeam(id, dto);
  }

  public deleteTeamSync(id: number): boolean {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.deleteTeamSync(id);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async deleteTeam(id: number): Promise<boolean> {
    return this.provider.deleteTeam(id);
  }

  public findActiveTeamsForUserSync(userLdapGroupDns: string[]): OnboardedTeam[] {
    if (this.provider instanceof SqliteDatabaseManager) {
      return this.provider.findActiveTeamsForUserSync(userLdapGroupDns);
    }
    throw new Error('Synchronous operations only supported in SQLite mode');
  }

  public async findActiveTeamsForUser(userLdapGroupDns: string[]): Promise<OnboardedTeam[]> {
    return this.provider.findActiveTeamsForUser(userLdapGroupDns);
  }

  public closeSync(): void {
    if (this.provider instanceof SqliteDatabaseManager) {
      this.provider.closeSync();
    }
  }

  public async close(): Promise<void> {
    return this.provider.close();
  }
}

export function createDatabaseManager(config?: DatabaseConfig | string): IDatabaseManager {
  return new DatabaseManager(config);
}
