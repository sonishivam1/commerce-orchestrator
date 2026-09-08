> [!WARNING]
> **Archived / superseded.** This document describes the pre-simplification design.
> See [docs/architecture/migration-scope.md](../architecture/migration-scope.md) and
> [docs/implementation-plans/00-simplification-plan.md](../implementation-plans/00-simplification-plan.md)
> for the current design. Kept for historical context only.

# Reconciliation

Reconciliation is the final phase of the migration lifecycle. It verifies that the data successfully extracted from the source exactly matches the data residing in the target, ensuring a complete and accurate migration.

## MVP Reconciliation Scope
For the MVP (commercetools → Shopify), reconciliation focuses on the 4 supported entities: Categories, Products, Customers, and Orders.

## Strategy
1. **Count Verification**: Compare the total count of successfully migrated entities (from our ETL metrics and Identity Map) against the source count.
2. **Data Parity Check (Sampling)**: Randomly sample migrated entities, fetching them from both the source and target using the Identity Map to assert that key canonical fields (e.g., price, sku, name) match.

## Process Flow
1. User triggers reconciliation via the Web UI after a migration job completes.
2. The API submits a `RECONCILIATION` job to the Queue.
3. The ETL Worker processes the job, aggregating the totals and performing the parity checks.
4. Discrepancies are logged as errors, and a final summary report is generated.
