import axios from 'axios';
import { AppConfig } from '../config.js';
import { GitLabUser, GitLabProject } from '../../types/models.js';

export interface IGitLabService {
  getAuthorizationUrl(state?: string): string;
  exchangeCodeForToken(code: string): Promise<{ access_token: string; refresh_token?: string }>;
  getUserProfile(accessToken: string): Promise<GitLabUser>;
  validateGroupPath(groupPath: string, token?: string): Promise<{ id: number; name: string; path: string }>;
  getGroupProjects(groupId: number | string, token: string): Promise<GitLabProject[]>;
  registerProjectWebhook(projectId: number, webhookUrl: string, secretToken: string, token?: string): Promise<any>;
}

export class GitLabService implements IGitLabService {
  private config: AppConfig['gitlab'];

  constructor(config: AppConfig['gitlab']) {
    this.config = config;
  }

  public getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'read_user api read_repository',
    });
    if (state) {
      params.append('state', state);
    }
    return `${this.config.url}/oauth/authorize?${params.toString()}`;
  }

  public async exchangeCodeForToken(code: string): Promise<{ access_token: string; refresh_token?: string }> {
    const response = await axios.post(`${this.config.url}/oauth/token`, {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
    });
    return response.data;
  }

  public async getUserProfile(accessToken: string): Promise<GitLabUser> {
    const response = await axios.get(`${this.config.url}/api/v4/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  }

  public async validateGroupPath(groupPath: string, token?: string): Promise<{ id: number; name: string; path: string }> {
    const authToken = token || this.config.adminToken;
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    const encoded = encodeURIComponent(groupPath);
    const response = await axios.get(`${this.config.url}/api/v4/groups/${encoded}`, { headers });
    return {
      id: response.data.id,
      name: response.data.name,
      path: response.data.path,
    };
  }

  public async getGroupProjects(groupId: number | string, token: string): Promise<GitLabProject[]> {
    const encoded = encodeURIComponent(groupId);
    const response = await axios.get(
      `${this.config.url}/api/v4/groups/${encoded}/projects?include_subgroups=true&membership=true&per_page=100`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data.map((p: any) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      path_with_namespace: p.path_with_namespace,
      web_url: p.web_url,
      visibility: p.visibility,
      description: p.description,
      default_branch: p.default_branch,
    }));
  }

  public async registerProjectWebhook(
    projectId: number,
    webhookUrl: string,
    secretToken: string,
    token?: string
  ): Promise<any> {
    const authToken = token || this.config.adminToken;
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

    // Check existing hooks first to avoid duplicates
    try {
      const existingHooks = await axios.get(`${this.config.url}/api/v4/projects/${projectId}/hooks`, { headers });
      const matched = existingHooks.data.find((h: any) => h.url === webhookUrl);
      if (matched) {
        // Update existing hook
        const updateRes = await axios.put(
          `${this.config.url}/api/v4/projects/${projectId}/hooks/${matched.id}`,
          {
            url: webhookUrl,
            token: secretToken,
            tag_push_events: true,
            push_events: false,
          },
          { headers }
        );
        return updateRes.data;
      }
    } catch {
      // Proceed to create
    }

    const createRes = await axios.post(
      `${this.config.url}/api/v4/projects/${projectId}/hooks`,
      {
        url: webhookUrl,
        token: secretToken,
        tag_push_events: true,
        push_events: false,
        enable_ssl_verification: false,
      },
      { headers }
    );
    return createRes.data;
  }
}

