# Entity Relationships & Dependencies

During migration, entities must be processed in a specific topological order to satisfy foreign key constraints in the Target platform.

## Migration Order
To ensure a successful migration, entities MUST be migrated in the following sequence:

1. **Categories**: Have self-referencing dependencies (parent/child) and must exist before Products.
2. **Products**: Depend on Categories.
3. **Customers**: Standalone, but must exist before Orders.
4. **Orders**: Depend on Customers and Products (Line Items).

## Dependency Resolution
When the target platform assigns a new primary ID to a migrated entity, that ID is stored in the `IdentityMap`.
Downstream entities use the `IdentityMap` to resolve foreign keys before upsert.
- e.g., When migrating a Product, its Canonical `categories` list (which contains commercetools keys) is translated into Shopify `gid`s via the Identity Map before writing to Shopify.
