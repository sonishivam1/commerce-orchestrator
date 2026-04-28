---
description: MongoDB/Mongoose database rules — auto-loads when editing schema, repository, or migration files
globs:
  - "**/*.schema.ts"
  - "**/*.repository.ts"
  - "**/schemas/*.ts"
  - "**/repositories/*.ts"
  - "**/migrations/*.ts"
  - "packages/database/src/**/*.ts"
---

# Database Rules (Auto-loaded for schema/repository/migration files)

## BaseSchema — Always Extend It
```typescript
// CORRECT
@Schema({ timestamps: true, collection: 'products' })
export class Product extends BaseSchema {
  // DO NOT declare: orgId, projectId, createdBy, updatedBy, createdAt, updatedAt
  // BaseSchema provides all of these automatically
  @Prop({ required: true })
  name: string;
}

// WRONG — manually re-declaring what BaseSchema already provides
export class Product extends BaseSchema {
  @Prop({ required: true })
  orgId: string; // WRONG — already in BaseSchema
}
```

## BaseRepository — Always Extend It
```typescript
@Injectable()
export class ProductRepository extends BaseRepository<Product> {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {
    super(productModel);
  }
  // Custom query methods go here — call this.model internally
}
```

## Indexes — Mandatory Pattern
Every schema MUST have compound indexes starting with `orgId + projectId`:

```typescript
// After SchemaFactory.createForClass():
ProductSchema.index({ orgId: 1, projectId: 1 });                          // base compound
ProductSchema.index({ orgId: 1, projectId: 1, createdAt: -1 });           // date sort
ProductSchema.index({ orgId: 1, projectId: 1, status: 1 });               // filter by status
ProductSchema.index({ orgId: 1, projectId: 1, feedId: 1 });               // foreign key lookup
```

Rule: **Any field used in a `find()` filter or sort must be indexed.** Include orgId + projectId first in every compound index.

## Cross-Service References
Use string IDs — never ObjectId refs across service boundaries:

```typescript
// CORRECT — string ID
@Prop({ required: true, index: true })
productId: string;  // References product-service entity

// WRONG — ObjectId ref across service boundary
@Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Product' })
product: Product;
```

## Performance Rules
- Use `.lean()` on all read-only queries (returns plain JS objects, 2-3x faster)
- Use field projection when you don't need the full document
- Use `Promise.all()` for parallel queries

```typescript
// CORRECT
const products = await this.productModel.find(filter).lean();
const names = await this.productModel.find(filter, { name: 1, status: 1 }).lean();

// WRONG — full Mongoose documents for a read-only operation
const products = await this.productModel.find(filter); // no .lean()
```

## Pagination
Use skip/limit for small datasets. For large collections (>10K docs), prefer cursor-based pagination:

```typescript
// Skip/limit (acceptable up to ~10K docs)
const data = await this.model.find(filter).skip((page-1) * limit).limit(limit).lean();

// Large collections — cursor-based
const data = await this.model.find({
  ...filter,
  _id: { $gt: lastId }  // cursor
}).limit(limit).lean();
```

## Schema Field Rules
- `required: true` on all non-optional fields
- `index: true` on fields used in standalone queries
- `default` values set at schema level, not application level
- Enum values defined as TypeScript enum, listed in `@Prop({ enum: MyEnum })`
- Timestamps: `@Schema({ timestamps: true })` — never manually set createdAt/updatedAt
- Collection name: always explicit in `@Schema({ collection: 'collection-name' })`

## What NOT to Do in Repositories
```typescript
// WRONG — unscoped query (cross-tenant data leak)
async findAll() {
  return this.model.find({}).lean(); // missing orgId/projectId
}

// WRONG — business logic in repository
async createIfNotExists(dto) {
  const existing = await this.model.findOne(...);
  if (!existing) return this.model.create(dto); // "if not exists" is business logic → put in service
}
```
