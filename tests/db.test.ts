import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../src/backend/db.js';
import fs from 'node:fs';
import path from 'node:path';

describe('DatabaseManager - onboarded_teams', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-platform.db');
  let dbManager: DatabaseManager;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('migrates schema and creates onboarded_teams table with all required columns', () => {
    const teams = dbManager.listTeams();
    expect(teams).toEqual([]);
  });

  it('creates, retrieves, and lists onboarded teams', () => {
    const team = dbManager.createTeam({
      name: 'Platform Engineering',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });

    expect(team.id).toBeDefined();
    expect(team.name).toBe('Platform Engineering');
    expect(team.ldap_group_dn).toBe('cn=platform-eng,ou=groups,dc=example,dc=com');
    expect(team.gitlab_group_path).toBe('engineering/platform');
    expect(team.is_active).toBe(1);
    expect(team.created_at).toBeDefined();
    expect(team.updated_at).toBeDefined();

    const retrieved = dbManager.getTeamById(team.id);
    expect(retrieved).toEqual(team);

    const byLdap = dbManager.getTeamByLdapDn('cn=platform-eng,ou=groups,dc=example,dc=com');
    expect(byLdap).toEqual(team);
  });

  it('updates team attributes and toggles is_active', () => {
    const team = dbManager.createTeam({
      name: 'DevOps',
      ldap_group_dn: 'cn=devops,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/devops',
      is_active: true,
    });

    const updated = dbManager.updateTeam(team.id, {
      name: 'Cloud Platform',
      is_active: false,
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Cloud Platform');
    expect(updated?.is_active).toBe(0);

    const activeList = dbManager.listTeams(true);
    expect(activeList).toHaveLength(0);

    const fullList = dbManager.listTeams(false);
    expect(fullList).toHaveLength(1);
  });

  it('filters active teams for user by user LDAP group DNs', () => {
    dbManager.createTeam({
      name: 'Team Alpha',
      ldap_group_dn: 'cn=team-alpha,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/alpha',
      is_active: true,
    });

    dbManager.createTeam({
      name: 'Team Beta',
      ldap_group_dn: 'cn=team-beta,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/beta',
      is_active: false, // inactive
    });

    dbManager.createTeam({
      name: 'Team Gamma',
      ldap_group_dn: 'cn=team-gamma,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/gamma',
      is_active: true,
    });

    const userGroups = [
      'cn=team-alpha,ou=groups,dc=example,dc=com',
      'cn=team-beta,ou=groups,dc=example,dc=com',
      'cn=other-group,ou=groups,dc=example,dc=com',
    ];

    const matched = dbManager.findActiveTeamsForUser(userGroups);
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Team Alpha');
  });

  it('deletes an onboarded team', () => {
    const team = dbManager.createTeam({
      name: 'To Delete',
      ldap_group_dn: 'cn=delete-me,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'temp/delete',
    });

    const deleted = dbManager.deleteTeam(team.id);
    expect(deleted).toBe(true);
    expect(dbManager.getTeamById(team.id)).toBeUndefined();
  });

  it('matches LDAP group DNs case-insensitively per RFC 4514', () => {
    dbManager.createTeam({
      name: 'Case Sensitive Test',
      ldap_group_dn: 'cn=engineers,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/engineers',
      is_active: true,
    });

    // Lookup with mixed case
    const found = dbManager.getTeamByLdapDn('CN=Engineers,OU=Groups,DC=EXAMPLE,DC=COM');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Case Sensitive Test');

    // Filter with upper case
    const matched = dbManager.findActiveTeamsForUser(['CN=ENGINEERS,OU=GROUPS,DC=EXAMPLE,DC=COM']);
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Case Sensitive Test');
  });

  it('safely handles duplicate or whitespace-padded LDAP group DNs in findActiveTeamsForUser', () => {
    dbManager.createTeam({
      name: 'Platform Engineering',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });

    const duplicateGroups = [
      'cn=platform-eng,ou=groups,dc=example,dc=com',
      'cn=platform-eng,ou=groups,dc=example,dc=com',
      ' cn=platform-eng,ou=groups,dc=example,dc=com ',
      '',
    ];

    const matched = dbManager.findActiveTeamsForUser(duplicateGroups);
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('Platform Engineering');
  });
});

