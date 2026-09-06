import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { OnboardedTeam, CreateTeamDTO, UpdateTeamDTO } from '../types/models.js';

export class DatabaseManager {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'platform.db');
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(resolvedPath);
    this.migrate();
  }

  public migrate(): void {
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

  public createTeam(dto: CreateTeamDTO): OnboardedTeam {
    const isActive = dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1;
    const stmt = this.db.prepare(`
      INSERT INTO onboarded_teams (name, ldap_group_dn, gitlab_group_path, is_active)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    const result = stmt.get(dto.name, dto.ldap_group_dn, dto.gitlab_group_path, isActive) as unknown as OnboardedTeam;
    return result;
  }

  public getTeamById(id: number): OnboardedTeam | undefined {
    const stmt = this.db.prepare(`SELECT * FROM onboarded_teams WHERE id = ?`);
    const team = stmt.get(id) as unknown as OnboardedTeam | undefined;
    return team;
  }

  public getTeamByLdapDn(ldapGroupDn: string): OnboardedTeam | undefined {
    const stmt = this.db.prepare(`SELECT * FROM onboarded_teams WHERE ldap_group_dn COLLATE NOCASE = ?`);
    const team = stmt.get(ldapGroupDn) as unknown as OnboardedTeam | undefined;
    return team;
  }

  public listTeams(onlyActive = false): OnboardedTeam[] {
    const query = onlyActive
      ? `SELECT * FROM onboarded_teams WHERE is_active = 1 ORDER BY id ASC`
      : `SELECT * FROM onboarded_teams ORDER BY id ASC`;
    const stmt = this.db.prepare(query);
    return stmt.all() as unknown as OnboardedTeam[];
  }

  public updateTeam(id: number, dto: UpdateTeamDTO): OnboardedTeam | undefined {
    const existing = this.getTeamById(id);
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

  public deleteTeam(id: number): boolean {
    const stmt = this.db.prepare(`DELETE FROM onboarded_teams WHERE id = ?`);
    const info = stmt.run(id);
    return Number(info.changes) > 0;
  }

  public findActiveTeamsForUser(userLdapGroupDns: string[]): OnboardedTeam[] {
    if (!userLdapGroupDns || userLdapGroupDns.length === 0) {
      return [];
    }
    const placeholders = userLdapGroupDns.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM onboarded_teams
      WHERE is_active = 1 AND ldap_group_dn COLLATE NOCASE IN (${placeholders})
      ORDER BY name ASC
    `);
    return stmt.all(...userLdapGroupDns) as unknown as OnboardedTeam[];
  }

  public close(): void {
    this.db.close();
  }
}

