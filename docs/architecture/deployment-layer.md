# Deployment Layer

The Deployment Layer (`@repo/connectors/target`) handles the mutation of data against target platforms.

## Core Philosophy: Idempotency & Upserts
Target Connectors almost never blindly execute a "Create Mutation". 
ETL jobs can and will fail mid-flight due to network issues. If a job crashes at record `50,000` out of `100,000`, the job is restarted. The first `50,000` records *must not be duplicated*.
- Connectors enforce **Upsert Strategies**.
- e.g. commercetools relies on `import-api` which handles upsert merging gracefully.

## Capability Detection & Project Cloning
Some workflows (like `PLATFORM_CLONE`) require exactly replicating structural environments.
Target connectors emit their `getCapabilities()`.
- If cloning, the orchestrator tells the Source to `extractSchema()`, and passes it to the Target `deploySchema()`.
- E.g. Target commercetools connector queries if `TaxCategory` exists. If not, it creates it *before* attempting to inject products.

## Deployment Separation Diagram
```mermaid
flowchart TD
    Canon[Canonical Payload Validated] --> Decide{Job Type?}
    
    Decide -->|MIGRATION| UpsertEntities[Upsert Entity Batch]
    Decide -->|PLATFORM_CLONE| SyncSchema[Synchronize Root Schemas]
    
    SyncSchema --> UpsertEntities
    
    UpsertEntities --> RateLimit[Throttling / Queue Controller]
    RateLimit --> SDK[Native API SDK]
    SDK --> Store[(Target Store)]
```
