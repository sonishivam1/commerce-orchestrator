# Observability

## Strategy
Given the distributed nature of the async Worker clusters and API servers, log streams must be deterministic and fully correlated to rebuild the state of an ETL job if a Node pod crashes.

### Structured Logging
No `console.log()` strings are permitted. All output is handled through a NestJS global Pino/Winston logger emitting JSON lines `stdout`. E.g.:
```json
{"level":"info", "tenantId":"abc-123", "jobId":"1111", "msg":"Upserted 50 CanonicalProducts"}
```

### Correlation & Tracing
Every Job executed carries a `traceId`. Every GraphQL Operation executed carries a `correlationId`.

## Telemetry Execution

```mermaid
flowchart TD
    classDef api fill:#10b981,stroke:#047857,color:#fff
    classDef infra fill:#6366f1,stroke:#4338ca,color:#fff
    classDef log fill:#f59e0b,stroke:#b45309,color:#fff
    classDef store fill:#0891b2,stroke:#0e7490,color:#fff

    API["NestJS API"]:::api
    Middleware["Observability Interceptor"]:::api
    Redis[("BullMQ")]:::infra
    Worker["Worker Cluster"]:::infra
    Context["AsyncLocalStorage - ALS"]:::infra
    Log1["info: Setting up target"]:::log
    Log2["info: Batch loaded"]:::log
    Log3["error: Rate limit hit"]:::log
    ELK[("Kibana / DataDog")]:::store

    API -->|"Extracts JWT & Assigns traceId"| Middleware
    Middleware -->|"Enqueues Job with traceId"| Redis
    Worker -->|"Reads traceId"| Context
    Context --> Log1
    Context --> Log2
    Context --> Log3
    Log1 --> ELK
    Log2 --> ELK
    Log3 --> ELK
```
