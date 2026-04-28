---
name: devops-deployment
description: DevOps and deployment skill for Metafy AI Platform. Encodes the Google Cloud Run deployment workflow, Docker multi-stage build pattern, Cloud Build pipeline, Terraform IaC, secrets management, environment promotion, and runbook for deploying a service to production.
user-invocable: true
---

# DevOps & Deployment Skill — Metafy AI Platform

## Deployment Stack
- **Platform:** Google Cloud Run (serverless, per-request auto-scaling)
- **Container Registry:** Google Artifact Registry
- **CI/CD:** Cloud Build triggered by git push
- **IaC:** Terraform (`terraform/`)
- **Secrets:** Google Cloud Secret Manager
- **Orchestration:** `Dockerfile.template` + `cloudbuild.yaml` + `services.yaml`

---

## Deployment Flow (end-to-end)

```
Developer pushes to branch
  → Cloud Build trigger fires
    → Install dependencies (npm ci)
    → Build TypeScript (npm run build)
    → Docker multi-stage build
    → Push image to Artifact Registry
    → Deploy to Cloud Run (dev/staging/prod based on branch)
```

---

## Docker Multi-Stage Build Pattern

All services use `Dockerfile.template` with `SERVICE_NAME` substitution:

```dockerfile
# Stage 1: Install all dependencies (including devDeps for build)
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/${SERVICE_NAME}/package*.json ./apps/${SERVICE_NAME}/
COPY packages/*/package*.json ./packages/*/
RUN npm ci --prefer-offline

# Stage 2: Build TypeScript
FROM dependencies AS builder
COPY . .
RUN npm run build:packages
RUN npm run build --workspace=apps/${SERVICE_NAME}

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/${SERVICE_NAME}/package*.json ./apps/${SERVICE_NAME}/
RUN npm ci --only=production --prefer-offline

# Stage 4: Minimal production image
FROM node:20-alpine AS runner
WORKDIR /app
# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/apps/${SERVICE_NAME}/dist ./dist
USER appuser
EXPOSE ${PORT}
CMD ["node", "dist/main.js"]
```

**Rules:**
- Never `COPY .env` into the image
- Always use `node:20-alpine` (not `node:latest`)
- Always run as non-root in production stage
- `npm ci --only=production` in runner stage (no devDependencies)

---

## Cloud Build Pipeline (cloudbuild.yaml)

```yaml
steps:
  - name: 'node:20-alpine'
    id: 'install'
    entrypoint: npm
    args: ['ci', '--prefer-offline']

  - name: 'node:20-alpine'
    id: 'build'
    entrypoint: npm
    args: ['run', 'build', '--workspace=apps/${_SERVICE_NAME}']

  - name: 'gcr.io/cloud-builders/docker'
    id: 'docker-build'
    args:
      - build
      - '--build-arg=SERVICE_NAME=${_SERVICE_NAME}'
      - '--tag=REGION-docker.pkg.dev/${PROJECT_ID}/metafy/${_SERVICE_NAME}:${SHORT_SHA}'
      - '--tag=REGION-docker.pkg.dev/${PROJECT_ID}/metafy/${_SERVICE_NAME}:latest'
      - '-f'
      - 'Dockerfile.template'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    id: 'docker-push'
    args: ['push', '--all-tags', 'REGION-docker.pkg.dev/${PROJECT_ID}/metafy/${_SERVICE_NAME}']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - ${_SERVICE_NAME}
      - '--image=REGION-docker.pkg.dev/${PROJECT_ID}/metafy/${_SERVICE_NAME}:${SHORT_SHA}'
      - '--region=${_REGION}'
      - '--project=${PROJECT_ID}'

substitutions:
  _SERVICE_NAME: 'product-service'
  _REGION: 'us-central1'
```

---

## Cloud Run Service Configuration (services.yaml)

```yaml
# services.yaml — per-service Cloud Run settings
services:
  product-service:
    minInstances: 0          # scale to zero (cost saving)
    maxInstances: 5
    memory: 512Mi
    cpu: 1
    timeoutSeconds: 60
    concurrency: 80

  gateway:
    minInstances: 1          # always warm (critical path)
    maxInstances: 10
    memory: 512Mi
    cpu: 1
    timeoutSeconds: 30
    concurrency: 100

  agent-commerce-service:
    minInstances: 0
    maxInstances: 3
    memory: 1Gi              # LLM calls are memory-intensive
    cpu: 2
    timeoutSeconds: 300      # long-running agent loops
    concurrency: 20          # fewer concurrent to avoid OOM

  aeo-service:
    minInstances: 0
    maxInstances: 5
    memory: 1Gi
    cpu: 2
    timeoutSeconds: 120
    concurrency: 40
```

---

## Secrets Management

**Rule:** No secrets in env vars in code. All secrets via Cloud Secret Manager.

```bash
# Create a secret
gcloud secrets create mongodb-uri --replication-policy="automatic"
echo -n "mongodb+srv://..." | gcloud secrets versions add mongodb-uri --data-file=-

# Grant Cloud Run service account access
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:SA@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

In `service.yaml` / Cloud Run config:
```yaml
env:
  - name: MONGODB_URI
    valueFrom:
      secretKeyRef:
        name: mongodb-uri
        key: latest
```

---

## Environment Promotion Flow

```
feature-branch → dev (auto-deploy)
metafy-develop → staging (auto-deploy)
release/* → production (manual approval gate)
```

**Never deploy to production from a local machine.**

---

## Terraform Structure

```
terraform/
  modules/
    cloud-run/          # Reusable Cloud Run service module
    secret-manager/     # Secret management module
    artifact-registry/  # Container registry
    vpc/               # Network config
  envs/
    dev/
      main.tf
      dev.tfvars
    staging/
      main.tf
      staging.tfvars
    prod/
      main.tf
      prod.tfvars
```

```bash
# Deploy infrastructure changes
cd terraform/envs/dev
terraform init
terraform plan -var-file=dev.tfvars
terraform apply -var-file=dev.tfvars

# NEVER apply prod without plan review
terraform plan -var-file=prod.tfvars -out=prod.plan
# ... review plan ...
terraform apply prod.plan
```

---

## Deployment Runbook — Adding a New Service

1. Create service directory and scaffold (use `/new-service` command)
2. Add service to `services.yaml` with appropriate sizing
3. Add Cloud Build trigger for the new service in Cloud Build console
4. Create secrets in Secret Manager for service-specific env vars
5. Grant service account access to required secrets
6. Add Terraform resource for the new Cloud Run service
7. Add `terraform plan` → review → `terraform apply` in dev
8. Test in dev environment
9. Promote to staging → smoke test
10. Promote to production with manual approval

---

## Rollback Procedure

```bash
# List recent revisions
gcloud run revisions list --service=product-service --region=us-central1

# Rollback: route 100% traffic to previous revision
gcloud run services update-traffic product-service \
  --to-revisions=product-service-00042-xyz=100 \
  --region=us-central1
```

---

## Cost Control

- Scale-to-zero on all non-critical services (minInstances: 0)
- gateway and auth-service: minInstances: 1 (latency SLA)
- Use `--concurrency` tuning — higher concurrency = fewer instances needed
- Spot/preemptible not available on Cloud Run — control via max-instances
- Monitor spend: Cloud Console → Billing → by service label
