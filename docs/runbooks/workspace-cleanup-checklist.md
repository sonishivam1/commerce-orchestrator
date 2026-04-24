# Workspace Cleanup Checklist

To safely deprecate your existing procedural implementation and move to the SaaS architecture, follow these exact steps. **Do not execute them simultaneously; implement sequentially.**

## Step 1: Initialize the Monorepo (Done)
- [x] Create `commerce-orchestrator` root directory
- [x] Create `pnpm-workspace.yaml`
- [x] Define root `package.json` with Turborepo config

## Step 2: Establish `@cdo/shared`
- [ ] Migrate current type definitions and Mappings from `ct-products-catalog-creation` into `commerce-orchestrator/packages/shared/src/models/`
- [ ] Define Zod schemas for the Canonical Contract (Product, Category, Customer, Order)
- [ ] Ensure this package exports `index.ts` containing the shared Types and Enums used globally

## Step 3: Implement The Core Engine (`@cdo/core`)
- [ ] Implement the `TargetConnector` and `SourceConnector` Interfaces
- [ ] Write the `EtlEngine` stream runner (Extract $\rightarrow$ Transform $\rightarrow$ Load loop)
- [ ] Establish event emission (`EventEmitter`) for updating the Worker process via hooks

## Step 4: Extract the Connectors (`@cdo/connectors`)
- [ ] Create `packages/connectors/commercetools`
- [ ] Wrap `@commercetools/sdk-client-v2` into a generic client class
- [ ] Write `CommercetoolsTargetConnector` (Implementing Target from Core interface)
- [ ] *Remove* hardcoded `.env` checks and pass credentials into the class constructor instead

## Step 5: Extract Ingestion (`@cdo/ingestion`)
- [ ] Move your existing scrapers (`costco-scraper.js`, `jaycar-scraper.js`) over to `packages/ingestion/`
- [ ] Ensure they return raw unformatted arrays / streams, removing commerce-specific mapping

## Step 6: Extract Mapping (`@cdo/mapping`)
- [ ] Build the normalization layer, transforming the data formats coming from `ingestion` or `BigCommerce` into strictly compliant `@cdo/shared` Canonical Interfaces

## Step 7: Build the Database layer (`@cdo/db`)
- [ ] Implement `tenant.schema.ts`, `job.schema.ts`, `credential.schema.ts` (with `mongoose`).
- [ ] Implement Repositories that enforce `tenantId` checking via construction

## Step 8: Build Applications (`apps/*`)
- [ ] Scaffold `apps/api` (NestJS @nestjs/graphql) out to manage GraphQL Queries/Mutations and push workloads directly to BullMQ (`@cdo/queue`)
- [ ] Scaffold `apps/worker` (NestJS) out to host incoming messages from BullMQ, decrypt credentials from DB, instantiate the appropriate Connectors, and run the Core Engine Etl Pipeline

## Step 9: Final Deprecation
- [ ] Verify test flows inside the worker.
- [ ] Only when the new system performs a single-product scrape to CT reliably, archive `ct-products-catalog-creation`.

## Step 10: Enterprise Scale Hardening
- [ ] Add orchestrator package logic for safe wiring of worker components
- [ ] Add canonical versioning support to connection adapters
- [ ] Add locking mechanism (Target environment Redis Redlocks)
- [ ] Add error taxonomy logic into `@cdo/shared` and Pipeline Error handlers
- [ ] Add observability hooks inside the pipeline execution
- [ ] Add structured logging (Winston/Pino nested inside worker context)
- [ ] Add correlation IDs spanning API request through Worker execution
