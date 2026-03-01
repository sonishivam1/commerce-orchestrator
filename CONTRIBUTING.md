# Contributing to Commerce Orchestrator

First off, thank you for considering contributing to the Commerce Orchestrator platform! This project is an enterprise-grade SaaS, and we maintain strict architectural rules to ensure horizontal scalability and multi-tenant safety.

## 📚 Required Reading
Before submitting code, you **must** read the following documents to understand the monorepo architecture boundaries:
1. [System Overview](docs/architecture/system-overview.md)
2. [Dependency Graph & Rules](docs/architecture/dependency-graph.md)
3. [Internal Contribution Guide](docs/onboarding/contribution-guide.md)

## 🏗️ Development Setup
This repository uses `pnpm` workspaces and Turborepo. Please ensure you have Node.js >= 18 and `pnpm` installed.

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```
2. Link local environments (Ensure Docker is running for Redis/Mongo):
   ```bash
   docker-compose up -d redis mongo
   ```
3. Run the development server across all packages and apps:
   ```bash
   pnpm turbo run dev
   ```

## 📝 Branching & Commits
- Use semantic branch names: `feature/PLATFORM-123-add-shopify`, `fix/PLATFORM-456-dlq-routing`, `refactor/core-validators`.
- Use **Conventional Commits** for your commit messages (e.g., `feat(connectors): add Shopify source capability`, `fix(core): resolve transient retry jitter`).

## 🛑 Strict Engineering Constraints
Your Pull Request will be rejected if:
1. **You breach a dependency boundary**: Do not import `@nestjs` or `@nestjs/graphql` inside `packages/core` or `packages/mapping`.
2. **You mutate global state**: No global variables. Instances must be heavily scoped to the active tenant execution pipeline.
3. **You expose PII or Credentials**: Credentials must be explicitly passed into `TargetConnector` and `SourceConnector` via the NestJS Execution Worker; they are never to be printed, logged, or hard-coded.

## 🚀 Pull Request Process

1. Provide a clear description of the problem solved or the feature added.
2. Ensure you have added corresponding unit tests (specifically for mapping rules and pure TypeScript ETL components).
3. Ensure the build and lint processes pass locally:
   ```bash
   pnpm turbo run lint
   pnpm turbo run test
   pnpm turbo run build
   ```
4. Request review from a core maintainer.

## 🐛 Reporting Bugs
Please use the GitHub Issue Tracker. Include:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Environment details (Node version, OS).
- The corresponding `traceId` or `correlationId` if applicable.
- Dead Letter Queue JSON payloads (scrubbed of sensitive data).
