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
cd apps/worker && pnpm dev   # currently apps/worker-etl — see 00-simplification-plan.md
cd apps/web && pnpm dev
```

## First run
Register an org in the web UI, add a source connection (and a target connection
for a `MIGRATE` project), create a project, then start a run — or call the
`createMigrationRun` GraphQL mutation directly to enqueue a `MIGRATION_RUN` job.
