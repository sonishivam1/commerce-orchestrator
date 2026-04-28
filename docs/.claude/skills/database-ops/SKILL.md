---
name: database-ops
description: MongoDB operations skill — aggregation pipelines, bulk operations, transactions, index optimization, query profiling, data migration patterns, and advanced Mongoose usage for the Metafy platform's multi-tenant data layer.
user-invocable: true
---

# Database Operations Skill — Metafy AI Platform

## Connection Management

Each service connects independently to MongoDB. Connection is managed by `packages/database`:

```typescript
// In app.module.ts
DatabaseModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    uri: config.get('MONGODB_URI'),
    dbName: config.get('MONGODB_DB_NAME'),
  }),
  inject: [ConfigService],
}),
```

**Connection pool:** Default 5 connections. For high-throughput services (feed, data), tune via `maxPoolSize`.

---

## Aggregation Pipelines

Use aggregations for analytics, reporting, and complex cross-collection operations.

```typescript
// Always start with $match on indexed fields (orgId + projectId first)
async getProductAnalytics(orgId: string, projectId: string, startDate: Date) {
  return this.productModel.aggregate([
    // Stage 1: Filter on indexes first (most restrictive)
    {
      $match: {
        orgId,
        projectId,
        createdAt: { $gte: startDate },
        status: 'active',
      },
    },
    // Stage 2: Group
    {
      $group: {
        _id: { status: '$status', month: { $month: '$createdAt' } },
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
      },
    },
    // Stage 3: Sort
    { $sort: { '_id.month': 1 } },
    // Stage 4: Project only needed fields
    {
      $project: {
        _id: 0,
        status: '$_id.status',
        month: '$_id.month',
        count: 1,
        avgPrice: { $round: ['$avgPrice', 2] },
      },
    },
  ]);
}
```

**Aggregation rules:**
- `$match` always first — filter before you group/sort
- `$match` must use indexed fields (`orgId`, `projectId` always first)
- Never `$lookup` across service boundaries — use HTTP or Kafka
- Add `{ allowDiskUse: true }` for large aggregations that may exceed 100MB memory

---

## Bulk Operations

For processing large datasets (feed syncs, enrichment):

```typescript
async bulkUpsertProducts(products: Partial<Product>[], orgId: string, projectId: string) {
  const BATCH_SIZE = 500; // Never more than 1000 per bulk op
  const batches = chunk(products, BATCH_SIZE);

  for (const batch of batches) {
    const operations = batch.map(product => ({
      updateOne: {
        filter: { orgId, projectId, externalId: product.externalId },
        update: {
          $set: { ...product, updatedAt: new Date(), orgId, projectId },
          $setOnInsert: { createdAt: new Date(), createdBy: 'system' },
        },
        upsert: true,
      },
    }));

    await this.productModel.bulkWrite(operations, { ordered: false });
    // ordered: false — don't stop on first error, process all
  }
}
```

---

## Transactions (Use Sparingly)

MongoDB multi-document transactions have overhead. Only use when atomicity is truly required across multiple collections **within the same service**. Never across service boundaries.

```typescript
async transferProductToFeed(productId: string, feedId: string, orgId: string) {
  const session = await this.productModel.db.startSession();

  try {
    session.startTransaction();

    await this.productModel.findByIdAndUpdate(
      productId,
      { $set: { feedId, updatedAt: new Date() } },
      { session }
    );

    await this.feedProductModel.create(
      [{ productId, feedId, orgId, addedAt: new Date() }],
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
```

---

## Query Optimization Patterns

### Always Use .lean() for Read Queries
```typescript
// 2-3x faster — returns plain JS objects, not Mongoose Documents
const products = await this.productModel.find(filter).lean<Product[]>();
```

### Field Projection — Fetch Only What You Need
```typescript
// Fetching a list — only need name and status
const summaries = await this.productModel
  .find(filter, { name: 1, status: 1, createdAt: 1 })
  .lean();

// Never fetch full documents for list views
```

### Cursor-Based Pagination for Large Collections
```typescript
async findPaginated(filter: FilterQuery<Product>, cursor?: string, limit = 20) {
  const query = cursor
    ? { ...filter, _id: { $gt: new Types.ObjectId(cursor) } }
    : filter;

  const items = await this.productModel
    .find(query)
    .sort({ _id: 1 })
    .limit(limit + 1) // fetch one extra to know if there's a next page
    .lean();

  const hasNext = items.length > limit;
  return {
    data: items.slice(0, limit),
    nextCursor: hasNext ? items[limit - 1]._id.toString() : null,
  };
}
```

### Explain a Query (Development Debugging)
```typescript
// Check if query uses an index
const explanation = await this.productModel
  .find({ orgId, projectId, status: 'active' })
  .explain('executionStats');

// Look for: COLLSCAN (bad) vs IXSCAN (good)
// Check: totalDocsExamined should be close to nReturned
console.log(JSON.stringify(explanation.executionStats, null, 2));
```

---

## Index Management

### Current Index Strategy
```typescript
// Every collection: compound tenant index
schema.index({ orgId: 1, projectId: 1 });

// Date-sorted lists
schema.index({ orgId: 1, projectId: 1, createdAt: -1 });

// Status filtering
schema.index({ orgId: 1, projectId: 1, status: 1 });

// Unique per tenant (e.g., feed name)
schema.index({ orgId: 1, projectId: 1, name: 1 }, { unique: true });

// TTL index (auto-expire documents)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### Check Index Usage in Production
```bash
# Connect to MongoDB and run:
db.products.aggregate([{ $indexStats: {} }])
# Any index with accesses.ops === 0 after weeks is unused — remove it
```

---

## Data Migration Patterns

### Safe Field Addition (Zero Downtime)
```typescript
// Step 1: Add field to schema as OPTIONAL with default
@Prop({ default: null })
newField: string | null;

// Step 2: Deploy (app works fine — existing docs don't have the field)

// Step 3: Backfill in batches (run as a one-time script)
async backfillNewField() {
  const cursor = this.productModel.find({ newField: { $exists: false } }).cursor();
  let count = 0;

  for await (const doc of cursor) {
    await this.productModel.updateOne(
      { _id: doc._id },
      { $set: { newField: computeValue(doc) } }
    );
    count++;
    if (count % 1000 === 0) this.logger.log(`Backfilled ${count} docs`);
  }
}
```

### Safe Field Removal (Two-Deploy Process)
```
Deploy 1: Stop writing the field (but keep reading it)
Deploy 2: Remove the field from schema + add $unset migration
```

Never remove a field from schema in the same deploy where you stop writing it — old instances still running will crash.

---

## Common Query Recipes

```typescript
// Count with tenant scope
const total = await this.model.countDocuments({ orgId, projectId, status });

// Distinct values
const statuses = await this.model.distinct('status', { orgId, projectId });

// Check existence efficiently (don't fetch full doc)
const exists = await this.model.exists({ orgId, projectId, externalId });

// Paginated with total count (parallel)
const [data, total] = await Promise.all([
  this.model.find(filter).skip(skip).limit(limit).lean(),
  this.model.countDocuments(filter),
]);

// Find most recent N
const recent = await this.model
  .find({ orgId, projectId })
  .sort({ createdAt: -1 })
  .limit(10)
  .lean();

// Update and return new doc
const updated = await this.model.findByIdAndUpdate(
  id,
  { $set: updates },
  { new: true, lean: true }
);
```
