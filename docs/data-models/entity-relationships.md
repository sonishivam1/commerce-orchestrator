# Entity Relationships & Migration Order

During a run, commerce entities must be written in an order that satisfies foreign-key dependencies in the target platform.

## Fixed migration order

```
1. CATEGORIES   — self-referencing (parent/child); must exist before products
2. PRODUCTS     — reference categories
3. CUSTOMERS    — standalone; must exist before orders
4. ORDERS       — reference customers and products (line items)
```

This order is a **hardcoded constant** (`CANONICAL_ENTITY_ORDER` in `@cdo/shared`). A project's `entityTypes` selection is filtered against it — e.g. selecting `[ORDERS, PRODUCTS]` runs `PRODUCTS` then `ORDERS`. There is no runtime topological sort.

## Foreign-key resolution

When the target platform assigns a new id to a written entity, the pair `{ entityType, sourceId, targetId }` is stored in `identity_maps` (scoped to the run).

Downstream waves translate references before writing:

| Wave | Reference | Resolved via |
|---|---|---|
| PRODUCTS | `categoryKeys` (source category ids) | `identity_maps` where `entityType = CATEGORIES` |
| ORDERS | `customerId` | `identity_maps` where `entityType = CUSTOMERS` |
| ORDERS | line-item product ids | `identity_maps` where `entityType = PRODUCTS` |

If a reference cannot be resolved (the referenced entity was not part of this run and does not already exist in the target), the item is recorded as a `VALIDATION` failure and skipped.

## Export mode

`EXPORT` runs do not use `identity_maps`. Each entity type is written to the output file as-is in canonical form; references stay as source ids.
