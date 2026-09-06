import ldap from 'ldapjs';
import { AppConfig } from '../config.js';

export interface ILdapService {
  getUserGroups(username: string): Promise<string[]>;
}

export class LdapService implements ILdapService {
  private config: AppConfig['ldap'];

  constructor(config: AppConfig['ldap']) {
    this.config = config;
  }

  public async getUserGroups(username: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      let client: ldap.Client;
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
        // Suppress unhandled errors if closed
      });

      client.bind(this.config.bindDn, this.config.bindPassword, (err) => {
        if (err) {
          client.unbind(() => {});
          return reject(new Error(`LDAP Bind Failure: ${err.message}`));
        }

        const opts: ldap.SearchOptions = {
          filter: `(|(uid=${username})(sAMAccountName=${username}))`,
          scope: 'sub',
          attributes: ['dn', 'memberOf'],
        };

        client.search(this.config.baseDn, opts, (searchErr, res) => {
          if (searchErr) {
            client.unbind(() => {});
            return reject(new Error(`LDAP Search Failure: ${searchErr.message}`));
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
            client.unbind(() => {});
            reject(new Error(`LDAP Entry Error: ${resErr.message}`));
          });

          res.on('end', (result) => {
            client.unbind(() => {});
            resolve(groups);
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

