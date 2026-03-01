# System Overview

## Purpose
The Commerce Data Orchestration Platform is a multi-tenant SaaS integration bus designed to extract, normalize, and load high-volume e-commerce data across different platforms (commercetools, Shopify, BigCommerce) and origins (web scraping, file uploads).

## The Core Concept: The Universal Canonical Contract
The system operates on an ETL (Extract, Transform, Load) paradigm built around a **Universal Canonical Contract**. Connectors (the spokes) do not communicate directly with each other. They only speak the "Canonical Language" (the hub).
* An Input Spoke (API Source, or Scraper) transforms its proprietary format into a `CanonicalProduct`.
* An Output Spoke (Target API) takes a `CanonicalProduct` and transforms it into its proprietary mutation payload.

## Architecture

```mermaid
flowchart LR
    classDef client fill:#3b82f6,color:#fff,stroke:#1d4ed8
    classDef api fill:#10b981,color:#fff,stroke:#047857
    classDef worker fill:#f59e0b,color:#fff,stroke:#b45309
    classDef db fill:#6366f1,color:#fff,stroke:#4338ca
    classDef contract fill:#f43f5e,color:#fff,stroke:#e11d48
    
    subgraph ClientLayer [Client Layer]
        Web[Next.js App Router]:::client
    end
    
    subgraph ControlPlane [Control Plane]
        API[NestJS API]:::api
    end
    
    subgraph SharedState [Shared State]
        Mongo[(MongoDB Atlas)]:::db
        Redis[(Redis Queue + Mutex)]:::db
    end
    
    subgraph WorkerPlane [Worker Plane]
        Worker[NestJS Worker Clusters]:::worker
        Orch[Orchestrator Layer]:::worker
        Worker -- "Pull Job" --> Redis
        Worker -- "Delegates to" --> Orch
    end
    
    subgraph PipelineRuntime [Pipeline Runtime]
        Ing[Ingestion Layer]
        Norm[Normalization Layer]
        Map[Mapping Layer]
        Val[Validate]
        Canon[Canonical Contract v1]:::contract
        Core[Core Engine]
        Dep[Deployment Layer]
        
        Ing --> Norm
        Norm --> Map
        Map --> Val
        Val --> Canon
        Canon --> Core
        Core --> Dep
    end
    
    Web -->|Job Trigger| API
    API -->|Validation & Auth| Mongo
    API -->|Enqueue Work & Mutex Lock| Redis
    
    Orch -.->|Injects Context/Wires| Ing
    Dep -.->|Upserts| Target((Target Store))
```

## Layer Separation
- **Client Layer**: Pure presentation. React Server components securely fetch state.
- **Control Plane**: Stateless, synchronous. Ensures `tenantId` is applied and valid. Encrypts credentials.
- **Worker Plane**: Heavy computation. Stateless and horizontally scalable. Runs core pipelines.
- **Orchestrator Layer**: Wires disparate systems together securely.
- **Pipeline Runtime**: Holds Ingestion, Mapping, deployment logic isolated physically from Worker Plane.
- **Shared State Layer**: Source of truth (Jobs state, credentials, Distributed Redlock queues).
