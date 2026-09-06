declare module 'ldapjs' {
  import { EventEmitter } from 'node:events';

  export interface SearchOptions {
    scope?: 'base' | 'one' | 'sub';
    filter?: string;
    attributes?: string[];
    sizeLimit?: number;
    timeLimit?: number;
  }

  export interface SearchEntry {
    dn: string;
    attributes: Array<{
      type: string;
      values: string[];
    }>;
  }

  export interface Client extends EventEmitter {
    bind(dn: string, password: string, callback: (err: Error | null) => void): void;
    search(base: string, options: SearchOptions, callback: (err: Error | null, res: EventEmitter) => void): void;
    unbind(callback?: (err: Error | null) => void): void;
    destroy(): void;
  }

  export function createClient(options: { url: string; timeout?: number; connectTimeout?: number }): Client;
}

