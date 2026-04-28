---
name: db-schema
description: Design or review a MongoDB schema for a Metafy AI Platform service
argument-hint: "[domain name, e.g. 'checkout-session' or 'product-variant']"
---

Design or review the database schema for: $ARGUMENTS

## Process

### If Designing a New Schema

1. **Identify the domain** — which service owns this data?
2. **Define the fields** following these rules:
   - ALWAYS extend `BaseSchema` (provides orgId, projectId, createdBy, updatedBy, timestamps)
   - Never manually declare: orgId, projectId, createdBy, updatedBy, createdAt, updatedAt
   - Mark required fields with `required: true`
   - Use TypeScript enums for status/type fields
   - Use string IDs (not ObjectId refs) for cross-service relationships
   - Keep structure flat — avoid deep nesting

3. **Define indexes**:
   - ALWAYS: `{ orgId: 1, projectId: 1 }` compound index
   - For each common query: compound index starting with orgId + projectId
   - For sort-by-date: `{ orgId: 1, projectId: 1, createdAt: -1 }`
   - For status filtering: `{ orgId: 1, projectId: 1, status: 1 }`
   - Unique constraints: scoped to orgId where appropriate

4. **Generate** the complete schema file following this template:
   ```typescript
   // apps/[service]/src/[domain]/schemas/[domain].schema.ts
   import { BaseSchema } from '@metafy/database';
   import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
   import { Document } from 'mongoose';

   export type [Domain]Document = [Domain] & Document;

   @Schema({ timestamps: true, collection: '[collection-name]' })
   export class [Domain] extends BaseSchema {
     // fields here
   }

   export const [Domain]Schema = SchemaFactory.createForClass([Domain]);

   // Indexes
   [Domain]Schema.index({ orgId: 1, projectId: 1 });
   [Domain]Schema.index({ orgId: 1, projectId: 1, createdAt: -1 });
   ```

### If Reviewing an Existing Schema

Check:
- [ ] Extends BaseSchema (not manually declaring tenant fields)
- [ ] Collection name explicitly set
- [ ] All required fields marked
- [ ] Compound indexes start with orgId + projectId
- [ ] No cross-service ObjectId refs
- [ ] Array fields bounded (will they grow indefinitely?)
- [ ] Sensitive fields never stored in plain text
- [ ] Enum fields use TypeScript enum

### Migration Script

If adding indexes to an existing collection, also create:
```typescript
// apps/[service]/src/migrations/[timestamp]-add-[name]-indexes.ts
```

Report the migration command to run after schema changes.
