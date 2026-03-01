# Error Taxonomy

The platform strictly differentiates error types to ensure that millions of records can be processed without single toxic payloads destroying the overall job compute lifecycle.

## Classification

### 1. `ValidationError`
* **What**: The input Canonical Model failed Zod validation, or the target platform rejected the payload for explicit semantic reasons (e.g., "Missing tax category").
* **Action**: NO RETRY. Immediate push to Dead Letter Queue (DLQ). The worker moves on to the next entity.

### 2. `TransientError`
* **What**: Target API Rate limited, DNS resolution failed, Target Platform returned a 502 Bad Gateway.
* **Action**: EXPONENTIAL RETRY.

### 3. `FatalError`
* **What**: Target API keys revoked. Source API completely shut down. Disk out of space on Worker.
* **Action**: CIRCUIT BREAKER TRIPPED. Pause Job immediately. Do not attempt further records. Notify Tenant.

## Decision Flow Diagram

```mermaid
flowchart TD
    classDef error fill:#ef4444,stroke:#991b1b,color:#fff
    classDef warn fill:#f59e0b,stroke:#b45309,color:#fff
    classDef ok fill:#10b981,stroke:#047857,color:#fff
    classDef store fill:#6366f1,stroke:#4338ca,color:#fff

    Err([Error Thrown in Pipeline]):::error
    Check[Analyze Error Instance]

    Val["GraphQL / Semantic Error"]:::error
    Trans["Rate Limit / Network Issue"]:::warn
    Fatal["Auth Revoked"]:::error

    Retry{"Attempt below Max Retries?"}
    Wait["Delay Backoff"]:::warn
    Pipeline["Retry Load"]:::ok
    MaxLimit["Exhausted"]:::error

    DLQ[("Dead Letter Queue - Mongo")]:::store
    Note["Log to progress: failed++"]
    Continue["Continue Pipeline"]:::ok

    Break["Trip Circuit Breaker"]:::error
    Halt["Halt Entire Job"]:::error
    NoteFail["Mark Job Status = FAILED"]:::error

    Err --> Check
    Check -->|ValidationError| Val
    Check -->|TransientError| Trans
    Check -->|FatalError| Fatal

    Trans --> Retry
    Retry -->|Yes| Wait --> Pipeline
    Retry -->|No| MaxLimit --> DLQ

    Val --> DLQ
    DLQ --> Note
    DLQ --> Continue

    Fatal --> Break
    Break --> Halt
    Halt --> NoteFail
```
