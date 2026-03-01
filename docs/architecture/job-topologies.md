# Job Topologies

The system supports polymorphic workloads routed to different worker pools based on their compute profile.

## Topology Pipeline Flows

### 1. `SCRAPE_IMPORT`
Public HTML → Raw JSON → Normalize → Canonical Model → Target Platform.

```mermaid
flowchart LR
    Website([Website]) -->|Playwright| Ingestion[repo/ingestion]
    Ingestion -->|Raw HTML Output| Norm[Normalization Layer]
    Norm -->|Clean JSON| Mapping[repo/mapping]
    Mapping -->|Validated Canonical| Core[repo/core Engine]
    Core -->|Load Batch| Target[repo/connectors]
    Target --> Store[(Target Platform)]
```

### 2. `CROSS_PLATFORM_MIGRATION`
Source Platform → Canonical Model → Target Platform.

```mermaid
flowchart LR
    StoreA[(Source Platform)] -->|Extract| SourceConn[Source Connector]
    SourceConn -->|Raw SDK Object| Mapping[repo/mapping]
    Mapping -->|Validated Canonical| Core[repo/core Engine]
    Core -->|Load Batch| TargetConn[Target Connector]
    TargetConn -->|SDK Upsert| StoreB[(Target Platform)]
```

### 3. `PLATFORM_CLONE`
Strict **two-phase** replication process.
- **Phase 1**: Schema replication (Types, Channels, Tax Categories).
- **Phase 2**: Entity replication (Products, Customers, Orders).

```mermaid
sequenceDiagram
    participant Worker
    participant SourceCT as Source CT Project
    participant TargetCT as Target CT Project

    Note over Worker,TargetCT: Phase 1 - Schema Replication
    Worker->>SourceCT: extractSchema()
    SourceCT-->>Worker: CustomTypes, Channels, TaxCategories
    Worker->>TargetCT: deploySchema()
    TargetCT-->>Worker: OK (Idempotent)

    Note over Worker,TargetCT: Phase 2 - Entity Replication
    Worker->>SourceCT: extractEntities()
    SourceCT-->>Worker: Products, Customers
    Worker->>Worker: mapToCanonical()
    Worker->>TargetCT: loadEntities()
    TargetCT-->>Worker: Upserted OK
```

### 4. `EXPORT`
Platform → Canonical Model → CSV/JSONL file output.

```mermaid
flowchart LR
    StoreA[(Source Platform)] -->|Extract| SourceConn[Source Connector]
    SourceConn -->|Raw SDK Object| Mapping[repo/mapping]
    Mapping -->|Validated Canonical| Core[repo/core Engine]
    Core -->|Write Stream| FileOutput[File Builder]
    FileOutput --> Output[(CSV / JSONL / S3)]
```
