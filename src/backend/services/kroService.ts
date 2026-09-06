import * as k8s from '@kubernetes/client-node';
import crypto from 'node:crypto';
import { AppConfig } from '../config.js';

export interface GitLabTagTriggerSpec {
  name: string;
  repoUrl: string;
  projectId: number;
  targetNamespace?: string;
  tagPattern?: string;
  secretToken?: string;
}

export interface IKubernetesCustomApi {
  createNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    body: object
  ): Promise<{ body: any }>;
  getNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ): Promise<{ body: any }>;
  deleteNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ): Promise<{ body: any }>;
  listNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string
  ): Promise<{ body: any }>;
}

export class KubernetesCustomObjectAdapter implements IKubernetesCustomApi {
  constructor(private rawApi: any) {}

  public async createNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    body: object
  ): Promise<{ body: any }> {
    if (typeof this.rawApi.createNamespacedCustomObject === 'function') {
      try {
        if (this.rawApi.createNamespacedCustomObject.length <= 2) {
          const res = await this.rawApi.createNamespacedCustomObject({
            group,
            version,
            namespace,
            plural,
            body,
          });
          return { body: res.body ?? res };
        }
      } catch (err: any) {
        // Fallback
      }
      return await this.rawApi.createNamespacedCustomObject(group, version, namespace, plural, body);
    }
    throw new Error('createNamespacedCustomObject is not available');
  }

  public async getNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ): Promise<{ body: any }> {
    if (typeof this.rawApi.getNamespacedCustomObject === 'function') {
      if (this.rawApi.getNamespacedCustomObject.length <= 2) {
        const res = await this.rawApi.getNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
          name,
        });
        return { body: res.body ?? res };
      }
      return await this.rawApi.getNamespacedCustomObject(group, version, namespace, plural, name);
    }
    throw new Error('getNamespacedCustomObject is not available');
  }

  public async deleteNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ): Promise<{ body: any }> {
    if (typeof this.rawApi.deleteNamespacedCustomObject === 'function') {
      if (this.rawApi.deleteNamespacedCustomObject.length <= 2) {
        const res = await this.rawApi.deleteNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
          name,
        });
        return { body: res.body ?? res };
      }
      return await this.rawApi.deleteNamespacedCustomObject(group, version, namespace, plural, name);
    }
    throw new Error('deleteNamespacedCustomObject is not available');
  }

  public async listNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string
  ): Promise<{ body: any }> {
    if (typeof this.rawApi.listNamespacedCustomObject === 'function') {
      if (this.rawApi.listNamespacedCustomObject.length <= 2) {
        const res = await this.rawApi.listNamespacedCustomObject({
          group,
          version,
          namespace,
          plural,
        });
        return { body: res.body ?? res };
      }
      return await this.rawApi.listNamespacedCustomObject(group, version, namespace, plural);
    }
    throw new Error('listNamespacedCustomObject is not available');
  }
}

export class KroService {
  private customApi: IKubernetesCustomApi;
  private group = 'kro.run';
  private version = 'v1alpha1';
  private plural = 'gitlabtagtriggers';

  constructor(customApi?: IKubernetesCustomApi, config?: AppConfig['kubernetes']) {
    if (customApi) {
      this.customApi = customApi;
    } else {
      const kc = new k8s.KubeConfig();
      if (config?.kubeconfigPath) {
        kc.loadFromFile(config.kubeconfigPath);
      } else if (config?.inCluster) {
        kc.loadFromCluster();
      } else {
        kc.loadFromDefault();
      }
      const rawApi = kc.makeApiClient(k8s.CustomObjectsApi);
      this.customApi = new KubernetesCustomObjectAdapter(rawApi);
    }
  }

  public async createTagTrigger(namespace: string, spec: GitLabTagTriggerSpec): Promise<any> {
    const body = {
      apiVersion: `${this.group}/${this.version}`,
      kind: 'GitLabTagTrigger',
      metadata: {
        name: spec.name,
        namespace,
      },
      spec: {
        repoUrl: spec.repoUrl,
        projectId: spec.projectId,
        targetNamespace: spec.targetNamespace || namespace,
        tagPattern: spec.tagPattern || 'refs/tags/*',
        secretToken: spec.secretToken || this.generateSecretToken(),
      },
    };

    const res = await this.customApi.createNamespacedCustomObject(
      this.group,
      this.version,
      namespace,
      this.plural,
      body
    );
    return res.body;
  }

  public async getTagTrigger(namespace: string, name: string): Promise<any> {
    const res = await this.customApi.getNamespacedCustomObject(
      this.group,
      this.version,
      namespace,
      this.plural,
      name
    );
    return res.body;
  }

  public async deleteTagTrigger(namespace: string, name: string): Promise<any> {
    const res = await this.customApi.deleteNamespacedCustomObject(
      this.group,
      this.version,
      namespace,
      this.plural,
      name
    );
    return res.body;
  }

  public async listTagTriggers(namespace: string): Promise<any[]> {
    const res = await this.customApi.listNamespacedCustomObject(
      this.group,
      this.version,
      namespace,
      this.plural
    );
    return (res.body as any).items || [];
  }

  private generateSecretToken(): string {
    return `sec-${crypto.randomBytes(24).toString('hex')}`;
  }
}

