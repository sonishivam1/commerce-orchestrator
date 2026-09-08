# Documentation

Start here.

## Current design

| Doc | What it covers |
|---|---|
| [architecture/migration-scope.md](architecture/migration-scope.md) | What the product is and is not. Read this first. |
| [architecture/system-overview.md](architecture/system-overview.md) | Apps, packages, request→run flow, infra. |
| [architecture/dependency-graph.md](architecture/dependency-graph.md) | Package boundaries and the one-way dependency rule. |
| [architecture/run-lifecycle.md](architecture/run-lifecycle.md) | The single `MIGRATION_RUN` job: modes, pipeline, states, errors. |
| [architecture/connector-contracts.md](architecture/connector-contracts.md) | `SourceConnector` / `TargetConnector` interfaces and guarantees. |
| [data-models/schemas.md](data-models/schemas.md) | The 6 MongoDB collections, incl. Org/User. |
| [data-models/entity-relationships.md](data-models/entity-relationships.md) | Migration order + foreign-key resolution. |
| [data-models/canonical-models.md](data-models/canonical-models.md) | The Universal Canonical Contract. |
| [operations/error-taxonomy.md](operations/error-taxonomy.md) | `VALIDATION` / `TRANSIENT` / `FATAL`. |
| [operations/retry-strategy.md](operations/retry-strategy.md) | Backoff policy. |
| [operations/observability.md](operations/observability.md) | Logging, `requestId`. |

## Work in progress

| Doc | |
|---|---|
| [implementation-plans/00-simplification-plan.md](implementation-plans/00-simplification-plan.md) | Phased plan to bring the code in line with the current design. |

## Onboarding

`onboarding/getting-started.md`, `onboarding/local-development.md`, `onboarding/contribution-guide.md`.

## Archive

`archive/` holds the pre-simplification design docs (four job topologies, `PLATFORM_CLONE`, wave planner, reconciliation engine, Redlock, canonical versioning, historical phase plans). Kept for context; not authoritative.
