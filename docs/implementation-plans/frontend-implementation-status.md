# Frontend Implementation Status

**Status: COMPLETE**  
**Date: 2026-08-21**  
**Branch: `claude/project-overview-status-faa9td`**

---

## What Was Implemented

The production frontend has been rebuilt to match the approved prototype (dark-mode, Space Grotesk + IBM Plex Mono, glassmorphism aesthetic). All five primary views are now backed by real GraphQL APIs with no mock data.

### Views Delivered

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `app/page.tsx` | Redirects to `/dashboard` |
| `/connections` | `ConnectionsView` | Platform credential grid + Add Connection modal |
| `/projects` | `ProjectsList` | Active + archived migration projects |
| `/projects/new` | `CreateProjectForm` | New project wizard |
| `/projects/[id]` | `ProjectDetail` | Project detail + run history + Start Run modal |
| `/runs` | `RunsView` | Live execution overview across all projects |
| `/runs/[id]` | `RunDetail` | Migration run detail with wave cards |
| `/reports` | `ReportsOverview` | Reconciliation reports per project |
| `/reports/[id]` | `ReconciliationReport` | Full reconciliation report detail |

### Supporting Changes

- **`apps/web/app/layout.tsx`** — Google Fonts preconnect + stylesheet (Space Grotesk, IBM Plex Mono)
- **`apps/web/tailwind.config.ts`** — `fontFamily.sans` → Space Grotesk, `fontFamily.mono` → IBM Plex Mono
- **`apps/web/components/layout/sidebar-nav.tsx`** — Rebuilt to prototype navigation structure
- **`apps/web/lib/graphql/queries/migration-project.queries.ts`** — All migration-domain queries
- **`apps/web/lib/graphql/mutations/index.ts`** — Migration project + run mutations added

---

## Backend API Dependencies

All frontend data comes from the existing NestJS GraphQL API at `apps/api`. No new backend changes were required.

### Queries Used

| Query | Fields | Resolver |
|-------|--------|----------|
| `GET_CREDENTIALS` | `id, platform, alias, createdAt` | `CredentialResolver` |
| `GET_MIGRATION_PROJECTS` | `id, name, status, entityTypes, sourceCredentialId, targetCredentialId, createdAt, updatedAt` | `MigrationProjectResolver` |
| `GET_MIGRATION_PROJECT` | all + `migrationRuns` | `MigrationProjectResolver` |
| `GET_MIGRATION_RUNS` | `id, status, dryRun, processedCount, failedCount, waves, startedAt, completedAt, createdAt` | `MigrationProjectResolver` |
| `GET_MIGRATION_RUN` | all + `correlationId, migrationProjectId` | `MigrationProjectResolver` |
| `GET_RECONCILIATION_REPORT` | `id, migrationRunId, generatedAt, overallSuccessRate, entitySummaries` | `MigrationProjectResolver` |
| `GET_RECONCILIATION_REPORTS` | filtered by `migrationProjectId` | `MigrationProjectResolver` |

### Mutations Used

| Mutation | Input | Resolver |
|----------|-------|----------|
| `STORE_CREDENTIAL` | `platform, alias, credentials` | `CredentialResolver` |
| `DELETE_CREDENTIAL` | `id` | `CredentialResolver` |
| `CREATE_MIGRATION_PROJECT` | `name, sourceCredentialId, targetCredentialId, entityTypes` | `MigrationProjectResolver` |
| `UPDATE_MIGRATION_PROJECT` | `id, name?, status?` | `MigrationProjectResolver` |
| `ARCHIVE_MIGRATION_PROJECT` | `id` | `MigrationProjectResolver` |
| `CREATE_MIGRATION_RUN` | `migrationProjectId, dryRun?, resumeFromRunId?` | `MigrationProjectResolver` |

---

## Polling Strategy

| Component | Interval | Condition |
|-----------|----------|-----------|
| `ProjectsList` | 10s | Always |
| `ProjectDetail` (runs list) | 8s | Always |
| `RunsView` | 5s | Always |
| `RunDetail` | 3s | Always (stops when run COMPLETED/FAILED) |
| `ReconciliationReport` | None | One-time fetch |

---

## Design Decisions

1. **No `next/font/google`** — Used plain `<link>` tags in `app/layout.tsx` to avoid air-gapped CI build failures.
2. **`"use client"` components** — All views use Apollo `useQuery`/`useMutation`, so they are client components. Page files are server components (metadata + thin wrapper).
3. **No mock data** — Every state (loading, empty, error) renders real feedback. The `RunsView` fetches live project + run data; no hardcoded migration records anywhere.
4. **Polling is unconditional** — Simple `pollInterval` on Apollo queries rather than conditional polling logic, keeping components simple and predictable.

---

## Test Results

```
Tasks:    15 successful, 15 total
Tests:    17 (worker-etl) + 46 (connectors) + ... = all pass
TypeScript: npx tsc --noEmit → 0 errors (apps/web, apps/api, packages/*)
Build: next build → 17 routes, 0 errors
```

### Bug Fixed in this Implementation

**`node-fetch@3` ESM incompatibility with Jest (CommonJS)**

- **Root cause**: `node-fetch@3` is ESM-only. Jest (via ts-jest) uses CommonJS require. Importing `node-fetch` with `import` caused `SyntaxError: Cannot use import statement outside a module` when Jest evaluated the module graph through `@cdo/connectors`.
- **Fix**: Removed `import fetch from 'node-fetch'` from all connectors (CT, Shopify, BigCommerce). Node 18+ provides `fetch` globally; connectors now reference `globalThis.fetch` directly.
- **Spec updates**: Connector specs that mocked `node-fetch` now assign to `globalThis.fetch` in `beforeAll`.
- **Jest config**: Added `@cdo/redis` and `@cdo/auth` to `apps/worker-etl/jest.config.js` moduleNameMapper (missing entries caused `etl.processor.spec.ts` to fail to resolve imports).

---

## Known Limitations / Next Steps

1. **Phase 4 — Credential Ownership Validation** (`docs/implementation-plans/phase4-credential-ownership.md`): Plan written, status AWAITING APPROVAL. Adds `assertCredentialOwnership()` to `JobService` to prevent cross-tenant credential access at the worker layer. No code written yet.

2. **Dashboard page** (`/dashboard`): Currently renders the existing dashboard component. It has not been updated to the prototype design. The prototype dashboard shows a migration summary overview; implementing it requires designing what metrics to surface.

3. **DLQ and Jobs pages** (`/dlq`, `/jobs`, `/settings`): These retain their original implementations. They appear in the system section of the sidebar nav.

4. **Reconciliation report pagination**: The `GET_RECONCILIATION_REPORTS` query fetches all reports for a project. For projects with many completed runs, pagination should be added to the query.

5. **Wave-level ordering**: Entity type execution order (CATEGORIES → PRODUCTS → CUSTOMERS → ORDERS) is enforced by the backend `MigrationOrchestrator`. The frontend renders waves in the order returned by the API.
