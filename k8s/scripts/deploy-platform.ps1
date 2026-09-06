#!/usr/bin/env pwsh
# Deploy Platform Manifests in Dependency Order

Write-Host "===> Step 1: Applying KRO ResourceGraphDefinitions..." -ForegroundColor Cyan
kubectl apply -f k8s/kro/gitlab-tag-trigger-rgd.yaml

Write-Host "===> Step 2: Applying Kpack ClusterBuilder and Stack..." -ForegroundColor Cyan
kubectl apply -f k8s/kpack/cluster-builder.yaml

Write-Host "===> Step 3: Applying Argo Events EventBus and Sensor..." -ForegroundColor Cyan
kubectl apply -f k8s/argo/events/gitlab-tag-sensor.yaml

Write-Host "===> Step 4: Applying Argo Workflows Semaphore and Templates..." -ForegroundColor Cyan
kubectl apply -f k8s/argo/workflows/workflow-semaphore-configmap.yaml
kubectl apply -f k8s/argo/workflows/kpack-build-workflow-template.yaml

Write-Host "===> Step 5: Applying Platform API Workload & Storage Manifests..." -ForegroundColor Cyan
kubectl apply -f k8s/platform/00-namespace.yaml
kubectl apply -f k8s/platform/01-rbac.yaml
kubectl apply -f k8s/platform/02-configmap-secret.yaml
kubectl apply -f k8s/platform/03-pvc.yaml
kubectl apply -f k8s/platform/04-deployment.yaml
kubectl apply -f k8s/platform/05-service.yaml
kubectl apply -f k8s/platform/06-ingress.yaml

Write-Host "Platform manifests deployed successfully." -ForegroundColor Green

