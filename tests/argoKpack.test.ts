import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Argo Events, Workflows & Kpack Build Pipeline Scaffolding', () => {
  it('validates Argo Events Sensor manifest and tag sanitization', () => {
    const sensorPath = path.join(process.cwd(), 'k8s', 'argo', 'events', 'gitlab-tag-sensor.yaml');
    expect(fs.existsSync(sensorPath)).toBe(true);
    const content = fs.readFileSync(sensorPath, 'utf8');

    expect(content).toContain('kind: Sensor');
    expect(content).toContain('refs/tags/.*');
    expect(content).toContain('trimPrefix "refs/tags/"');
    expect(content).toContain('kpack-build-pipeline-template');
  });

  it('validates Workflow semaphore ConfigMap and concurrency limits', () => {
    const cmPath = path.join(process.cwd(), 'k8s', 'argo', 'workflows', 'workflow-semaphore-configmap.yaml');
    expect(fs.existsSync(cmPath)).toBe(true);
    const content = fs.readFileSync(cmPath, 'utf8');

    expect(content).toContain('kind: ConfigMap');
    expect(content).toContain('name: workflow-semaphore-config');
    expect(content).toContain('max-builds: "5"');
  });

  it('validates WorkflowTemplate contains semaphore and non-premature completion conditions for Kpack', () => {
    const wtPath = path.join(process.cwd(), 'k8s', 'argo', 'workflows', 'kpack-build-workflow-template.yaml');
    expect(fs.existsSync(wtPath)).toBe(true);
    const content = fs.readFileSync(wtPath, 'utf8');

    expect(content).toContain('kind: WorkflowTemplate');
    expect(content).toContain('semaphore:');
    expect(content).toContain('name: workflow-semaphore-config');
    expect(content).toContain('successCondition: status.conditions.@filter(type=="Ready").0.status == True');
    expect(content).toContain('failureCondition: status.conditions.@filter(type=="Ready").0.status == False');
    expect(content).toContain('kind: Image');
  });

  it('validates Kpack memory limits and heap flags preventing Exit Code 137 OOMKilled', () => {
    const imagePath = path.join(process.cwd(), 'k8s', 'kpack', 'sample-hardened-image.yaml');
    expect(fs.existsSync(imagePath)).toBe(true);
    const content = fs.readFileSync(imagePath, 'utf8');

    expect(content).toContain('NODE_OPTIONS');
    expect(content).toContain('--max-old-space-size=3072');
    expect(content).toContain('BP_JVM_VERSION');
    expect(content).toContain('memory: 4Gi');
  });
});

