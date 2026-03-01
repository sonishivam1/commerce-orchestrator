# Deployment Layer

The Deployment Layer (`@cdo/connectors/target`) handles the mutation of data against target platforms.

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
    classDef canon fill:#f43f5e,stroke:#e11d48,color:#fff
    classDef action fill:#f59e0b,stroke:#b45309,color:#fff
    classDef infra fill:#6366f1,stroke:#4338ca,color:#fff
    classDef store fill:#10b981,stroke:#047857,color:#fff

    Canon["Canonical Payload Validated"]:::canon
    Decide{"Job Type?"}
    UpsertEntities["Upsert Entity Batch"]:::action
    SyncSchema["Synchronize Root Schemas"]:::action
    RateLimit["Throttling / Queue Controller"]:::infra
    SDK["Native API SDK"]:::infra
    Store[("Target Store")]:::store

    Canon --> Decide
    Decide -->|MIGRATION| UpsertEntities
    Decide -->|PLATFORM_CLONE| SyncSchema
    SyncSchema --> UpsertEntities
    UpsertEntities --> RateLimit
    RateLimit --> SDK
    SDK --> Store
```
