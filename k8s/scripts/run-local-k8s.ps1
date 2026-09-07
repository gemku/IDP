#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploys the Internal Developer Platform application to a local Kind Kubernetes cluster.
.DESCRIPTION
    Automates Kind cluster setup, building Docker container images, loading them into the cluster,
    applying Kubernetes manifests, and verifying deployment rollout.
#>

$ErrorActionPreference = "Stop"

$WorkspaceRoot = (Get-Item $PSScriptRoot).Parent.Parent.FullName
$WslWorkspace = "/mnt/c" + ($WorkspaceRoot.Substring(2).Replace('\', '/'))
$ClusterName = "platform-dev"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Deploying Platform App to Local Kubernetes (Kind)      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check WSL and Docker
Write-Host "`n[1/6] Verifying Docker environment in WSL2..." -ForegroundColor Yellow
$dockerCheck = wsl -e docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker daemon is not running in WSL2. Please ensure Docker is running."
}
Write-Host "Docker engine is ready." -ForegroundColor Green

# 2. Check/Create Kind Cluster
Write-Host "`n[2/6] Ensuring Kind cluster '$ClusterName' exists..." -ForegroundColor Yellow
$clusters = wsl -e kind get clusters 2>&1
if ($clusters -notcontains $ClusterName) {
    Write-Host "Creating Kind cluster '$ClusterName' using k8s/kind-config.yaml..." -ForegroundColor Cyan
    wsl -e kind create cluster --config "$WslWorkspace/k8s/kind-config.yaml"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create Kind cluster."
    }
} else {
    Write-Host "Kind cluster '$ClusterName' is already running." -ForegroundColor Green
}

# 3. Build Docker Images
Write-Host "`n[3/6] Building Backend and Frontend Docker images..." -ForegroundColor Yellow
Write-Host "--> Building platform-backend:latest..." -ForegroundColor Gray
wsl -e docker build -f "$WslWorkspace/Dockerfile.backend" -t platform-backend:latest "$WslWorkspace"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build platform-backend image."
}

Write-Host "--> Building platform-frontend:latest..." -ForegroundColor Gray
wsl -e docker build -f "$WslWorkspace/Dockerfile.frontend" -t platform-frontend:latest "$WslWorkspace"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build platform-frontend image."
}
Write-Host "Docker images built successfully." -ForegroundColor Green

# 4. Load Images into Kind Cluster
Write-Host "`n[4/6] Loading images into Kind cluster '$ClusterName'..." -ForegroundColor Yellow
wsl -e kind load docker-image platform-backend:latest platform-frontend:latest --name $ClusterName
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to load images into Kind cluster."
}
Write-Host "Images loaded into Kind." -ForegroundColor Green

# 5. Apply Platform Workload Manifests
Write-Host "`n[5/6] Applying Platform Kubernetes manifests..." -ForegroundColor Yellow
$manifests = @(
    "00-namespace.yaml",
    "01-rbac.yaml",
    "02-configmap-secret.yaml",
    "03-pvc.yaml",
    "04-backend-deployment.yaml",
    "04-frontend-deployment.yaml",
    "05-service.yaml",
    "06-ingress.yaml"
)

foreach ($manifest in $manifests) {
    $manifestPath = "$WslWorkspace/k8s/platform/$manifest"
    Write-Host "  -> Applying $manifest" -ForegroundColor Gray
    wsl -e kubectl apply -f $manifestPath
}

# 6. Wait for Rollout Status
Write-Host "`n[6/6] Waiting for workload rollout to complete..." -ForegroundColor Yellow
wsl -e kubectl rollout status deployment/platform-backend -n platform-system --timeout=120s
wsl -e kubectl rollout status deployment/platform-frontend -n platform-system --timeout=120s

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   Platform application is running successfully!          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Frontend App:   http://localhost:8080 (via frontend proxy)"
Write-Host "Backend API:    http://localhost:3000 (via NodePort 30000)"
Write-Host "Backend Health: http://localhost:8080/api/health/ready"
Write-Host "Namespace:      platform-system"
Write-Host "`nTo start/keep port-forwarding frontend to 8080:"
Write-Host "  wsl kubectl port-forward -n platform-system svc/platform-frontend-svc 8080:80 --address 0.0.0.0"
Write-Host "`nUseful commands:"
Write-Host "  wsl kubectl get pods -n platform-system"
Write-Host "  wsl kubectl logs -n platform-system -l app.kubernetes.io/name=platform-backend -f"
Write-Host "  wsl kubectl logs -n platform-system -l app.kubernetes.io/name=platform-frontend -f"
