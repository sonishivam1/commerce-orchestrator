# 00 — Simplification Plan

Goal: reduce the codebase to exactly what [migration-scope.md](../architecture/migration-scope.md) describes — org/user auth, encrypted connections, migration projects (migrate or export), a single run executor.

Rough effect: remove ~8–10k LOC, one worker app, two packages, three collections.

Do the phases in order. Each phase should end with `npx tsc --noEmit` clean and `pnpm test` green.

---

## Phase 0 — Docs (this change)

- [x] Rewrite scope, system overview, entity relationships, connector contracts.
- [x] New `data-models/schemas.md`, `architecture/run-lifecycle.md`, this plan.
- [x] Archive superseded docs with a deprecation banner.
- [x] Update `CLAUDE.md`, `AGENTS.md`, `README.md`.

## Phase 1 — Delete scraping

- [ ] Delete `apps/worker-scrape/`.
- [ ] Delete `packages/ingestion/`.
- [ ] Remove `packages/mapping/src/rules-engine/scrape.rules.ts` and any scrape mapper paths.
- [ ] Remove `SCRAPE_IMPORT` from `JobKind`, `Job` schema enums, and API DTO unions.
- [ ] Remove `QUEUE_SCRAPE` constant and its producer.
- [ ] Drop `playwright` from dependencies; remove `docker`/CI steps for it.
- [ ] Delete scrape UI: any `sourceUrl` fields in job/create forms.

## Phase 2 — Collapse to one run model

- [ ] Delete the legacy `Job` path: `packages/db` `job.schema.ts` + `job.repository.ts`, `apps/api/src/modules/job/`, `apps/worker-etl/src/orchestrator/data-etl.orchestrator.ts`.
- [ ] Keep `MigrationProject` / `MigrationRun` / `migration-run.orchestrator.ts` / `wave-executor.service.ts`.
- [ ] Remove `PLATFORM_CLONE` and the standalone `EXPORT` topology from `JobKind`; keep only `MIGRATION_RUN`.
- [ ] Remove `getCapabilities()` / `extractSchema()` / `deploySchema()` from connector interfaces and implementations.
- [ ] Rename `apps/worker-etl` → `apps/worker`.
- [ ] Web: delete `/jobs`, `components/jobs/*`, `create-job-wizard.tsx`, `new-job-form.tsx`. Projects + runs are the only execution UI.

## Phase 3 — Add mode: MIGRATE | EXPORT

- [ ] `MigrationProject`: add `mode`, make `targetConnectionId` nullable, add `exportFormat`. Update the create input + service validation (see `schemas.md`).
- [ ] `MigrationRun`: add `export: { filePath, byteSize, format }`.
- [ ] `@cdo/connectors`: add a `FileExportTarget` implementing `TargetConnector` (CSV via a tiny writer, JSON as an array stream). No new package.
- [ ] Worker orchestrator: when `mode = EXPORT`, build `FileExportTarget` instead of a platform target; skip `identity_maps`; on finish, stat the file and write `run.export`.
- [ ] API: `GET /runs/:id/export` (auth + org scope) streams the file. Add a download button on the run detail page.
- [ ] Decide file storage: local disk volume for the POC (`EXPORT_DIR` env in `apps/api` + `apps/worker`, shared volume) — S3 is a later swap behind the same interface.

## Phase 4 — Org + User

- [ ] `packages/db`: rename `tenant.schema.ts` → `organization.schema.ts` (collection `organizations`), drop `email`/`passwordHash` from it. New `user.schema.ts` (collection `users`) per `schemas.md`.
- [ ] `apps/api` `tenant` module → `organization` module. New `user` module (invite member, list members, disable member — `OWNER` only).
- [ ] `auth`: `register` creates org + owner user together. `login` looks up `users` by email. JWT payload `{ sub: userId, tenantId, role }`.
- [ ] `@cdo/auth`: `JwtStrategy` reads both claims; rename `@CurrentTenant()` → `@CurrentOrg()` returning `{ userId, tenantId, role }`. Keep `tenantId` as the scoping field name everywhere else (no mass rename).
- [ ] Web: registration form collects org name + user name + email + password. Add a bare "Members" section under settings.

## Phase 5 — Rename credentials → connections

- [ ] `credential.schema.ts` → `connection.schema.ts` (collection `credentials` → `connections`), `CredentialRepository` → `ConnectionRepository`.
- [ ] `apps/api/src/modules/credential` → `connection`. GraphQL types `Credential*` → `Connection*`.
- [ ] Wire the "Test connection" action end to end: API mutation → worker-less inline check (call `connector.initialize()` + a cheap read) → set `health` + `lastTestedAt`.
- [ ] Web: `connections-view.tsx` already exists; point it at the renamed API.

## Phase 6 — Strip speculative infra

- [ ] Remove `packages/db` `dlq.schema.ts` + `dlq.repository.ts`, `apps/api/src/modules/dlq/`, `components/shared/dlq-table.tsx`, `/dlq` route, DLQ replay methods. Add `failedItems[]` to `MigrationRun` + a table on the run page.
- [ ] Remove `reconciliation-report.schema.ts` + repository, reconciliation API queries, `RECONCILIATION` job kind, `/reports` routes, `components/reports/*`.
- [ ] Remove Redlock: `apps/worker*/src/services/lock.service.ts`, `distributed-locking` skill, `operations/locking-strategy.md`. Guard concurrency with a `RUNNING` status check in `createMigrationRun`.
- [ ] Remove the custom throttler: `common/storage/redis-throttler.*`, `common/guards/rate-limit.guard.ts`. Keep `ThrottlerModule` with the in-memory default.
- [ ] Remove `circuit-breaker.ts` from `@cdo/core`; keep `retry.ts`.
- [ ] Collapse `correlationId` + `traceId` → `requestId`. Remove `trace.interceptor.ts`, keep `logging.interceptor.ts`.
- [ ] Merge `@cdo/redis` into `@cdo/queue`. Merge `@cdo/mapping` into `@cdo/connectors`.
- [ ] Delete `packages/core/src/wave/wave-planner.ts` (Kahn sort); replace call sites with `CANONICAL_ENTITY_ORDER.filter(t => selected.includes(t))`.
- [ ] Remove `_version` from canonical types; delete `data-models/versioning-strategy.md` references.

## Phase 7 — Regenerate + verify

- [ ] Re-run GraphQL codegen (`@cdo/gql`).
- [ ] Update `.claude/skills/` and `.claude/agents/` that reference removed pieces (`bullmq` scrape queue, wave planner, rules engine, Redlock, DLQ).
- [ ] `npx tsc --noEmit`, `pnpm test`, `pnpm build`.
- [ ] Update `README.md` UI previews / screenshots.
- [ ] Run the smoke script end to end against sandbox commercetools + Shopify.

---

## Target end state

```
apps/     api, web, worker
packages/ shared, core, connectors, db, queue, auth, ui, gql
mongo/    organizations, users, connections, migration_projects, migration_runs, identity_maps
jobkinds/ MIGRATION_RUN
```
