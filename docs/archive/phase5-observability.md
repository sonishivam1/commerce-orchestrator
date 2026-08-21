# Sub-Plan: Phase 5 — Observability + Production Hardening

> **Status:** AWAITING APPROVAL  
> **Priority:** 🟢 Lower — Polish after everything works end-to-end  
> **Depends on:** All previous phases complete  
> **Blocks:** Production deployment readiness  
> **Skill references:** `.claude/skills/bullmq-jobs/SKILL.md`  
> **Agent:** `backend-architect`  
> **Rules:** `.claude/rules/security.md`, `.claude/rules/nest-api.md`

---

## Problem Statement

The system is functionally complete after Phases 1–4 but is not production-ready:

1. **`console.log` / `console.error` scattered across codebase** — violates the "Pino everywhere" rule; no structured JSON logs in production.
2. **No `AsyncLocalStorage` context propagation** — `tenantId`, `jobId`, `traceId` are not automatically threaded through worker job execution for structured logging.
3. **No health check endpoint** — `GET /health` doesn't exist; load balancers cannot determine if the API is alive.
4. **No rate limiting** — Any tenant can flood the GraphQL API without throttling.
5. **`docker-compose.yml` only covers infra** (MongoDB + Redis) — does not include `api`, `worker-etl`, `worker-scrape`. One-command local dev is impossible.
6. **No `.env.example`** — Onboarding a new developer requires reading the code to discover required env vars.
7. **No CI pipeline** — No automated typecheck, lint, or test on PRs.

---

## Acceptance Criteria

- [ ] Zero `console.log`, `console.warn`, `console.error` anywhere in the codebase
- [ ] All apps use Pino logger (`@nestjs/common` `Logger` uses Pino transport)
- [ ] Every log line includes: `tenantId`, `jobId`, `traceId`, `correlationId` where available
- [ ] `AsyncLocalStorage` propagates job context through entire worker execution
- [ ] `GET /health` returns `{ status: 'ok' | 'degraded', mongo: boolean, redis: boolean }`
- [ ] Rate limiting: 100 req/min per tenant — exceeded requests return HTTP 429
- [ ] `docker compose up` starts all 5 services: `mongodb`, `redis`, `api`, `worker-etl`, `worker-scrape`
- [ ] `.env.example` documents every required environment variable with description and example value
- [ ] `.github/workflows/ci.yml` runs on every PR: typecheck + lint + unit tests
- [ ] `npx tsc --noEmit` = 0 errors across the entire monorepo

---

## Files to Change

### CREATE

| File | Purpose |
|------|---------|
| `apps/api/src/common/logger/pino.logger.ts` | Custom NestJS logger using `pino` |
| `apps/worker-etl/src/common/logger/pino.logger.ts` | Same for ETL worker |
| `apps/worker-scrape/src/common/logger/pino.logger.ts` | Same for scrape worker |
| `apps/worker-etl/src/common/context/async-context.service.ts` | ALS for job context propagation |
| `apps/worker-scrape/src/common/context/async-context.service.ts` | Same for scrape worker |
| `apps/api/src/modules/health/health.controller.ts` | `GET /health` endpoint |
| `apps/api/src/modules/health/health.module.ts` | Health module |
| `apps/api/src/common/guards/rate-limit.guard.ts` | Redis-based rate limiting |
| `docker-compose.yml` | Full stack — all 5 services |
| `.env.example` | All env vars documented |
| `.github/workflows/ci.yml` | CI pipeline |

### MODIFY

| File | Change |
|------|--------|
| `apps/api/src/main.ts` | Use `PinoLogger` as NestJS logger |
| `apps/worker-etl/src/main.ts` | Use `PinoLogger` |
| `apps/worker-scrape/src/main.ts` | Use `PinoLogger` |
| `apps/api/src/app.module.ts` | Import `HealthModule`; register `RateLimitGuard` globally |
| `apps/worker-etl/src/orchestrator/data-etl.orchestrator.ts` | Use `AsyncContextService` for log context |
| `apps/worker-scrape/src/orchestrator/scrape.orchestrator.ts` | Use `AsyncContextService` |
| All files with `console.log/warn/error` | Replace with Pino logger calls |

---

## Implementation Detail

### 1. Pino Logger

```typescript
// apps/api/src/common/logger/pino.logger.ts
import { LoggerService } from '@nestjs/common';
import pino from 'pino';

export class PinoLogger implements LoggerService {
    private readonly logger = pino({
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    });

    log(msg: string | object, context?: string) {
        this.logger.info(typeof msg === 'string' ? { msg, context } : { ...msg, context });
    }

    error(msg: string | object, trace?: string, context?: string) {
        this.logger.error(typeof msg === 'string' ? { msg, trace, context } : { ...msg, trace, context });
    }

    warn(msg: string | object, context?: string) {
        this.logger.warn(typeof msg === 'string' ? { msg, context } : { ...msg, context });
    }

    debug(msg: string | object, context?: string) {
        this.logger.debug(typeof msg === 'string' ? { msg, context } : { ...msg, context });
    }
}
```

**Wire in `main.ts`:**
```typescript
const app = await NestFactory.create(AppModule, { logger: new PinoLogger() });
```

### 2. AsyncLocalStorage — Job Context Propagation

```typescript
// apps/worker-etl/src/common/context/async-context.service.ts
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface JobContext {
    tenantId: string;
    jobId: string;
    traceId: string;
    correlationId: string;
}

@Injectable()
export class AsyncContextService {
    private readonly storage = new AsyncLocalStorage<JobContext>();

    run<T>(context: JobContext, fn: () => T): T {
        return this.storage.run(context, fn);
    }

    get(): JobContext | undefined {
        return this.storage.getStore();
    }

    getOrThrow(): JobContext {
        const ctx = this.storage.getStore();
        if (!ctx) throw new Error('No job context available in AsyncLocalStorage');
        return ctx;
    }
}
```

**Usage in ETL processor:**
```typescript
// Wrap the entire process() body in asyncContext.run()
await this.asyncContext.run({ tenantId, jobId, traceId: correlationId, correlationId }, async () => {
    await this.orchestrator.execute(config);
});
```

### 3. Health Check Endpoint

```typescript
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_ETL } from '@cdo/shared';

@Controller('health')
export class HealthController {
    constructor(
        @InjectConnection() private readonly mongoConnection: Connection,
        @InjectQueue(QUEUE_ETL) private readonly etlQueue: Queue,
    ) {}

    @Get()
    async check() {
        const mongo = this.mongoConnection.readyState === 1;
        let redis = false;
        try {
            await this.etlQueue.client.ping();
            redis = true;
        } catch {}

        const status = mongo && redis ? 'ok' : 'degraded';
        return { status, mongo, redis, timestamp: new Date().toISOString() };
    }
}
```

### 4. Rate Limiting Guard

```typescript
// apps/api/src/common/guards/rate-limit.guard.ts
import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const RATE_LIMIT = 100;
const WINDOW_SECONDS = 60;

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(@InjectQueue('etl-queue') private queue: Queue) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const gqlCtx = GqlExecutionContext.create(context);
        const { req } = gqlCtx.getContext();
        const tenantId = req?.user?.tenantId;
        if (!tenantId) return true; // Anonymous — handled by auth guard

        const key = `rate:${tenantId}`;
        const client = this.queue.client;

        const current = await client.incr(key);
        if (current === 1) {
            await client.expire(key, WINDOW_SECONDS);
        }

        if (current > RATE_LIMIT) {
            throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
        }

        return true;
    }
}
```

### 5. Full `docker-compose.yml`

```yaml
version: '3.9'

services:
  mongodb:
    image: mongo:6
    ports: ['27017:27017']
    volumes: ['mongo-data:/data/db']
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', 'db.adminCommand("ping")']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports: ['4000:4000']
    env_file: .env.local
    depends_on:
      mongodb: { condition: service_healthy }
      redis: { condition: service_healthy }

  worker-etl:
    build:
      context: .
      dockerfile: apps/worker-etl/Dockerfile
    env_file: .env.local
    depends_on:
      mongodb: { condition: service_healthy }
      redis: { condition: service_healthy }

  worker-scrape:
    build:
      context: .
      dockerfile: apps/worker-scrape/Dockerfile
    env_file: .env.local
    depends_on:
      mongodb: { condition: service_healthy }
      redis: { condition: service_healthy }

volumes:
  mongo-data:
```

> **Note:** Dockerfiles for each app need to be created (`apps/api/Dockerfile`, etc.). Each uses a multi-stage build: `pnpm install` → `turbo build --filter={app}` → copy `dist/`.

### 6. `.env.example`

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/commerce-orchestrator

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Auth
JWT_SECRET=your-super-secret-jwt-key-minimum-32-chars
JWT_EXPIRY=7d

# Encryption (AES-256-GCM — must be 64 hex characters = 32 bytes)
CREDENTIAL_KEY=0000000000000000000000000000000000000000000000000000000000000000

# API
API_PORT=4000
GRAPHQL_SCHEMA_URL=http://localhost:4000/graphql

# Logging
LOG_LEVEL=info   # debug | info | warn | error
NODE_ENV=development
```

### 7. CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [develop-v1]
  pull_request:
    branches: [main]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: npx tsc --noEmit

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 8 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
```

### 8. Console.log Cleanup Scope

Files with known `console.log/error/warn` violations (from code review):

| File | Violation |
|------|-----------|
| `packages/db/src/database.module.ts` | `console.log` in dev path |
| `packages/redis/src/index.ts` | `console.log` Redis connection |
| `packages/connectors/src/commercetools/ct-source.connector.ts` | `console.error` per-item skip |
| `packages/ingestion/src/scraper/scraper.service.ts` | `console.log` scrape events |
| `apps/worker-etl/src/processors/scrape/scrape.processor.ts` | `console.log` (stub — will be deleted) |

Replace all with the appropriate Pino logger call. In packages (which cannot use NestJS Logger directly), use a lightweight Pino instance passed via constructor.

---

## Dependency Install

```bash
pnpm add pino pino-pretty --filter @cdo/api
pnpm add pino pino-pretty --filter @cdo/worker-etl
pnpm add pino pino-pretty --filter @cdo/worker-scrape
pnpm add @nestjs/terminus --filter @cdo/api   # Health checks
```

---

## Test Plan

### Manual Integration Tests

| Test | Steps | Expected |
|------|-------|----------|
| Health check — healthy | `GET /health` with Mongo + Redis running | `{ status: 'ok', mongo: true, redis: true }` |
| Health check — degraded | Stop Redis, `GET /health` | `{ status: 'degraded', mongo: true, redis: false }` |
| Rate limit | 101 GraphQL requests in 60s for same tenant | 101st returns HTTP 429 |
| Docker compose | `docker compose up` | All services start, API accessible at `:4000` |
| Structured logs | Run a job, check logs | JSON with `tenantId`, `jobId`, `traceId` on every line |

---

## Out of Scope for This Plan

- OpenTelemetry / distributed tracing (Jaeger, Zipkin) — deferred post-MVP
- Prometheus metrics endpoint — deferred post-MVP
- Kubernetes manifests — deferred post-MVP
- Multi-region Redis setup — deferred post-MVP
