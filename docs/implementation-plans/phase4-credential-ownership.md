# Phase 4 — Credential Ownership Validation

**Status**: AWAITING APPROVAL
**Agent**: implementation-executor
**Skill**: nestjs-module

---

## Problem Statement

`JobService.create()` accepts `sourceCredentialId` / `targetCredentialId` from untrusted user input
and creates the job + enqueues BullMQ without verifying that the named credentials belong to the
requesting tenant. The enforcement gap:

```
Tenant A authenticates → JWT contains tenantId = "tenant-a"
           │
           ▼
createJob(sourceCredentialId = "some-id-from-tenant-b")   ← user-controlled input
           │
           ▼
JobService.create()  ← NO ownership check here
           │
           ▼
job created with tenantId = "tenant-a"
           │
           ▼
Worker: findOneDecrypted("tenant-a", "some-id-from-tenant-b")
         → returns null  (credential exists but belongs to "tenant-b")
         → job crashes with "Missing source credential"
         → but: if that query were bypassed or the repo logic changed, data leaks
```

The `CredentialRepository` already has `findOneForTenant(tenantId, id)` which scopes on
`{ _id: id, tenantId }`. It returns `null` when the credential belongs to a different tenant.
`JobService` simply never calls it before creating the job.

Additionally, `replayDlqItem()` re-enqueues using credential IDs from the stored parent job.
Those IDs were not validated at creation time (same gap), so this path needs ownership checks too.

---

## Acceptance Criteria

- [ ] `JobService.create()` validates `sourceCredentialId` ownership before creating the job document
- [ ] `JobService.create()` validates `targetCredentialId` ownership before creating the job document
- [ ] Non-existent credential → `ForbiddenException` (not `NotFoundException` — no leaking existence)
- [ ] Credential belonging to another tenant → `ForbiddenException`
- [ ] Valid credentials owned by the requesting tenant → job created normally
- [ ] `JobModule` declares `CredentialRepository` in its `providers` array so the DI graph resolves
      (note: `DatabaseModule` is `@Global()`, so the repository is already registered globally — the
      module declaration is for documentation clarity only; NestJS resolves it either way)
- [ ] `replayDlqItem()` re-validates credential ownership from the stored parent job document
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Unit tests cover all six scenarios in the acceptance criteria above plus the replay path

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/src/modules/job/job.service.ts` | MODIFY | Inject `CredentialRepository`; add ownership checks in `create()` and `replayDlqItem()` |
| `apps/api/src/modules/job/job.module.ts` | MODIFY | Add `CredentialRepository` to `providers` for explicit DI declaration |
| `apps/api/src/modules/job/__tests__/job.service.spec.ts` | CREATE | Unit tests for all ownership scenarios |

No schema changes. No new BullMQ queues. No connector changes.

---

## Implementation Detail

### 1. JobService — inject CredentialRepository

```typescript
// apps/api/src/modules/job/job.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CredentialRepository, JobRepository, DlqRepository } from '@cdo/db';
// ...

@Injectable()
export class JobService {
    constructor(
        private readonly jobRepository: JobRepository,
        private readonly dlqRepository: DlqRepository,
        private readonly jobProducer: JobProducer,
        private readonly credentialRepository: CredentialRepository,  // NEW
    ) {}

    // ...
}
```

### 2. Private helper — assertCredentialOwnership()

Add a private method so the ownership check is a single, tested, named concept:

```typescript
/**
 * Verifies that the named credential exists and belongs to tenantId.
 * Throws ForbiddenException when either condition fails — intentionally
 * not NotFoundException so we don't leak credential existence to callers.
 */
private async assertCredentialOwnership(tenantId: string, credentialId: string, role: 'source' | 'target'): Promise<void> {
    const cred = await this.credentialRepository.findOneForTenant(tenantId, credentialId);
    if (!cred) {
        throw new ForbiddenException(
            `${role} credential does not exist or does not belong to this tenant`
        );
    }
}
```

### 3. JobService.create() — call assertCredentialOwnership before creating the job doc

```typescript
async create(tenantId: string, input: CreateJobInput) {
    const isScrapeJob = input.kind === JobKind.SCRAPE_IMPORT;
    const isExport = input.kind === JobKind.EXPORT;

    // --- existing input-shape validations (unchanged) ---
    if (isScrapeJob && !input.sourceUrl) { ... }
    if (!isScrapeJob && !input.sourceCredentialId) { ... }
    if (!isScrapeJob && !isExport && !input.targetCredentialId) { ... }

    // --- NEW: ownership checks before any state mutation ---
    if (input.sourceCredentialId) {
        await this.assertCredentialOwnership(tenantId, input.sourceCredentialId, 'source');
    }
    if (input.targetCredentialId) {
        await this.assertCredentialOwnership(tenantId, input.targetCredentialId, 'target');
    }

    // ... rest of create() is unchanged ...
}
```

Ownership checks run **before** `jobRepository.create()` and **before** `jobProducer.enqueue*()`.
A denied request never creates a job document and never enqueues a BullMQ job.

### 4. JobService.replayDlqItem() — re-validate ownership from stored parent job

The parent job's credential IDs were not validated at creation time (same gap). Defense-in-depth:

```typescript
async replayDlqItem(tenantId: string, jobId: string, dlqItemId: string) {
    // ... existing lookups (dlqItem, parentJob) ...

    // NEW: re-validate credential ownership using stored IDs from parent job
    if (parentJob.sourceCredentialId) {
        await this.assertCredentialOwnership(tenantId, parentJob.sourceCredentialId, 'source');
    }
    if (parentJob.targetCredentialId) {
        await this.assertCredentialOwnership(tenantId, parentJob.targetCredentialId, 'target');
    }

    // ... existing re-enqueue logic unchanged ...
}
```

### 5. JobModule — add CredentialRepository to providers

```typescript
// apps/api/src/modules/job/job.module.ts
import { Module } from '@nestjs/common';
import { QueueModule } from '@cdo/queue';
import { CredentialRepository } from '@cdo/db';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';

@Module({
    imports: [QueueModule],
    providers: [JobResolver, JobService, CredentialRepository],
})
export class JobModule {}
```

> **Note**: `DatabaseModule` is `@Global()`, so `CredentialRepository` is already in the global
> scope. Adding it to `providers` here is for explicit documentation of what this module uses;
> NestJS resolves it from the global scope regardless.

---

## Test Plan

File: `apps/api/src/modules/job/__tests__/job.service.spec.ts`

Mock strategy: jest mock for `CredentialRepository`, `JobRepository`, `DlqRepository`,
`JobProducer`. All tests call `service.create()` with a real `tenantId` and controlled
`sourceCredentialId` / `targetCredentialId` strings.

**Ownership validation — create() path:**

1. `source credential belongs to requesting tenant → job created and enqueued successfully`
2. `source credential belongs to different tenant (findOneForTenant returns null) → ForbiddenException, no job created, no enqueue`
3. `source credential does not exist (findOneForTenant returns null) → ForbiddenException`
4. `target credential belongs to different tenant → ForbiddenException, job NOT created`
5. `both credentials valid and owned → job created and enqueued`
6. `SCRAPE_IMPORT (no sourceCredentialId) → no source ownership check, only target checked`

**Ownership validation — replayDlqItem() path:**

7. `replay with stored credential now owned by another tenant → ForbiddenException, no re-enqueue`
8. `replay with still-valid credentials → re-enqueued successfully`

**Error type:**

9. `ForbiddenException is thrown (not NotFoundException) — error message does not reveal whether credential exists`

---

## Out of Scope

- Credential ownership check in `MigrationProjectService.createRun()` (separate phase — the wave executor uses `findOneDecrypted(tenantId, id)` which already scopes by tenant)
- Credential endpoint authorization (the credential resolver already uses `@CurrentTenant()`)
- Rate limiting (Phase 6)
- Audit logging of ownership violations (Phase 6)
