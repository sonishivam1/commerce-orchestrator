---
name: db-migrate
description: Create and apply a database migration — new indexes, schema changes, or data backfills for a Metafy service
argument-hint: "[migration description, e.g. 'add status index to products']"
---

Database migration for: $ARGUMENTS

## Execute autonomously

### Step 1: Understand What Needs to Change
Identify:
- Which service and collection is affected
- Is this an index addition, field addition, or data backfill?
- Is there an existing migration pattern in this service to follow?

Check for existing migrations:
```bash
find apps/[service]/src -name "*.migration.ts" -o -name "*migration*" | head -20
ls apps/[service]/src/migrations/ 2>/dev/null
```

### Step 2: Read the Current Schema
Read the schema file for the affected collection. Understand current indexes and fields.

### Step 3: Plan the Migration
State clearly:
- Collection name
- Change type: index | new field (optional, has default) | new field (required — needs backfill) | data transform
- Risk level: zero-downtime? requires app downtime?
- Rollback plan

### Step 4: Create the Migration File
Follow the naming convention: `[timestamp]-[description].ts`

**Index Migration Template:**
```typescript
// apps/[service]/src/migrations/[timestamp]-add-[name]-indexes.ts
import { Connection } from 'mongoose';

export async function up(connection: Connection): Promise<void> {
  const collection = connection.collection('[collection-name]');

  // Create indexes
  await collection.createIndex(
    { orgId: 1, projectId: 1, status: 1 },
    { background: true, name: 'idx_tenant_status' }
  );

  console.log('Migration: added tenant_status index to [collection]');
}

export async function down(connection: Connection): Promise<void> {
  const collection = connection.collection('[collection-name]');
  await collection.dropIndex('idx_tenant_status');
}
```

**Optional Field Addition (zero-downtime):**
```typescript
// New optional field with a default — safe to add without downtime
// Just update the Mongoose schema with @Prop({ default: value })
// No data migration needed for optional fields with defaults
```

**Required Field Backfill (needs migration):**
```typescript
export async function up(connection: Connection): Promise<void> {
  const collection = connection.collection('[collection]');

  // Backfill in batches to avoid memory issues
  const batchSize = 1000;
  let lastId = null;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId }, newField: { $exists: false } } : { newField: { $exists: false } };
    const docs = await collection.find(query).limit(batchSize).toArray();

    if (docs.length === 0) break;

    await collection.bulkWrite(
      docs.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { newField: computeDefaultValue(doc) } }
        }
      }))
    );

    lastId = docs[docs.length - 1]._id;
    console.log(`Migrated batch, last _id: ${lastId}`);
  }
}
```

### Step 5: Update the Schema File
Add the new index definition to the schema file (after SchemaFactory.createForClass):
```typescript
CollectionSchema.index({ orgId: 1, projectId: 1, newField: 1 }, { name: 'idx_tenant_newfield' });
```

### Step 6: Verify Migration Locally
```bash
# Check what indexes currently exist
cd apps/[service] && npm run migration:indexes:verify 2>&1

# Apply the migration (dev environment only)
cd apps/[service] && npm run migration:indexes:up 2>&1
```

### Step 7: Report
- Migration file created at: [path]
- Schema file updated at: [path]
- Collection affected: [name]
- Indexes added: [list]
- Rollback command: `npm run migration:indexes:down`
- Production apply instructions: [steps to run on staging first, then production]

**IMPORTANT:** Never run migrations against production directly — always staging first.
