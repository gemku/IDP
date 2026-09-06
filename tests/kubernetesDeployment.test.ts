import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Kubernetes In-Cluster Deployment Manifests & Packaging', () => {
  it('validates multi-stage Dockerfile and .dockerignore packaging', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

    expect(dockerfile).toContain('FROM node:24-alpine AS builder');
    expect(dockerfile).toContain('FROM node:24-alpine AS runner');
    expect(dockerfile).toContain('npm run build');
    expect(dockerfile).toContain('npm ci --omit=dev');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('EXPOSE 3000');
    expect(dockerfile).toContain('/api/health');

    const dockerignorePath = path.join(process.cwd(), '.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);
    const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
    expect(dockerignore).toContain('node_modules/');
    expect(dockerignore).toContain('*.db');
    expect(dockerignore).toContain('.git/');
  });

  it('validates platform namespace and RBAC manifests', () => {
    const nsPath = path.join(process.cwd(), 'k8s', 'platform', '00-namespace.yaml');
    expect(fs.existsSync(nsPath)).toBe(true);
    const nsContent = fs.readFileSync(nsPath, 'utf8');
    expect(nsContent).toContain('name: platform-system');

    const rbacPath = path.join(process.cwd(), 'k8s', 'platform', '01-rbac.yaml');
    expect(fs.existsSync(rbacPath)).toBe(true);
    const rbacContent = fs.readFileSync(rbacPath, 'utf8');
    expect(rbacContent).toContain('name: platform-api-sa');
    expect(rbacContent).toContain('name: platform-api-role');
    expect(rbacContent).toContain('kro.run');
    expect(rbacContent).toContain('gitlabtagtriggers');
    expect(rbacContent).toContain('metrics.k8s.io');
    expect(rbacContent).toContain('pods/log');
  });

  it('validates in-cluster ConfigMap, Secret, and PVC manifests', () => {
    const cfgPath = path.join(process.cwd(), 'k8s', 'platform', '02-configmap-secret.yaml');
    expect(fs.existsSync(cfgPath)).toBe(true);
    const cfgContent = fs.readFileSync(cfgPath, 'utf8');
    expect(cfgContent).toContain('name: platform-config');
    expect(cfgContent).toContain('DATABASE_PATH: "/app/data/platform.db"');
    expect(cfgContent).toContain('name: platform-secrets');
    expect(cfgContent).toContain('SESSION_SECRET');
    expect(cfgContent).toContain('GITLAB_CLIENT_ID');

    const pvcPath = path.join(process.cwd(), 'k8s', 'platform', '03-pvc.yaml');
    expect(fs.existsSync(pvcPath)).toBe(true);
    const pvcContent = fs.readFileSync(pvcPath, 'utf8');
    expect(pvcContent).toContain('name: platform-db-pvc');
    expect(pvcContent).toContain('ReadWriteOnce');
  });

  it('validates single-writer Recreate Deployment, health probes, and networking', () => {
    const deployPath = path.join(process.cwd(), 'k8s', 'platform', '04-deployment.yaml');
    expect(fs.existsSync(deployPath)).toBe(true);
    const deployContent = fs.readFileSync(deployPath, 'utf8');
    expect(deployContent).toContain('replicas: 1');
    expect(deployContent).toContain('type: Recreate');
    expect(deployContent).toContain('serviceAccountName: platform-api-sa');
    expect(deployContent).toContain('runAsNonRoot: true');
    expect(deployContent).toContain('path: /api/health/ready');
    expect(deployContent).toContain('path: /api/health/live');

    const svcPath = path.join(process.cwd(), 'k8s', 'platform', '05-service.yaml');
    expect(fs.existsSync(svcPath)).toBe(true);
    const svcContent = fs.readFileSync(svcPath, 'utf8');
    expect(svcContent).toContain('name: platform-api-svc');
    expect(svcContent).toContain('targetPort: 3000');

    const ingPath = path.join(process.cwd(), 'k8s', 'platform', '06-ingress.yaml');
    expect(fs.existsSync(ingPath)).toBe(true);
    const ingContent = fs.readFileSync(ingPath, 'utf8');
    expect(ingContent).toContain('kind: Ingress');
    expect(ingContent).toContain('name: platform-api-svc');
  });

  it('validates deployment script orchestrates platform application manifests', () => {
    const scriptPath = path.join(process.cwd(), 'k8s', 'scripts', 'deploy-platform.ps1');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('k8s/platform/00-namespace.yaml');
    expect(script).toContain('k8s/platform/04-deployment.yaml');
    expect(script).toContain('k8s/platform/05-service.yaml');
  });
});
