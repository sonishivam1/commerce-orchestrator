---
name: database-ops
description: MongoDB operations skill for Commerce Data Orchestrator. Encodes tenant-scoped Mongoose schemas, repository patterns, DLQ management, bulk upserts, index strategy, and migration patterns. Invoke when working with any database schema, query, or data access layer.
user-invocable: true
---

# Database Operations Skill — Commerce Data Orchestrator

## Connection Management

`@cdo/db` is a `@Global()` NestJS module — all schemas and repositories are available across the monorepo.

```typescript
// packages/db/src/database.module.ts
@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: (config: ConfigService) => ({
                uri: config.get('MONGODB_URI'),
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forFeature([
            { name: Job.name, schema: JobSchema },
            { name: Credential.name, schema: CredentialSchema },
            { name: Tenant.name, schema: TenantSchema },
            { name: DLQItem.name, schema: DLQItemSchema },
        ]),
    ],
    providers: [JobRepository, CredentialRepository, TenantRepository, DLQRepository],
    exports: [JobRepository, CredentialRepository, TenantRepository, DLQRepository],
})
export class DatabaseModule {}
```

---

## Schema Patterns

### Every Schema Must Have tenantId

```typescript
// packages/db/src/schemas/job.schema.ts
@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
    @Prop({ required: true, index: true })
    tenantId: string;                    // ALWAYS required, ALWAYS indexed

    @Prop({ required: true, enum: JobKind })
    kind: JobKind;

    @Prop({ required: true, enum: JobStatus, default: JobStatus.PENDING })
    status: JobStatus;

    @Prop({ required: true })
    sourcePlatform: string;

    @Prop({ required: true })
    targetPlatform: string;

    @Prop({ required: true })
    sourceCredentialId: string;

    @Prop({ required: true })
    targetCredentialId: string;

    @Prop({ type: Object, default: {} })
    progress: {
        total?: number;
        processed?: number;
        failed?: number;
    };
}

export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ tenantId: 1, status: 1 });
JobSchema.index({ tenantId: 1, createdAt: -1 });
```

### Credential Schema (Encrypted)

```typescript
@Schema({ timestamps: true, collection: 'credentials' })
export class Credential {
    @Prop({ required: true, index: true })
    tenantId: string;

    @Prop({ required: true })
    platform: string;                     // 'commercetools' | 'shopify' | etc.

    @Prop({ required: true })
    label: string;                        // Human-readable name

    @Prop({ required: true })
    encryptedPayload: string;             // AES-256-GCM encrypted JSON

    @Prop({ required: true })
    iv: string;                           // Initialization vector (hex)

    @Prop({ required: true })
    authTag: string;                      // GCM auth tag (hex)
}
```

### DLQ (Dead Letter Queue) Schema

```typescript
@Schema({ timestamps: true, collection: 'dlq' })
export class DLQItem {
    @Prop({ required: true, index: true })
    tenantId: string;

    @Prop({ required: true, index: true })
    jobId: string;

    @Prop({ required: true })
    entityKey: string;                    // CanonicalEntity.key

    @Prop({ required: true })
    errorType: string;                    // ErrorType enum value

    @Prop({ required: true })
    errorMessage: string;

    @Prop({ type: Object })
    entitySnapshot: Record<string, unknown>; // The failed entity data

    @Prop({ default: false })
    replayed: boolean;

    @Prop()
    replayedAt?: Date;
}

export const DLQItemSchema = SchemaFactory.createForClass(DLQItem);
DLQItemSchema.index({ tenantId: 1, jobId: 1 });
DLQItemSchema.index({ tenantId: 1, replayed: 1 });
```

---

## Repository Patterns

### Tenant-Scoped Queries (MANDATORY)

```typescript
// packages/db/src/repositories/job.repository.ts
@Injectable()
export class JobRepository {
    constructor(@InjectModel(Job.name) private readonly model: Model<JobDocument>) {}

    // EVERY method scopes by tenantId
    async findAllForTenant(tenantId: string): Promise<JobDocument[]> {
        return this.model.find({ tenantId }).sort({ createdAt: -1 }).lean();
    }

    async findById(tenantId: string, jobId: string): Promise<JobDocument | null> {
        return this.model.findOne({ _id: jobId, tenantId }).lean();
    }

    async updateStatus(tenantId: string, jobId: string, status: JobStatus): Promise<void> {
        await this.model.updateOne(
            { _id: jobId, tenantId },  // Always include tenantId!
            { $set: { status } },
        );
    }

    async updateProgress(tenantId: string, jobId: string, progress: Partial<Job['progress']>): Promise<void> {
        await this.model.updateOne(
            { _id: jobId, tenantId },
            { $set: { progress } },
        );
    }
}
```

### DLQ Repository

```typescript
@Injectable()
export class DLQRepository {
    constructor(@InjectModel(DLQItem.name) private readonly model: Model<DLQItemDocument>) {}

    async create(item: Partial<DLQItem>): Promise<DLQItemDocument> {
        return this.model.create(item);
    }

    async findAllForJob(tenantId: string, jobId: string): Promise<DLQItemDocument[]> {
        return this.model.find({ tenantId, jobId }).lean();
    }

    async findReplayableItems(tenantId: string, jobId: string): Promise<DLQItemDocument[]> {
        return this.model.find({ tenantId, jobId, replayed: false }).lean();
    }

    async markReplayed(tenantId: string, itemId: string): Promise<void> {
        await this.model.updateOne(
            { _id: itemId, tenantId },
            { $set: { replayed: true, replayedAt: new Date() } },
        );
    }

    async countPendingForJob(tenantId: string, jobId: string): Promise<number> {
        return this.model.countDocuments({ tenantId, jobId, replayed: false });
    }
}
```

---

## Query Optimization

```typescript
// Always use .lean() for read queries (2-3x faster)
const jobs = await this.model.find({ tenantId }).lean();

// Field projection — fetch only what you need
const summaries = await this.model
    .find({ tenantId }, { kind: 1, status: 1, createdAt: 1, progress: 1 })
    .lean();

// Cursor-based pagination for large collections
async findPaginated(tenantId: string, cursor?: string, limit = 20) {
    const filter: any = { tenantId };
    if (cursor) filter._id = { $gt: new Types.ObjectId(cursor) };

    const items = await this.model
        .find(filter)
        .sort({ _id: 1 })
        .limit(limit + 1)
        .lean();

    const hasNext = items.length > limit;
    return {
        data: items.slice(0, limit),
        nextCursor: hasNext ? items[limit - 1]._id.toString() : null,
    };
}
```

---

## Index Strategy

```typescript
// Every collection MUST have:
schema.index({ tenantId: 1 });                    // Base tenant filter
schema.index({ tenantId: 1, createdAt: -1 });     // Sorted lists
schema.index({ tenantId: 1, status: 1 });         // Status filtering

// DLQ-specific:
schema.index({ tenantId: 1, jobId: 1 });          // Per-job DLQ lookup
schema.index({ tenantId: 1, replayed: 1 });       // Replayable items
```

---

## Checklist

- [ ] Every schema has `tenantId` as a required, indexed field
- [ ] Every repository method accepts and uses `tenantId`
- [ ] Never call `this.model.find({})` without tenant scope
- [ ] Use `.lean()` for all read queries
- [ ] Compound indexes start with `tenantId`
- [ ] Credential data is encrypted — never stored plain text
- [ ] DLQ items capture `entitySnapshot` for replay capability
