# System Overview

Commerce Data Orchestrator is a specialized data migration platform focused on reliably moving commerce data between systems.

## The MVP Scope
The initial MVP boundary is strictly limited to:
- **Source**: commercetools
- **Target**: Shopify
- **Entities**: Categories, Products, Customers, Orders

## High-Level Architecture
The architecture is designed to be a simple, one-way pipeline without complex workflow engines or generic abstractions.

```mermaid
graph TD
    A[Web UI] --> B[API (Control Plane)]
    B --> C[Migration Orchestrator]
    C --> D[Redis Queue (BullMQ)]
    D --> E[ETL Worker]
    
    subgraph "ETL Worker Pipeline"
        E --> F[Source Connector]
        F --> G[Normalize]
        G --> H[Canonical Model]
        H --> I[Map]
        I --> J[Validate]
        J --> K[Target Connector]
        K --> L[Identity Mapping]
    end
    
    L --> M[Reconciliation]
```

### Components
1. **Web**: Next.js App Router for user control.
2. **API**: NestJS GraphQL control plane.
3. **Migration Orchestrator**: Submits migration jobs to the queue.
4. **Queue**: Redis + BullMQ for asynchronous task execution.
5. **ETL Worker**: Processes jobs in batches using the ETL Engine.
6. **ETL Engine**: The core pipeline that connects Source to Target via Canonical normalization and mapping.
7. **Identity Mapping**: Tracks entity ID changes across platforms.
8. **Reconciliation**: Verifies success and data parity post-migration.
