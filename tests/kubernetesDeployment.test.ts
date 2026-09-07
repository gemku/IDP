import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Kubernetes In-Cluster Deployment Manifests & Packaging', () => {
  it('validates multi-stage backend and frontend Dockerfiles, NGINX config, and .dockerignore packaging', () => {
    // Backend Dockerfile
    const backendDockerfilePath = path.join(process.cwd(), 'Dockerfile.backend');
    expect(fs.existsSync(backendDockerfilePath)).toBe(true);
    const backendDockerfile = fs.readFileSync(backendDockerfilePath, 'utf8');

    expect(backendDockerfile).toContain('FROM node:24-alpine AS builder');
    expect(backendDockerfile).toContain('FROM node:24-alpine AS runner');
    expect(backendDockerfile).toContain('npm run build');
    expect(backendDockerfile).toContain('npm ci --omit=dev');
    expect(backendDockerfile).toContain('USER node');
    expect(backendDockerfile).toContain('EXPOSE 3000');
    expect(backendDockerfile).toContain('/api/health/live');

    // Frontend Dockerfile
    const frontendDockerfilePath = path.join(process.cwd(), 'Dockerfile.frontend');
    expect(fs.existsSync(frontendDockerfilePath)).toBe(true);
    const frontendDockerfile = fs.readFileSync(frontendDockerfilePath, 'utf8');

    expect(frontendDockerfile).toContain('FROM node:24-alpine AS builder');
    expect(frontendDockerfile).toContain('npm run build:client');
    expect(frontendDockerfile).toContain('FROM nginx:alpine AS runner');
    expect(frontendDockerfile).toContain('COPY --from=builder /app/dist/client /usr/share/nginx/html');
    expect(frontendDockerfile).toContain('EXPOSE 80');
    expect(frontendDockerfile).toContain('/healthz');

    // NGINX configuration
    const nginxConfPath = path.join(process.cwd(), 'docker', 'nginx.conf');
    expect(fs.existsSync(nginxConfPath)).toBe(true);
    const nginxConf = fs.readFileSync(nginxConfPath, 'utf8');
    expect(nginxConf).toContain('try_files $uri $uri/ /index.html');
    expect(nginxConf).toContain('location = /healthz');

    // Dockerignore
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

  it('validates decoupled backend and frontend Deployments, Services, and Ingress routing', () => {
    // Backend Deployment
    const backendDeployPath = path.join(process.cwd(), 'k8s', 'platform', '04-backend-deployment.yaml');
    expect(fs.existsSync(backendDeployPath)).toBe(true);
    const backendDeploy = fs.readFileSync(backendDeployPath, 'utf8');
    expect(backendDeploy).toContain('name: platform-backend');
    expect(backendDeploy).toContain('type: Recreate');
    expect(backendDeploy).toContain('serviceAccountName: platform-api-sa');
    expect(backendDeploy).toContain('runAsNonRoot: true');
    expect(backendDeploy).toContain('claimName: platform-db-pvc');
    expect(backendDeploy).toContain('path: /api/health/ready');
    expect(backendDeploy).toContain('path: /api/health/live');

    // Frontend Deployment
    const frontendDeployPath = path.join(process.cwd(), 'k8s', 'platform', '04-frontend-deployment.yaml');
    expect(fs.existsSync(frontendDeployPath)).toBe(true);
    const frontendDeploy = fs.readFileSync(frontendDeployPath, 'utf8');
    expect(frontendDeploy).toContain('name: platform-frontend');
    expect(frontendDeploy).toContain('replicas: 2');
    expect(frontendDeploy).toContain('containerPort: 80');
    expect(frontendDeploy).toContain('path: /healthz');

    // Services
    const svcPath = path.join(process.cwd(), 'k8s', 'platform', '05-service.yaml');
    expect(fs.existsSync(svcPath)).toBe(true);
    const svcContent = fs.readFileSync(svcPath, 'utf8');
    expect(svcContent).toContain('name: platform-backend-svc');
    expect(svcContent).toContain('targetPort: 3000');
    expect(svcContent).toContain('name: platform-frontend-svc');
    expect(svcContent).toContain('targetPort: 80');

    // Ingress
    const ingPath = path.join(process.cwd(), 'k8s', 'platform', '06-ingress.yaml');
    expect(fs.existsSync(ingPath)).toBe(true);
    const ingContent = fs.readFileSync(ingPath, 'utf8');
    expect(ingContent).toContain('kind: Ingress');
    expect(ingContent).toContain('path: /api');
    expect(ingContent).toContain('name: platform-backend-svc');
    expect(ingContent).toContain('path: /');
    expect(ingContent).toContain('name: platform-frontend-svc');
  });

  it('validates deployment script orchestrates both platform application manifests', () => {
    const scriptPath = path.join(process.cwd(), 'k8s', 'scripts', 'deploy-platform.ps1');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const script = fs.readFileSync(scriptPath, 'utf8');
    expect(script).toContain('k8s/platform/00-namespace.yaml');
    expect(script).toContain('k8s/platform/04-backend-deployment.yaml');
    expect(script).toContain('k8s/platform/04-frontend-deployment.yaml');
    expect(script).toContain('k8s/platform/05-service.yaml');
    expect(script).toContain('k8s/platform/06-ingress.yaml');
  });
});
