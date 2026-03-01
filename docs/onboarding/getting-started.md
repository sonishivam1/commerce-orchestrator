# Getting Started

## Prerequisites
- Node.js >= 18
- pnpm >= 8.x
- Docker & Docker Compose (for Postgres/MongoDB/Redis)

## Installation
1. Clone the repository entirely.
2. Run `pnpm install` in the monorepo root. This orchestrates dependency linking across `apps` and `packages` automatically.

## Local Infrastructure
Run the backing services using Docker Compose from the root:
```bash
docker-compose up -d redis mongo
```

## Running the Architecture (Dev Mode)
Because this is a decoupled monorepo, you must run the processes simultaneously or rely on Turbo.

Run everything:
```bash
pnpm turbo run dev
```

Or run individual apps natively (useful for debugging):
```bash
cd apps/api && pnpm dev
cd apps/worker-etl && pnpm dev
cd apps/web && pnpm dev
```

## First Job Execution Hook
Until the frontend forms are fully configured, you can dispatch workloads by executing a GraphQL Mutation against the API layer, which will enqueue it to the Redis Worker loop for execution.
