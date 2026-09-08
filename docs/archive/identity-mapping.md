> [!WARNING]
> **Archived / superseded.** This document describes the pre-simplification design.
> See [docs/architecture/migration-scope.md](../architecture/migration-scope.md) and
> [docs/implementation-plans/00-simplification-plan.md](../implementation-plans/00-simplification-plan.md)
> for the current design. Kept for historical context only.

# Identity Mapping

During the migration from commercetools to Shopify, entities will receive new primary IDs in Shopify. To maintain data integrity across the 4 entities and allow for idempotent updates and reconciliation, we must map the original commercetools ID to the new Shopify ID.

## The Challenge
- A commercetools `Category` has an ID (e.g., `ct-cat-123`).
- When inserted into Shopify, it receives a new ID (e.g., `gid://shopify/Collection/456`).
- When a `Product` is migrated, it needs to reference the *Shopify* Category ID, but the source data only has the *commercetools* Category ID.

## MVP Identity Resolution Strategy
To resolve references, we will store the Identity Map natively within the Migration Orchestrator's database (or Redis cache).

### Workflow
1. **Target Upsert**: The `TargetConnector` upserts the entity (e.g., Category) into Shopify.
2. **Result Return**: Shopify returns the new `gid`.
3. **Map Storage**: The ETL Engine records `{ tenantId, entityType: 'CATEGORY', sourceId: 'ct-cat-123', targetId: 'gid://shopify/Collection/456' }`.
4. **Reference Resolution**: When migrating Products, the `ProductMapper` queries the Identity Map to translate `ct-cat-123` into `gid://shopify/Collection/456` before sending the payload to the Target Connector.

> [!NOTE]
> For the MVP, we will rely on a dedicated MongoDB collection (`IdentityMap`) to persist these linkages.
