# Migration Lifecycle

The migration of data from the Source platform (commercetools) to the Target platform (Shopify) follows a strict, trackable lifecycle.

## 1. Job Creation
A user initiates a `CROSS_PLATFORM_MIGRATION` job via the Web UI. The API validates credentials, creates a job record in the database (`Status: PENDING`), and pushes the job to the BullMQ Redis queue.

## 2. Extraction & Normalization
The ETL Worker picks up the job (`Status: RUNNING`).
- The `SourceConnector` begins extracting data in batches.
- Data is normalized into the `CanonicalEntity`.

## 3. Mapping & Validation
- The Canonical data is mapped to the Target platform's schema.
- Zod validators ensure the target payload is structurally sound.

## 4. Load (Upsert)
- The `TargetConnector` upserts the batch into the target platform.
- New target IDs are recorded in the `IdentityMap`.

## 5. Completion & Reconciliation
- When extraction is exhausted and all batches are written, the job is marked `COMPLETED`.
- The reconciliation process is triggered to verify entity counts and data parity.
