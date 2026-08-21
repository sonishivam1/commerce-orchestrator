# 📋 Commerce Data Orchestrator — Full Implementation Plan

> **Goal**: Turn the scaffolded structure into a fully working, production-grade ETL SaaS platform.
> **Philosophy**: Each phase must be 100% complete before moving to the next. Every phase produces something that is independently testable.

---

## 🗺️ Phase Map

```
Phase 0 → Foundation Layer     (DB schemas, Auth, Queue config, Zod validators)
Phase 1 → Core Pipeline        (EtlEngine + Connectors + Mapping + Ingestion)
Phase 2 → API Control Plane    (GraphQL resolvers wired to DB + Queue)
Phase 3 → Worker Planes        (ETL + Scrape processors wired to Orchestrator)
Phase 4 → Web Frontend         (Next.js pages wired to Apollo + real GraphQL)
Phase 5 → Observability + Prod (Logging, Tracing, Error handling, CI/CD)
```

---

## ✅ Phase 0 — Foundation Layer
> **Why first**: Every other phase depends on the data layer, queue, auth, and validation contracts being solid.

### 0.1 — `packages/shared` — Zod Validation Schemas

**What**: Add Zod runtime validation to every Canonical model. TypeScript types alone don't catch bad data at runtime — Zod does.

**Files to create/update**:
- `packages/shared/src/models/canonical.types.ts` — verify all fields (CanonicalProduct, CanonicalCategory, CanonicalCustomer, CanonicalOrder, CanonicalVariant, Money, Address) are fully defined
- `packages/shared/src/validators/product.validator.ts` — `ZodCanonicalProduct` schema
- `packages/shared/src/validators/category.validator.ts`
- `packages/shared/src/validators/customer.validator.ts`
- `packages/shared/src/validators/order.validator.ts`
- `packages/shared/src/validators/index.ts` — barrel export

**Key decisions**:
- `Money.amount` must be integer (cents), never float
- `name` and `description` must be `Record<string, string>` for i18n (locale → value)
- `CanonicalProduct.key` is the system-wide idempotency key per tenant; must be unique and URL-safe

---

### 0.2 — `packages/db` — Mongoose Module + DLQ Schema

**What**: Complete the `@cdo/db` NestJS module so it can be imported by API and Workers.

**Files to create/update**:
- `packages/db/src/database.module.ts` — `MongooseModule.forRootAsync()` reading `MONGODB_URI` from env
- `packages/db/src/schemas/dlq.schema.ts` — Dead Letter Queue item schema with: `tenantId`, `jobId`, `itemKey`, `errorType ('ValidationError'|'TransientError')`, `errorMessage`, `rawPayload (Object)`, `canReplay (boolean)`, `createdAt`
- `packages/db/src/repositories/dlq.repository.ts` — `findAllForJob()`, `markReplayed()`, `create()`
- `packages/db/src/index.ts` — add DLQ exports

**Key decisions**:
- `DatabaseModule` should be `@Global()` — imported once in root AppModule, available everywhere
- Every schema **must** have `tenantId` index — this is non-negotiable for multi-tenancy

---

### 0.3 — `packages/queue` — BullMQ Module

**What**: Complete the `@cdo/queue` NestJS module so it connects to Redis and registers both queues.

**Files to create/update**:
- `packages/queue/src/queue.module.ts` — `BullModule.forRootAsync()` + `BullModule.registerQueue('etl-queue', 'scrape-queue')`
- `packages/queue/src/producers/job.producer.ts` — already stubbed, wire the real `Queue` injection
- `packages/queue/src/index.ts` — export `QueueModule` + `JobProducer`

**Key decisions**:
- Queue names `'etl-queue'` and `'scrape-queue'` must be constants, not magic strings — put them in `packages/shared/src/constants.ts`
- BullMQ job options: `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`, `removeOnFail: false` (DLQ relies on BullMQ failed jobs)

---

### 0.4 — `packages/auth` — JWT Module + Guards

**What**: Complete the `@cdo/auth` NestJS module with JWT strategy and all guards fully wired.

**Files to create/update**:
- `packages/auth/src/auth.module.ts` — `JwtModule.registerAsync()` + `PassportModule` + `JwtStrategy` provider
- `packages/auth/src/guards/gql-auth.guard.ts` — already stubbed, make it production-ready
- `packages/auth/src/decorators/current-tenant.decorator.ts` — already done
- `packages/auth/src/strategies/jwt.strategy.ts` — already done

**Key decisions**:
- `JWT_SECRET` must come from env, never hardcoded
- Guard should extract and validate `tenantId` from JWT `sub` claim
- Decorate all non-public resolvers with `@UseGuards(GqlAuthGuard)`

---

### 0.5 — Shared Constants File

**Files to create**:
- `packages/shared/src/constants.ts` — queue names, job kinds, max retry count, DLQ constants

**Done when Phase 0 is complete**:
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `DatabaseModule` can connect to a local MongoDB
- [ ] `QueueModule` can connect to local Redis
- [ ] JwtStrategy validates a real JWT
- [ ] All Zod schemas validate correctly with a unit test

---

## ✅ Phase 1 — Core Pipeline Layer
> **Why second**: The pipeline is the heart. Build and test it with unit tests before wiring it to real infrastructure.

### 1.1 — `packages/core` — Finalize EtlEngine

**What**: The existing `EtlEngine` is close but needs a few things completed.

**Files to update**:
- `packages/core/src/engine/etl.engine.ts`:
  - Add `batchSize` streaming from `EtlEngineOptions`
  - Add per-item retry logic with configurable `maxRetries`
  - Classify errors using `ErrorType` enum from `@cdo/shared`
  - Emit typed events: `'progress'` (batch level), `'failure'` (item level), `'complete'`
  - Accept a `circuitBreaker` callback for FatalError handling

**Files to create**:
- `packages/core/src/engine/circuit-breaker.ts` — tracks consecutive failures, trips at threshold
- `packages/core/src/engine/retry.ts` — exponential backoff utility
- `packages/core/src/__tests__/etl.engine.spec.ts` — unit tests with mock source/target connectors

---

### 1.2 — `packages/mapping` — Normalization + Rule Engine + Zod Validation

**What**: This is real business logic. The mapping layer turns raw SDK objects into `CanonicalProduct`. This is the most critical package.

**Files to create**:
- `packages/mapping/src/normalizers/money.normalizer.ts` — converts `"1,200.50 USD"` → `{ amount: 120050, currency: 'USD', currencyCode: 'USD' }`
- `packages/mapping/src/normalizers/locale.normalizer.ts` — flattens locale strings into `Record<string, string>`
- `packages/mapping/src/normalizers/date.normalizer.ts` — any date string → ISO 8601
- `packages/mapping/src/rules-engine/shopify.rules.ts` — maps Shopify Admin API `ProductNode` → `CanonicalProduct`
- `packages/mapping/src/rules-engine/commercetools.rules.ts` — maps CT `ProductProjection` → `CanonicalProduct`
- `packages/mapping/src/rules-engine/scrape.rules.ts` — maps normalized raw HTML JSON → `CanonicalProduct` (with AI fallback hook)
- `packages/mapping/src/mappers/product.mapper.ts` — orchestrates: normalizer → rules → Zod validate
- `packages/mapping/src/mappers/category.mapper.ts`
- `packages/mapping/src/mappers/customer.mapper.ts`
- `packages/mapping/src/__tests__/product.mapper.spec.ts`

**Key decisions**:
- Always run Zod validation at the end of every mapper — never load an unvalidated canonical model
- If Zod fails → throw `ValidationError` → Core Engine catches it → DLQ
- Money is ALWAYS stored as integer cents

---

### 1.3 — `packages/connectors` — Real Connector Implementations

**What**: Replace stubs with real API calls. Start with commercetools (source + target) as the highest priority connector.

#### 1.3.1 — commercetools Source Connector
**Files to create/update**:
- `packages/connectors/src/commercetools/ct-source.connector.ts`:
  - Install `@commercetools/platform-sdk`
  - `initialize()` → build CT client with `ProjectApiRoot` using credential fields: `clientId`, `clientSecret`, `projectKey`, `authUrl`, `apiUrl`
  - `extract()` → use CT `products.get()` with `withTotal: false`, paginate via `lastId` cursor
  - Map each `ProductProjection` via `@cdo/mapping` CT rules
  - Yield batches of `CanonicalProduct[]`

#### 1.3.2 — commercetools Target Connector
**Files to create/update**:
- `packages/connectors/src/commercetools/ct-target.connector.ts`:
  - `load(batch)` → call CT Import API (`@commercetools/importapi-sdk`) for products — idempotent upsert by `key`
  - `getCapabilities()` → `['UPSERT_PRODUCT', 'UPSERT_CATEGORY', 'DEPLOY_SCHEMA', 'EXTRACT_SCHEMA']`
  - For `PLATFORM_CLONE`: implement `extractSchema()` — pulls CustomTypes, Channels, TaxCategories
  - For `PLATFORM_CLONE`: implement `deploySchema()` — upserts schema entities to target project

#### 1.3.3 — Shopify Source Connector
**Files to create/update**:
- `packages/connectors/src/shopify/shopify-source.connector.ts`:
  - Use Shopify Admin REST API (or GraphQL Admin API)
  - Credential fields: `shopDomain`, `accessToken`, `apiVersion`
  - Paginate via cursor from `link` header (REST) or `pageInfo.endCursor` (GraphQL)
  - Map via `@cdo/mapping` Shopify rules

#### 1.3.4 — Connector Factory
**Files to create**:
- `packages/connectors/src/factory/connector.factory.ts` — `ConnectorFactory.createSource(platform, credentials)` + `ConnectorFactory.createTarget(platform, credentials)` — returns the right connector based on `Platform` enum

---

### 1.4 — `packages/ingestion` — Playwright Scraper

**Files to create/update**:
- `packages/ingestion/src/scraper/scraper.service.ts` — real Playwright implementation:
  - Launch headless Chromium
  - Navigate to URL with stealth (anti-detection headers)
  - Extract all `<script type="application/ld+json">` and visible text blocks
  - Return raw JSON array
- `packages/ingestion/src/parsers/jsonld.parser.ts` — parse JSON-LD → flat product object
- `packages/ingestion/src/parsers/html.parser.ts` — fallback HTML extraction

**Done when Phase 1 is complete**:
- [ ] Can run a CROSS_PLATFORM_MIGRATION fully in a unit test with mock credentials
- [ ] Zod validates CanonicalProduct correctly
- [ ] Money normalization is tested
- [ ] ConnectorFactory creates correct connector for each platform enum
- [ ] `npx tsc --noEmit` = 0 errors

---

## ✅ Phase 2 — API Control Plane
> **Why third**: API is the public interface. Build it after the internal engines are solid so we know exactly what inputs/outputs look like.

### 2.1 — `apps/api` — App Module Wiring

**Files to update**:
- `apps/api/src/app.module.ts` — import `DatabaseModule`, `QueueModule`, `AuthModule` from packages; import all feature modules

### 2.2 — Auth Module (API-side)

**Files to create**:
- `apps/api/src/modules/auth/auth.service.ts`:
  - `login(email, password)` → find tenant, `bcrypt.compare()`, sign JWT
  - `register(input)` → hash password, create tenant in DB, sign JWT
- `apps/api/src/modules/auth/auth.resolver.ts`:
  - `@Mutation() login(email, password)` → returns `AuthPayload { accessToken, tenantId }`
  - `@Mutation() createTenant(input)` → returns `Tenant`
- `apps/api/src/modules/auth/dto/auth-payload.type.ts` — GraphQL type with `accessToken`, `tenantId`

### 2.3 — Tenant Module (API-side)

**Files to update**:
- `apps/api/src/modules/tenant/tenant.service.ts`:
  - Wire `TenantRepository` from `@cdo/db`
  - `getProfile(tenantId)` → `TenantRepository.findById(tenantId)`
- `apps/api/src/modules/tenant/tenant.resolver.ts`:
  - `@UseGuards(GqlAuthGuard)` on all queries
  - `@CurrentTenant()` to get tenantId from JWT

### 2.4 — Credential Module (API-side)

**Files to create**:
- `apps/api/src/modules/credential/credential.service.ts`:
  - `store(tenantId, input)`: encrypt `rawPayload` using `crypto` AES-256-GCM (env `ENCRYPTION_KEY`), save via `CredentialRepository`
  - `listMeta(tenantId)`: return metadata only (no encrypted payload) via `CredentialRepository.findAllForTenant()`
  - `delete(tenantId, id)`: via `CredentialRepository.delete()`
- `apps/api/src/common/encryption/aes.service.ts` — `encrypt(text): { iv, authTag, ciphertext }` + `decrypt(cipher): string`

### 2.5 — Job Module (API-side)

**Files to create**:
- `apps/api/src/modules/job/job.service.ts`:
  - `create(tenantId, input)`:
    1. Validate credential IDs belong to tenantId
    2. Generate `jobId = uuid()`, `traceId = uuid()`, `correlationId = uuid()`
    3. `JobRepository.create({ tenantId, kind, status: 'PENDING', traceId, ... })`
    4. `JobProducer.enqueueEtlJob()` or `JobProducer.enqueueScrapeJob()` based on `kind`
    5. Return saved job
  - `findAll(tenantId)` → `JobRepository.findAllForTenant(tenantId)`
  - `findOne(tenantId, id)` → `JobRepository.findOneForTenant(tenantId, id)`
  - `replay(tenantId, jobId, dlqItemId)` → re-enqueue single DLQ item

### 2.6 — DLQ Module (API-side)

**Files to create**:
- `apps/api/src/modules/dlq/dlq.module.ts`
- `apps/api/src/modules/dlq/dlq.service.ts` — `getForJob(tenantId, jobId)`, `replayItem(tenantId, dlqItemId)`
- `apps/api/src/modules/dlq/dlq.resolver.ts` — `@Query() dlqItems`, `@Mutation() replayDlqItem`
- `apps/api/src/modules/dlq/dto/dlq-item.type.ts` — GraphQL type

### 2.7 — Observability Interceptor

**Files to create**:
- `apps/api/src/common/interceptors/logging.interceptor.ts` — Pino logger that logs each GraphQL operation with `tenantId`, `correlationId`, duration
- `apps/api/src/common/interceptors/trace.interceptor.ts` — injects `traceId` into `AsyncLocalStorage` per request

**Done when Phase 2 is complete**:
- [ ] `pnpm --filter @cdo/api dev` starts successfully
- [ ] GraphQL playground loads at `http://localhost:4000/graphql`
- [ ] `mutation login` returns a valid JWT
- [ ] `mutation createJob` saves to MongoDB and pushes to Redis queue
- [ ] `query jobs` returns jobs scoped by tenantId
- [ ] Credentials are AES-encrypted in MongoDB (verify in Compass)

---

## ✅ Phase 3 — Worker Planes
> **Why fourth**: Workers consume from the queue — the queue must be producing before workers can be tested.

### 3.1 — `apps/worker-etl` — Module Wiring

**Files to update**:
- `apps/worker-etl/src/worker.module.ts` — import `DatabaseModule`, `QueueModule`, `EtlProcessorModule`

### 3.2 — `apps/worker-etl` — Credential Decryption Service

**Files to create**:
- `apps/worker-etl/src/services/credential.decryptor.ts`:
  - `decrypt(tenantId, credentialId)`:
    1. `CredentialRepository.findOneDecrypted(tenantId, credentialId)` (reads encrypted payload)
    2. `AesService.decrypt(encryptedPayload)` → returns raw JSON credentials
    3. Parse and return as `Record<string, unknown>`
  - Never logs decrypted credentials — security-sensitive

### 3.3 — `apps/worker-etl` — Orchestrator (Full Implementation)

**Files to update**:
- `apps/worker-etl/src/orchestrator/data-etl.orchestrator.ts`:
  - Accept `JobDefinition` from BullMQ
  - Decrypt credentials via `CredentialDecryptor`
  - Use `ConnectorFactory.createSource()` + `ConnectorFactory.createTarget()`
  - Acquire Redis Redlock: `lock:${tenantId}:${targetCredentialId}` with TTL (e.g. 30 min)
  - Wire `EtlEngine` with source + target
  - On `'progress'` event → `JobRepository.updateProgress()`
  - On `'failure'` event → `DlqRepository.create(failedItem)`
  - On complete → `JobRepository.markCompleted()`
  - On circuit breaker trip → `JobRepository.markFailed()`
  - Release Redlock in `finally` block — always

### 3.4 — `apps/worker-etl` — ETL Processor (Full Implementation)

**Files to update**:
- `apps/worker-etl/src/processors/etl/etl.processor.ts`:
  - Handle job kinds: `CROSS_PLATFORM_MIGRATION`, `PLATFORM_CLONE`, `EXPORT`
  - For `PLATFORM_CLONE`: two-phase execution (Phase 1: schema, Phase 2: entities)
  - For `EXPORT`: wire to `FileStreamer` output instead of target connector
  - Update job status to `RUNNING` at start
  - Call `DataEtlOrchestrator.execute()`
  - Handle BullMQ job completion/failure lifecycle

### 3.5 — `apps/worker-scrape` — Scrape Processor (Full Implementation)

**Files to update**:
- `apps/worker-scrape/src/processors/scrape/scrape.processor.ts`:
  - Decrypt target credential
  - Acquire Redlock
  - `ScraperService.scrape(sourceUrl)` → raw JSON
  - Pass raw JSON through `@cdo/mapping` scrape rules (with AI fallback)
  - Use Target Connector to load results
  - Progress/failure events → DB updates

### 3.6 — Redis Redlock Integration

**Files to create**:
- `apps/worker-etl/src/services/lock.service.ts`:
  - Wrap `redlock` npm package
  - `acquire(key, ttl): Lock`
  - `release(lock): void`
  - `extend(lock, ttl): Lock` — for long-running jobs

**Done when Phase 3 is complete**:
- [ ] Create a job via GraphQL → worker picks it up within 1 second
- [ ] Real Shopify products are extracted and loaded to commercetools
- [ ] Failed items appear in DLQ MongoDB collection
- [ ] Redlock prevents two workers from hitting same target simultaneously
- [ ] Job status transitions correctly: PENDING → RUNNING → COMPLETED/FAILED

---

## ✅ Phase 4 — Web Frontend (Next.js)
> **Why fifth**: UI is the last piece — it consumes the working API from Phase 2 + 3.

### 4.1 — `packages/gql` — Run Codegen

**What**: With the real API running, generate typed hooks.

**Steps**:
1. Start API: `pnpm --filter @cdo/api dev`
2. Run codegen: `pnpm --filter @cdo/gql codegen`
3. This auto-generates `src/generated/types.ts`, `operations.ts`, `hooks.ts`
4. Export from `packages/gql/src/index.ts`

### 4.2 — `packages/ui` — Additional shadcn Components

**Files to add** (via `shadcn add` or manual):
- `packages/ui/src/components/ui/input.tsx` — Input field
- `packages/ui/src/components/ui/label.tsx` — Label
- `packages/ui/src/components/ui/dialog.tsx` — Modal dialog (for Add Credential form)
- `packages/ui/src/components/ui/select.tsx` — Dropdown select (for Job Kind picker)
- `packages/ui/src/components/ui/table.tsx` — Data table
- `packages/ui/src/components/ui/toast.tsx` — Toast notifications
- `packages/ui/src/components/ui/skeleton.tsx` — Loading skeleton
- `packages/ui/src/components/ui/separator.tsx`
- Update `packages/ui/src/index.ts` barrel

### 4.3 — `apps/web` — Jobs Section

**Files to create**:
- `apps/web/components/jobs/JobsTable.tsx` — table using `useQuery(GET_JOBS)` with status badges + kind badges
- `apps/web/components/jobs/JobStatCards.tsx` — summary stat cards (Total/Running/Completed/Failed count)
- `apps/web/components/jobs/JobProgressCard.tsx` — progress bar + pipeline steps + live event log
- `apps/web/components/jobs/CreateJobWizard.tsx`:
  - Step 1: Job kind selector (4 cards)
  - Step 2: Source credential dropdown + target credential dropdown + source URL field (for SCRAPE_IMPORT)
  - Step 3: Review + Launch
  - On submit: `useMutation(CREATE_JOB)`
- Update `apps/web/app/(dashboard)/jobs/page.tsx` — render `<JobStatCards>` + `<JobsTable>`
- Update `apps/web/app/(dashboard)/jobs/[id]/page.tsx` — render `<JobProgressCard>`
- Update `apps/web/app/(dashboard)/jobs/new/page.tsx` — render `<CreateJobWizard>`

### 4.4 — `apps/web` — Credentials Section

**Files to create**:
- `apps/web/components/credentials/CredentialCard.tsx` — shows platform, alias, created date, delete button
- `apps/web/components/credentials/AddCredentialModal.tsx` — modal with platform select + alias input + JSON paste for raw payload
- Update `apps/web/app/(dashboard)/credentials/page.tsx`

### 4.5 — `apps/web` — DLQ Section

**Files to create**:
- `apps/web/components/dlq/DlqTable.tsx` — table with error type badges, replay button per row, bulk replay button
- Update `apps/web/app/(dashboard)/dlq/page.tsx`

### 4.6 — `apps/web` — Auth Pages

**Files to create**:
- `apps/web/components/auth/LoginForm.tsx` — email/password form, `useMutation(LOGIN)`, store JWT in localStorage
- `apps/web/components/auth/RegisterForm.tsx` — name/email/password, `useMutation(CREATE_TENANT)`
- `apps/web/lib/auth/session.ts` — `getToken()`, `setToken()`, `clearToken()`, `isAuthenticated()`
- `apps/web/middleware.ts` — Next.js middleware to redirect unauthenticated users to `/login`

**Done when Phase 4 is complete**:
- [ ] Full user flow: Register → Login → Create Job → Monitor Progress → Replay DLQ
- [ ] All pages load without errors
- [ ] GraphQL codegen types match UI usage

---

## ✅ Phase 5 — Observability + Production Hardening
> **Why last**: Polish — don't optimize prematurely. Build observability after the system works.

### 5.1 — Structured Logging (Pino)

**What**: Replace all `console.log` with Pino structured JSON logs.

**Files to create**:
- `apps/api/src/common/logger/pino.logger.ts` — custom NestJS logger using `pino`
- `apps/worker-etl/src/common/logger/pino.logger.ts`
- Every log must include: `{ level, tenantId, jobId, traceId, correlationId, msg, timestamp }`

### 5.2 — AsyncLocalStorage for Context Propagation

**Files to create**:
- `apps/worker-etl/src/common/context/async-context.service.ts` — holds `{ tenantId, jobId, traceId, correlationId }` for the lifetime of a job
- Used by: Pino logger, Repositories, EtlEngine events

### 5.3 — Health Check Endpoints

**Files to create**:
- `apps/api/src/modules/health/health.controller.ts` — REST `GET /health` endpoint
  - Checks: MongoDB connection, Redis connection
  - Returns: `{ status: 'ok' | 'degraded', mongo: boolean, redis: boolean }`

### 5.4 — Rate Limiting

**Files to create**:
- `apps/api/src/common/guards/rate-limit.guard.ts` — max 100 requests/min per tenant using Redis counter

### 5.5 — Docker Compose (Local Dev)

**Files to create**:
- `docker-compose.yml` — services: `mongodb`, `redis`, `api`, `worker-etl`, `worker-scrape`
- `.env.local` template from `.env.example` files
- `docs/onboarding/local-development.md` — updated with `docker compose up` instructions

### 5.6 — CI Pipeline

**Files to create**:
- `.github/workflows/ci.yml`:
  - trigger: push to `develop-v1`, PR to `main`
  - jobs: `typecheck` (tsc --noEmit), `lint` (ESLint), `test` (Jest unit tests)

**Done when Phase 5 is complete**:
- [ ] `docker compose up` starts everything with one command
- [ ] All logs are JSON with tenantId/jobId/traceId
- [ ] `GET /health` returns 200 with service statuses
- [ ] CI passes on every PR
- [ ] No `console.log` anywhere in the codebase

---

## 📅 Estimated Timeline (1 Developer)

| Phase | Task | Estimate |
|---|---|---|
| **Phase 0** | Foundation (DB, Queue, Auth, Zod) | 3–4 days |
| **Phase 1** | Core Pipeline (Engine, Connectors, Mapping) | 6–8 days |
| **Phase 2** | API Control Plane (Services, Resolvers) | 4–5 days |
| **Phase 3** | Worker Planes (ETL + Scrape + Redlock) | 4–5 days |
| **Phase 4** | Web Frontend (Components + Pages) | 6–8 days |
| **Phase 5** | Observability + Hardening | 3–4 days |
| | **Total** | **~6–7 weeks** |

---

## 🚧 Implementation Rules (Non-Negotiable)

1. **Never skip Phase 0** — DB + Auth + Queue must be solid before any feature work
2. **Test at every phase boundary** — real integration, not just `tsc` passing
3. **No `process.env` in `packages/`** — packages receive config via constructor/injection; only apps read env
4. **No domain leakage** — `@cdo/core` must never import from `@cdo/db` or `@cdo/queue`
5. **Idempotency is mandatory** — every connector upserts, never blindly creates
6. **Every error has a type** — `ValidationError | TransientError | FatalError` — no generic `catch(e)` log-and-ignore
7. **Redlock always in `finally`** — lock must be released even if the job throws

---

## 🔵 Dependency Order (What Depends on What)

```
@cdo/shared          ← no deps
    ↓
@cdo/core            ← depends on @cdo/shared
    ↓
@cdo/mapping         ← depends on @cdo/shared
@cdo/ingestion       ← depends on @cdo/shared
@cdo/connectors      ← depends on @cdo/core, @cdo/shared, @cdo/mapping
    ↓
@cdo/db              ← depends on @cdo/shared
@cdo/queue           ← depends on @cdo/shared
@cdo/auth            ← depends on @cdo/shared
    ↓
apps/api             ← depends on @cdo/db, @cdo/queue, @cdo/auth
apps/worker-etl      ← depends on ALL packages
apps/worker-scrape   ← depends on ALL packages
    ↓
@cdo/gql             ← generated from apps/api schema
    ↓
apps/web             ← depends on @cdo/ui, @cdo/gql
```

> **Start at the top, work down. Never jump ahead.**
