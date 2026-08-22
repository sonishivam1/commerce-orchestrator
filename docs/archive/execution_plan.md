# Step-by-Step Execution Plan

### 🔴 Phase A: Critical Architecture & Security Fixes
*These are the highest priority items as their absence poses data corruption and security risks.*

- **Step 1.1: Implement Redis Redlock Service**
  - Create `apps/worker-etl/src/services/lock.service.ts` (and shared utility if needed).
  - Implement distributed locking to ensure a tenant cannot run two destructive jobs against the same target environment simultaneously.
  - Wire it into `etl.processor.ts` and `scrape.processor.ts` (replace the `// TODO: Redis Redlock` comments).
- **Step 1.2: Extract Shared Credential Decryption**
  - Create `packages/auth/src/encryption/aes.service.ts` or a shared utility to centralize AES-256-GCM encryption/decryption.
  - Update `apps/api/src/modules/credential/credential.service.ts` to use this new service.
  - Create `apps/worker-etl/src/services/credential.decryptor.ts` using the shared service.
  - Refactor both `etl.processor.ts` and `scrape.processor.ts` to remove duplicated inline decryption logic.
- **Step 1.3: Web App Authentication Middleware**
  - Create `apps/web/lib/auth/session.ts` to properly manage JWT tokens (`getToken`, `setToken`, `clearToken`, `isAuthenticated`).
  - Create `apps/web/middleware.ts` to intercept Next.js routes and redirect unauthenticated users away from the dashboard (`/jobs`, `/credentials`, etc.) to `/login`.

### 🟡 Phase B: Backend API & Pipeline Completion
*Closing the gaps in the API Control Plane and ETL pipeline features.*

- **Step 2.1: Extract Dedicated DLQ API Module**
  - Create `apps/api/src/modules/dlq/dlq.module.ts`, `dlq.service.ts`, and `dlq.resolver.ts`.
  - Move the DLQ-specific logic (currently clumped inside `JobService`) into this new dedicated module to respect separation of concerns.
- **Step 2.2: Implement `PLATFORM_CLONE` Two-Phase Logic**
  - Ensure the `ct-target.connector.ts` handles Phase 1 (Schema replication: CustomTypes, Channels) and Phase 2 (Entity replication: Products, Customers).
  - Implement the missing `ProductMapper.fromCanonical()` (reverse mapping) logic which currently throws `'not implemented'`.
- **Step 2.3: Zod Schema Unit Testing & Fixes**
  - Write unit tests for the 5 Zod validators (`product.validator.ts`, etc.).
  - Run `npx tsc --noEmit` and resolve any outstanding TypeScript errors to guarantee Phase 0 compliance.
- **Step 2.4: Implement EXPORT Topology**
  - Wire the core engine to a `FileStreamer` output (which exists in ingestion but isn't wired) to allow exporting data to CSV/JSONL.

### 🔵 Phase C: Frontend Polish
*Finalizing the Next.js control panel so it is fully functional and matches the design system.*

- **Step 3.1: GraphQL Codegen**
  - Configure and run Apollo GraphQL Codegen (`@cdo/gql`) against the running API schema.
  - Replace the stubbed queries/mutations in the React components with the strictly typed generated hooks (`useCreateJobMutation`, `useGetJobsQuery`, etc.).
- **Step 3.2: Complete `@cdo/ui` Components**
  - Build out the missing shadcn UI components according to the Design System (`input`, `label`, `dialog`, `select`, `table`, `toast`, `skeleton`, `separator`).
  - Implement the `JobProgressCard` to visually track live progress and pipeline steps.
  - Refactor the current simple New Job Form into the intended 3-step `CreateJobWizard`.

### 🟢 Phase D: Observability & Production Hardening (Phase 5)
*Getting the system ready for real-world deployment.*

- **Step 4.1: Structured Logging & Tracing**
  - Implement `Pino` structured logger across all apps (API, Worker ETL, Worker Scrape).
  - Replace all remaining `console.log` and `console.error` calls (especially in the connectors).
  - Add `AsyncLocalStorage` to propagate `tenantId`, `jobId`, and `traceId` context across worker executions.
  - Add `LoggingInterceptor` and `TraceInterceptor` to the NestJS API.
- **Step 4.2: Infrastructure & Safety**
  - Implement Redis-based Rate Limiting (max 100 req/min per tenant) on the API.
  - Create an operational `GET /health` endpoint that checks MongoDB and Redis connectivity.
- **Step 4.3: Deployment Config**
  - Update `docker-compose.yml` to include the application services (`api`, `worker-etl`, `worker-scrape`, `web`).
  - Create a `.env.example` template file.
  - (Optional) Set up a GitHub Actions CI pipeline (`.github/workflows/ci.yml`).
