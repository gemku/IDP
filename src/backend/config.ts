export interface AppConfig {
  server: {
    port: number;
    sessionSecret: string;
    databasePath: string;
  };
  gitlab: {
    url: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    adminToken?: string;
  };
  ldap: {
    url: string;
    bindDn: string;
    bindPassword: string;
    baseDn: string;
  };
  kubernetes: {
    kubeconfigPath?: string;
    kroNamespace: string;
    argoGatewayUrl: string;
    inCluster: boolean;
  };
}

export class ConfigValidationError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(`Missing required configuration fields: ${missingFields.join(', ')}`);
    this.name = 'ConfigValidationError';
  }
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const missing: string[] = [];

  const gitlabUrl = env.GITLAB_URL || 'http://gitlab.example.com';
  const gitlabClientId = env.GITLAB_CLIENT_ID;
  const gitlabClientSecret = env.GITLAB_CLIENT_SECRET;
  const gitlabRedirectUri = env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/auth/gitlab/callback';

  if (!gitlabClientId) missing.push('GITLAB_CLIENT_ID');
  if (!gitlabClientSecret) missing.push('GITLAB_CLIENT_SECRET');

  const ldapUrl = env.LDAP_URL || 'ldap://ldap.example.com:389';
  const ldapBindDn = env.LDAP_BIND_DN;
  const ldapBindPassword = env.LDAP_BIND_PASSWORD;
  const ldapBaseDn = env.LDAP_BASE_DN || 'dc=example,dc=com';

  if (!ldapBindDn) missing.push('LDAP_BIND_DN');
  if (!ldapBindPassword) missing.push('LDAP_BIND_PASSWORD');

  if (!gitlabClientId || !gitlabClientSecret || !ldapBindDn || !ldapBindPassword) {
    throw new ConfigValidationError(missing);
  }

  return {
    server: {
      port: parseInt(env.PORT || '3000', 10),
      sessionSecret: env.SESSION_SECRET || 'dev-insecure-session-secret-replace-in-prod',
      databasePath: env.DATABASE_PATH || 'data/platform.db',
    },
    gitlab: {
      url: gitlabUrl,
      clientId: gitlabClientId,
      clientSecret: gitlabClientSecret,
      redirectUri: gitlabRedirectUri,
      adminToken: env.GITLAB_ADMIN_TOKEN,
    },
    ldap: {
      url: ldapUrl,
      bindDn: ldapBindDn,
      bindPassword: ldapBindPassword,
      baseDn: ldapBaseDn,
    },
    kubernetes: {
      kubeconfigPath: env.KUBECONFIG,
      kroNamespace: env.KRO_NAMESPACE || 'kro-system',
      argoGatewayUrl: env.ARGO_GATEWAY_URL || 'http://gitlab-eventsource-svc.argo-events.svc:12000',
      inCluster: env.KUBERNETES_SERVICE_HOST !== undefined,
    },
  };
}

