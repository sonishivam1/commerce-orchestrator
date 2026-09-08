# 00 — Simplification Plan

Goal: reduce the codebase to exactly what [migration-scope.md](../architecture/migration-scope.md) describes — org/user auth, encrypted connections, migration projects (migrate or export), a single run executor.

Rough effect: remove ~8–10k LOC, one worker app, two packages, three collections.

Do the phases in order. Each phase should end with `npx tsc --noEmit` clean and `pnpm test` green.

**Status: phases 0–4 and most of 6 are done. Remaining: phase 5 (cosmetic rename), the `_version` removal + package merges in phase 6, worker-etl→worker rename, and phase 7 cleanup.**

---

## Phase 0 — Docs ✅ done

- [x] Rewrite scope, system overview, entity relationships, connector contracts.
- [x] New `data-models/schemas.md`, `architecture/run-lifecycle.md`, this plan.
- [x] Archive superseded docs with a deprecation banner.
- [x] Update `CLAUDE.md`, `AGENTS.md`, `README.md`.

## Phase 1 — Delete scraping ✅ done

- [x] Delete `apps/worker-scrape/` and `packages/ingestion/`.
- [x] Remove `scrape.rules.ts` and `SourcePlatform.SCRAPER`.
- [x] Remove `SCRAPE_IMPORT`, `QUEUE_SCRAPE` + scrape retry constants and the scrape producer.
- [x] Remove scrape docker-compose / CI steps.
- [x] Delete scrape UI (`/jobs` went entirely in phase 2).

## Phase 2 — Collapse to one run model ✅ done (bar the rename)

- [x] Delete the legacy `Job` path (db schema+repo, `apps/api` job module, `data-etl.orchestrator.ts`).
- [x] `EtlProcessor` handles only `MIGRATION_RUN`.
- [x] `JobKind` collapses to `MIGRATION_RUN`; `JobStatus` removed.
- [x] Web: delete `/jobs`, `components/jobs/*`, job queries/mutations, sidebar entry.
- [ ] Rename `apps/worker-etl` → `apps/worker` (deferred — package rename churn).
- [ ] Remove `getCapabilities()` from the `TargetConnector` interface (still present; unused).

## Phase 3 — mode: MIGRATE | EXPORT ✅ done

- [x] `MigrationProject.mode` / `exportFormat`, nullable `targetConnectionId`; `MigrationRun.export`.
- [x] `FileExportTarget` in `@cdo/connectors` + tests.
- [x] Worker orchestrator builds the file target for EXPORT, skips identity maps, records `run.export`.
- [x] `GET /runs/:id/export` (JWT, org-scoped) + web download button + mode toggle on the create form.
- [x] File storage: local `EXPORT_DIR` (default `<cwd>/exports`, gitignored).

## Phase 4 — Org + User ✅ done

- [x] `Tenant` is the organization (`{ name, status }`); new `User` collection + `UserRepository`. `tenantId` stays the scoping field.
- [x] `apps/api/tenant`: `register` (org + owner), `login` (user), `me`, `organizationMembers`, `addOrganizationMember`, `setMemberActive` + tests.
- [x] JWT `{ sub: userId, tenantId, email, role }`; `TenantContext` gains `userId` + `role`; `@CurrentOrg` alias.
- [x] Web: register form (org name + your name); settings Members section.

## Phase 5 — Rename credentials → connections (not started)

- [ ] `credential.schema.ts` → `connection.schema.ts` (collection `credentials` → `connections`), `CredentialRepository` → `ConnectionRepository`.
- [ ] `apps/api/src/modules/credential` → `connection`. GraphQL types `Credential*` → `Connection*`.
- [ ] Wire "Test connection" end to end (call `connector.initialize()` + a cheap read) → set `health` + `lastTestedAt`.

## Phase 6 — Strip speculative infra (mostly done)

- [x] Remove the DLQ subsystem; `MigrationRun.failedItems[]` + run-detail table.
- [x] Remove `ReconciliationReport` + API queries + `/reports` UI + worker `generateReport`.
- [x] Remove Redlock (`lock.service.ts`, lock constants); concurrency via a `RUNNING`-run check in `createMigrationRun`.
- [x] Remove `circuit-breaker.ts` from `@cdo/core` (`onFatal` option kept); drop `CIRCUIT_BREAKER_THRESHOLD`.
- [x] Replace the Kahn `wave-planner.ts` with `CANONICAL_ENTITY_ORDER` + `planEntityWaves`/`entityWaveDependencies` in `@cdo/shared`.
- [ ] Remove the custom Redis throttler (`common/storage/redis-throttler.*`, `rate-limit.guard.ts`); keep `ThrottlerModule` in-memory.
- [ ] Collapse `correlationId` + `traceId` → `requestId`; remove `trace.interceptor.ts`.
- [ ] Merge `@cdo/redis` into `@cdo/queue`; merge `@cdo/mapping` into `@cdo/connectors`.
- [ ] Remove `_version` from canonical types + validators + connectors (high blast radius — do as its own change).

## Phase 7 — Regenerate + verify (not started)

- [ ] Re-run GraphQL codegen (`@cdo/gql`) — the generated hooks still carry removed operations.
- [ ] Update `.claude/rules/`, `.claude/skills/`, `.claude/agents/` (scrape queue, wave planner, rules engine, Redlock, DLQ, `@CurrentTenant` semantics).
- [ ] `npx tsc --noEmit`, `pnpm test`, `pnpm build`.
- [ ] Refresh `README.md` UI previews / screenshots.
- [ ] Run the smoke script end to end against sandbox commercetools + Shopify.

---

## Target end state

```
apps/     api, web, worker
packages/ shared, core, connectors, db, queue, auth, ui, gql
mongo/    organizations, users, connections, migration_projects, migration_runs, identity_maps
jobkinds/ MIGRATION_RUN
```
