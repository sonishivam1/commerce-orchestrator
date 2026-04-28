---
description: Infrastructure and deployment rules — auto-loads when editing Dockerfiles, cloudbuild.yaml, terraform files, or services.yaml
globs:
  - "Dockerfile*"
  - "cloudbuild.yaml"
  - "services.yaml"
  - "terraform/**/*.tf"
  - "terraform/**/*.tfvars"
  - "**/service.yaml"
  - "docker-compose*.yml"
---

# Infrastructure Rules (Auto-loaded for Dockerfile, cloudbuild, terraform, services.yaml)

## Deployment Platform
- **Target:** Google Cloud Run (serverless, per-request scaling)
- **Registry:** Google Artifact Registry
- **Build:** Cloud Build via `cloudbuild.yaml`
- **IaC:** Terraform (`terraform/` directory)
- **Secrets:** Google Cloud Secret Manager — never env vars for secrets in production

## Docker Rules

### Always Use the Template Pattern
New services use `Dockerfile.template` as the base — substitute `SERVICE_NAME`:
```dockerfile
# Multi-stage build (required for all services)
# Stage 1: dependencies
# Stage 2: builder (TypeScript compile)
# Stage 3: prod-dependencies (strip devDependencies)
# Stage 4: runner (minimal production image)
```

### Base Image
- Always `node:20-alpine` — never use `node:latest` or a specific patch version without team alignment
- Alpine for production — smaller image, fewer vulnerabilities

### Security in Docker
- Never `COPY .env` into the image — secrets come from Cloud Run environment at runtime
- Run as non-root user in production stage
- No dev tools in production image (`npm ci --only=production`)

## Cloud Run Configuration (services.yaml)

### Sizing Guidelines
| Service Type | Min Instances | Max Instances | Memory | CPU |
|-------------|---------------|---------------|--------|-----|
| Critical (auth, gateway) | 1 | 10 | 512Mi | 1 |
| Standard services | 0 | 5 | 512Mi | 1 |
| Heavy processing (data, aeo) | 0 | 5 | 1Gi | 2 |
| Agent commerce | 0 | 3 | 1Gi | 2 |

### Timeout
- Standard API services: 60s
- Long-running (AI, data processing): 300s
- Never exceed 3600s (Cloud Run limit)

### Concurrency
- Default: 80 concurrent requests per instance
- Reduce for memory-intensive operations (AI/LLM calls): 10-20

## Secrets Management
```yaml
# CORRECT — reference Secret Manager in service.yaml
env:
  - name: MONGODB_URI
    valueFrom:
      secretKeyRef:
        name: mongodb-uri
        key: latest

# WRONG — never hardcode in service.yaml
env:
  - name: MONGODB_URI
    value: "mongodb+srv://user:password@cluster..."
```

## Terraform Rules
- Never hardcode project IDs or region — use variables
- State backend: Google Cloud Storage (never local state)
- Use separate tfvars files per environment (`dev.tfvars`, `prod.tfvars`)
- Tag all resources with `environment` and `service` labels

## Cloud Build Rules
- `cloudbuild.yaml` uses substitution variables (`$_SERVICE_NAME`, `$_ENV`)
- Build steps: install → build → docker build → push → deploy
- Always use Cloud Build service account — never personal credentials
- Build artifacts cached in Artifact Registry layers

## What NOT to Do
- Never deploy directly from a local machine to production — all deployments via Cloud Build
- Never modify `services.yaml` min-instances to 0 for auth-service or gateway (cold start latency)
- Never add a new service to CI/CD without capacity planning (memory/CPU sizing)
- Never store secrets in `cloudbuild.yaml` substitution variables — use Secret Manager
