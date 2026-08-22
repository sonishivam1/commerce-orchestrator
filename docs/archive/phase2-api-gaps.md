# Sub-Plan: Phase 2 — API Control Plane Gaps

> **Status:** AWAITING APPROVAL  
> **Priority:** 🟡 High — Security correctness + clean architecture  
> **Depends on:** Phase 0 (done), Phase 2 core API (done)  
> **Blocks:** Production API readiness; credential ownership is a security requirement  
> **Skill references:** `.claude/skills/nestjs-module/SKILL.md`, `.claude/skills/database-ops/SKILL.md`  
> **Agent:** `backend-architect`

---

## Problem Statement

Four gaps remain in the API control plane:

1. **Credential ownership not validated** — `JobService.create()` accepts any `sourceCredentialId` / `targetCredentialId`. A tenant could reference another tenant's credentials. This is a **multi-tenancy security breach**.

2. **AES encryption duplicated** — `CredentialService` has AES-256-GCM encryption inline. `EtlProcessor` and `ScrapeProcessor` each have their own inline decryption. The same crypto logic exists in 3 places with no tests.

3. **DLQ as a separate module** — The implementation plan requires a dedicated `dlq.module.ts`. Currently DLQ logic is embedded in `JobService`. This violates separation of concerns and makes DLQ independently untestable.

4. **Missing observability interceptors** — No `LoggingInterceptor` or `TraceInterceptor`. Every GraphQL operation is blind in production — no structured logs, no trace IDs per request.

---

## Acceptance Criteria

- [ ] `JobService.create()` verifies both credential IDs belong to the requesting `tenantId` — throws `BadRequestException` if not
- [ ] `AesService` exists at `apps/api/src/common/encryption/aes.service.ts` with `encrypt()` and `decrypt()`
- [ ] `CredentialService` uses `AesService` — no inline crypto
- [ ] Both workers use a shared `CredentialDecryptorService` — no inline crypto in processors
- [ ] `DlqModule` exists at `apps/api/src/modules/dlq/` with its own resolver, service, and DTOs
- [ ] `LoggingInterceptor` logs every GraphQL operation with `tenantId`, operation name, duration
- [ ] `TraceInterceptor` injects a `traceId` per request via `AsyncLocalStorage`
- [ ] `AppModule` registers `LoggingInterceptor` globally
- [ ] `npx tsc --noEmit` = 0 errors

---

## Files to Change

### CREATE

| File | Purpose |
|------|---------|
| `apps/api/src/common/encryption/aes.service.ts` | Shared AES-256-GCM encrypt/decrypt |
| `apps/api/src/common/encryption/encryption.module.ts` | NestJS module for AesService |
| `apps/api/src/common/interceptors/logging.interceptor.ts` | Pino-based GraphQL operation logger |
| `apps/api/src/common/interceptors/trace.interceptor.ts` | Injects traceId per request |
| `apps/api/src/modules/dlq/dlq.module.ts` | DLQ feature module |
| `apps/api/src/modules/dlq/dlq.service.ts` | Tenant-scoped DLQ business logic |
| `apps/api/src/modules/dlq/dlq.resolver.ts` | `dlqItems` query + `replayDlqItem` mutation |
| `apps/api/src/modules/dlq/dto/dlq-item.type.ts` | `@ObjectType() DlqItem` GraphQL type |
| `apps/api/src/modules/dlq/dto/replay-dlq-item.input.ts` | `@InputType() ReplayDlqItemInput` |
| `apps/worker-etl/src/services/credential-decryptor.service.ts` | Shared decryptor for workers |
| `apps/worker-scrape/src/services/credential-decryptor.service.ts` | Same for scrape worker |

### MODIFY

| File | Change |
|------|--------|
| `apps/api/src/modules/credential/credential.service.ts` | Replace inline crypto with `AesService` |
| `apps/api/src/modules/credential/credential.module.ts` | Import `EncryptionModule` |
| `apps/api/src/modules/job/job.service.ts` | Add credential ownership validation; remove DLQ methods |
| `apps/api/src/modules/job/job.module.ts` | Remove DLQ deps |
| `apps/api/src/app.module.ts` | Import `DlqModule`; register interceptors globally |
| `apps/worker-etl/src/processors/etl/etl.processor.ts` | Replace inline decryption with `CredentialDecryptorService` |
| `apps/worker-etl/src/processors/etl/etl-processor.module.ts` | Provide `CredentialDecryptorService` |
| `apps/worker-scrape/src/processors/scrape/scrape.processor.ts` | Same replacement |
| `apps/worker-scrape/src/scrape-worker.module.ts` | Provide `CredentialDecryptorService` |

---

## Implementation Detail

### 1. AesService

```typescript
// apps/api/src/common/encryption/aes.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface EncryptedPayload {
    ciphertext: string;   // hex
    iv: string;           // hex — 12 bytes for GCM
    authTag: string;      // hex — 16 bytes
}

@Injectable()
export class AesService {
    private getKey(): Buffer {
        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== 64) {
            throw new Error('CREDENTIAL_KEY must be a 64-character hex string (32 bytes)');
        }
        return Buffer.from(keyHex, 'hex');
    }

    encrypt(plaintext: string): EncryptedPayload {
        const key = this.getKey();
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);

        let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
        ciphertext += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        return {
            ciphertext,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
        };
    }

    decrypt(payload: EncryptedPayload): string {
        const key = this.getKey();
        const iv = Buffer.from(payload.iv, 'hex');
        const authTag = Buffer.from(payload.authTag, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
        plaintext += decipher.final('utf8');
        return plaintext;
    }
}
```

### 2. Credential Ownership Validation in `JobService`

```typescript
// apps/api/src/modules/job/job.service.ts — in create()
async create(tenantId: string, input: CreateJobInput): Promise<Job> {
    // Validate credential ownership — both must belong to this tenant
    const [sourceCred, targetCred] = await Promise.all([
        this.credentialRepository.findOneForTenant(tenantId, input.sourceCredentialId),
        input.targetCredentialId
            ? this.credentialRepository.findOneForTenant(tenantId, input.targetCredentialId)
            : Promise.resolve(null),
    ]);

    if (!sourceCred) {
        throw new BadRequestException(
            `Source credential ${input.sourceCredentialId} not found for this tenant`
        );
    }

    if (input.targetCredentialId && !targetCred) {
        throw new BadRequestException(
            `Target credential ${input.targetCredentialId} not found for this tenant`
        );
    }

    // ... rest of create logic (generate jobId, enqueue, etc.)
}
```

### 3. DLQ Module

```typescript
// apps/api/src/modules/dlq/dlq.service.ts
@Injectable()
export class DlqService {
    private readonly logger = new Logger(DlqService.name);

    constructor(
        private readonly dlqRepository: DlqRepository,
        private readonly jobProducer: JobProducer,
    ) {}

    async getForJob(tenantId: string, jobId: string): Promise<DlqItem[]> {
        return this.dlqRepository.findAllForJob(tenantId, jobId);
    }

    async replayItem(tenantId: string, dlqItemId: string): Promise<boolean> {
        const item = await this.dlqRepository.findById(tenantId, dlqItemId);
        if (!item) throw new NotFoundException(`DLQ item ${dlqItemId} not found`);
        if (!item.canReplay) throw new BadRequestException('This item cannot be replayed (ValidationError)');

        await this.jobProducer.enqueueEtlJob({
            tenantId,
            jobId: item.jobId,
            kind: 'REPLAY',
            dlqItemId: item.id,
            rawPayload: item.rawPayload,
        });

        await this.dlqRepository.markReplayed(dlqItemId);
        return true;
    }
}
```

```typescript
// apps/api/src/modules/dlq/dlq.resolver.ts
@Resolver()
@UseGuards(GqlAuthGuard)
export class DlqResolver {
    constructor(private readonly dlqService: DlqService) {}

    @Query(() => [DlqItem])
    async dlqItems(
        @Args('jobId') jobId: string,
        @CurrentTenant() tenantId: string,
    ): Promise<DlqItem[]> {
        return this.dlqService.getForJob(tenantId, jobId);
    }

    @Mutation(() => Boolean)
    async replayDlqItem(
        @Args('input') input: ReplayDlqItemInput,
        @CurrentTenant() tenantId: string,
    ): Promise<boolean> {
        return this.dlqService.replayItem(tenantId, input.dlqItemId);
    }
}
```

### 4. Logging Interceptor

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('GraphQL');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const gqlCtx = GqlExecutionContext.create(context);
        const info = gqlCtx.getInfo();
        const { req } = gqlCtx.getContext();
        const tenantId = req?.user?.tenantId ?? 'anonymous';
        const operation = `${info?.parentType?.name}.${info?.fieldName}`;
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    this.logger.log({
                        msg: 'GraphQL operation completed',
                        operation,
                        tenantId,
                        durationMs: Date.now() - start,
                    });
                },
                error: (err: Error) => {
                    this.logger.error({
                        msg: 'GraphQL operation failed',
                        operation,
                        tenantId,
                        durationMs: Date.now() - start,
                        error: err.message,
                    });
                },
            }),
        );
    }
}
```

### 5. Trace Interceptor

```typescript
// apps/api/src/common/interceptors/trace.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export const traceStorage = new AsyncLocalStorage<{ traceId: string }>();

@Injectable()
export class TraceInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return new Observable(observer => {
            traceStorage.run({ traceId: randomUUID() }, () => {
                next.handle().subscribe({
                    next: val => observer.next(val),
                    error: err => observer.error(err),
                    complete: () => observer.complete(),
                });
            });
        });
    }
}
```

### 6. Register Interceptors Globally in AppModule

```typescript
// apps/api/src/app.module.ts — add to providers:
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TraceInterceptor } from './common/interceptors/trace.interceptor';

providers: [
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
],
```

### 7. CredentialDecryptorService (shared across workers)

```typescript
// apps/worker-etl/src/services/credential-decryptor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CredentialRepository } from '@cdo/db';
import { createDecipheriv } from 'crypto';

@Injectable()
export class CredentialDecryptorService {
    private readonly logger = new Logger(CredentialDecryptorService.name);

    constructor(private readonly credentialRepository: CredentialRepository) {}

    async decrypt(tenantId: string, credentialId: string): Promise<Record<string, unknown>> {
        const doc = await this.credentialRepository.findOneDecrypted(tenantId, credentialId);
        if (!doc) throw new Error(`Credential ${credentialId} not found for tenant ${tenantId}`);

        const keyHex = process.env.CREDENTIAL_KEY;
        if (!keyHex || keyHex.length !== 64) {
            // Dev fallback only — never in production
            this.logger.warn('CREDENTIAL_KEY not set — using dev fallback');
            if (doc.encryptedPayload.startsWith('{')) {
                return JSON.parse(doc.encryptedPayload);
            }
            return {};
        }

        const key = Buffer.from(keyHex, 'hex');
        const iv = Buffer.from(doc.iv, 'hex');
        const authTag = Buffer.from(doc.authTag, 'hex');

        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let plaintext = decipher.update(doc.encryptedPayload, 'hex', 'utf8');
        plaintext += decipher.final('utf8');

        return JSON.parse(plaintext);
    }
}
```

> **Note:** Processors call `await this.credentialDecryptor.decrypt(tenantId, credentialId)` and remove all inline decryption logic.

---

## Test Plan

### Unit: `credential-ownership.spec.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| Create job — valid credentials | Both creds belong to tenant | Job created, enqueued |
| Create job — source cred from another tenant | Repo returns null | Throws `BadRequestException` |
| Create job — target cred from another tenant | Repo returns null | Throws `BadRequestException` |

### Unit: `aes.service.spec.ts`

| Test | Scenario | Expected |
|------|----------|----------|
| `encrypt()` + `decrypt()` round-trip | Valid key | Decrypted = original plaintext |
| `decrypt()` tampered authTag | Modified authTag | Throws |
| `encrypt()` missing CREDENTIAL_KEY | env unset | Throws |

---

## Out of Scope for This Plan

- Full Pino structured logging (Phase 5 — replaces `Logger` calls project-wide)
- Rate limiting guard (Phase 5)
- Health check endpoint (Phase 5)
- `PLATFORM_CLONE` schema replication logic
