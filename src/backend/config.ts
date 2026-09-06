export type DatabaseClientType = 'sqlite' | 'postgres';

export interface DatabaseConfig {
  client: DatabaseClientType;
  sqlite?: {
    databasePath: string;
  };
  postgres?: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
  };
}

export interface AppConfig {
  server: {
    port: number;
    sessionSecret: string;
    databasePath: string;
  };
  database: DatabaseConfig;
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

  const explicitClient = env.DATABASE_CLIENT?.toLowerCase();
  const databaseUrl = env.DATABASE_URL;
  const isPostgresUrl = Boolean(
    databaseUrl &&
      (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
  );
  const isPostgresExplicit =
    explicitClient === 'postgres' || explicitClient === 'postgresql' || explicitClient === 'pg';

  const client: DatabaseClientType = isPostgresExplicit || isPostgresUrl ? 'postgres' : 'sqlite';
  const databasePath = env.DATABASE_PATH || 'data/platform.db';

  const databaseConfig: DatabaseConfig = {
    client,
    sqlite: {
      databasePath,
    },
    postgres: {
      connectionString: databaseUrl,
      host: env.POSTGRES_HOST || 'localhost',
      port: env.POSTGRES_PORT ? parseInt(env.POSTGRES_PORT, 10) : 5432,
      database: env.POSTGRES_DB || env.POSTGRES_DATABASE || 'platform',
      user: env.POSTGRES_USER || 'postgres',
      password: env.POSTGRES_PASSWORD,
      ssl: env.POSTGRES_SSL === 'true',
    },
  };

  return {
    server: {
      port: parseInt(env.PORT || '3000', 10),
      sessionSecret: env.SESSION_SECRET || 'dev-insecure-session-secret-replace-in-prod',
      databasePath,
    },
    database: databaseConfig,
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
