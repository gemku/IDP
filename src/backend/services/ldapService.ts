import ldap from 'ldapjs';
import { AppConfig } from '../config.js';

export interface ILdapService {
  getUserGroups(username: string): Promise<string[]>;
}

export function escapeLdapFilter(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[\\*()\0]/g, (char) => {
    switch (char) {
      case '\\':
        return '\\5c';
      case '*':
        return '\\2a';
      case '(':
        return '\\28';
      case ')':
        return '\\29';
      case '\0':
        return '\\00';
      default:
        return char;
    }
  });
}

export class LdapService implements ILdapService {
  private config: AppConfig['ldap'];

  constructor(config: AppConfig['ldap']) {
    this.config = config;
  }

  public async getUserGroups(username: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      let client: ldap.Client;
      let settled = false;

      const safeReject = (err: Error) => {
        if (!settled) {
          settled = true;
          try {
            client?.unbind(() => {});
          } catch {}
          reject(err);
        }
      };

      const safeResolve = (groups: string[]) => {
        if (!settled) {
          settled = true;
          try {
            client?.unbind(() => {});
          } catch {}
          resolve(groups);
        }
      };

      try {
        client = ldap.createClient({
          url: this.config.url,
          timeout: 5000,
          connectTimeout: 5000,
        });
      } catch (err) {
        return reject(err);
      }

      client.on('error', (err) => {
        safeReject(new Error(`LDAP Connection Error: ${err.message}`));
      });

      client.bind(this.config.bindDn, this.config.bindPassword, (err) => {
        if (err) {
          return safeReject(new Error(`LDAP Bind Failure: ${err.message}`));
        }

        const sanitizedUsername = escapeLdapFilter(username);
        const opts: ldap.SearchOptions = {
          filter: `(|(uid=${sanitizedUsername})(sAMAccountName=${sanitizedUsername}))`,
          scope: 'sub',
          attributes: ['dn', 'memberOf'],
        };

        client.search(this.config.baseDn, opts, (searchErr, res) => {
          if (searchErr) {
            return safeReject(new Error(`LDAP Search Failure: ${searchErr.message}`));
          }

          const groups: string[] = [];

          res.on('searchEntry', (entry: ldap.SearchEntry) => {
            for (const attr of entry.attributes) {
              if (attr.type.toLowerCase() === 'memberof') {
                if (Array.isArray(attr.values)) {
                  groups.push(...attr.values);
                } else if (typeof attr.values === 'string') {
                  groups.push(attr.values);
                }
              }
            }
          });

          res.on('error', (resErr) => {
            safeReject(new Error(`LDAP Entry Error: ${resErr.message}`));
          });

          res.on('end', () => {
            safeResolve(groups);
          });
        });
      });
    });
  }
}

export class MockLdapService implements ILdapService {
  private userGroupMap: Map<string, string[]> = new Map();

  public setUserGroups(username: string, groups: string[]): void {
    this.userGroupMap.set(username, groups);
  }

  public async getUserGroups(username: string): Promise<string[]> {
    return this.userGroupMap.get(username) || [];
  }
}

