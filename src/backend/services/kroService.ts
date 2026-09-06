import * as k8s from '@kubernetes/client-node';
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
      this.customApi = kc.makeApiClient(k8s.CustomObjectsApi);
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
    return `sec-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
  }
}

