import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigValidationError } from '../src/backend/config.js';

describe('AppConfig - Environment Configuration', () => {
  it('throws ConfigValidationError if required credentials are missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigValidationError);
    try {
      loadConfig({});
    } catch (err) {
      const configErr = err as ConfigValidationError;
      expect(configErr.missingFields).toContain('GITLAB_CLIENT_ID');
      expect(configErr.missingFields).toContain('GITLAB_CLIENT_SECRET');
      expect(configErr.missingFields).toContain('LDAP_BIND_DN');
      expect(configErr.missingFields).toContain('LDAP_BIND_PASSWORD');
    }
  });

  it('loads and parses complete valid configuration with default fallbacks', () => {
    const validEnv = {
      GITLAB_CLIENT_ID: 'mock-client-id',
      GITLAB_CLIENT_SECRET: 'mock-client-secret',
      LDAP_BIND_DN: 'cn=admin,dc=example,dc=com',
      LDAP_BIND_PASSWORD: 'admin-password',
      PORT: '4000',
      GITLAB_URL: 'https://gitlab.company.local',
    };

    const config = loadConfig(validEnv);
    expect(config.server.port).toBe(4000);
    expect(config.gitlab.clientId).toBe('mock-client-id');
    expect(config.gitlab.clientSecret).toBe('mock-client-secret');
    expect(config.gitlab.url).toBe('https://gitlab.company.local');
    expect(config.ldap.bindDn).toBe('cn=admin,dc=example,dc=com');
    expect(config.ldap.baseDn).toBe('dc=example,dc=com');
    expect(config.kubernetes.kroNamespace).toBe('kro-system');
  });
});

