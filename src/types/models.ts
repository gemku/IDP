export interface OnboardedTeam {
  id: number;
  name: string;
  ldap_group_dn: string;
  gitlab_group_path: string;
  is_active: number; // 0 or 1 in SQLite
  created_at: string;
  updated_at: string;
}

export interface CreateTeamDTO {
  name: string;
  ldap_group_dn: string;
  gitlab_group_path: string;
  is_active?: boolean;
}

export interface UpdateTeamDTO {
  name?: string;
  ldap_group_dn?: string;
  gitlab_group_path?: string;
  is_active?: boolean;
}

export interface GitLabUser {
  id: number;
  username: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface SessionUser {
  gitlabUser: GitLabUser;
  ldapGroups: string[];
  activeTeams: OnboardedTeam[];
}

export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  visibility: 'private' | 'internal' | 'public';
  description?: string;
  default_branch?: string;
}

