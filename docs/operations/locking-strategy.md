# Locking Strategy

Concurrency scales workers, but blindly scaling commerce mutations results in data corruption, race conditions, and catastrophic API rate limit blockages. We implement distributed target environment locking.

## Concept
A Target Environment (e.g. `commercetools_project_xyz` and its API URL) is locked during a migration job.
**Rule**: No two jobs can run mutative (Write) ETL operations simultaneously against the *exact same* Target Environment for a single Tenant.

### Soft vs Hard Locks
* **Hard Lock**: Entire target environment locked. Prevents `CROSS_PLATFORM_MIGRATION` and `PLATFORM_CLONE` from stumbling over each other.
* **Soft Lock**: Entity-specific locking. Prevents concurrent upserts on the exact same SKU (rare, relies on target idempotency).

## Redis-based Distributed Locking (Redlock)

```mermaid
sequenceDiagram
    participant Worker 1
    participant Worker 2
    participant Redis
    participant Target API
    
    Worker 1->>Redis: SETNX lock:tenantXYZ:ct-demo-store
    Redis-->>Worker 1: OK (Lock Acquired)
    
    Worker 1->>Target API: Run Migration Job
    
    Worker 2->>Redis: SETNX lock:tenantXYZ:ct-demo-store
    Redis-->>Worker 2: FAIL (Locked)
    Worker 2->>Worker 2: Re-queue Job / Delay
    
    Worker 1->>Target API: Migration Complete
    Worker 1->>Redis: DEL lock:tenantXYZ:ct-demo-store
    
    Worker 2->>Redis: SETNX lock:tenantXYZ:ct-demo-store
    Redis-->>Worker 2: OK (Lock Acquired)
```
