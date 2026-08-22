# MVP Implementation Plan

This document outlines the final steps to complete the Commerce Data Orchestrator MVP (commercetools → Shopify).

## Goal
A working, end-to-end migration pipeline for Categories, Products, Customers, and Orders between commercetools and Shopify.

## 1. Connector Contracts Implementation
- **SourceConnector (commercetools)**: Implement `extract()` for the 4 entities.
- **TargetConnector (Shopify)**: Implement `load()` as strictly idempotent upserts for the 4 entities.

## 2. Identity Mapping System
- Define the `IdentityMap` schema in `@cdo/db`.
- Inject a resolution service into the mapping layer so canonical representations can correctly resolve foreign keys (e.g., mapping a product to its migrated category).
- Update the Target Connector to return `sourceId` and `targetId` so the ETL Engine can save the mapping.

## 3. Web UI Integration
- Wire up the frontend components in `apps/web` to trigger the `CROSS_PLATFORM_MIGRATION` job.
- Ensure the Job details page reflects real-time progress, DLQ entries, and errors.
- Display the Identity Map / Reconciliation summary.

## 4. Reconciliation Engine
- Implement the count-verification and sampling checks to validate a completed migration.

## 5. Dry Run / Preview Mode
- Implement a preview logic path where data is extracted, normalized, mapped, and validated, but NOT written to the Target platform.
- Output the preview payload to the frontend.
