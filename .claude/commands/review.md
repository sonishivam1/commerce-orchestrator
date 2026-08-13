---
description: Review the current branch diff for architecture violations, security issues, and quality before merging
---

## Branch Info
!`git branch --show-current`

## Changed Files
!`git diff --stat main...HEAD`

## Full Diff
!`git diff main...HEAD`

Review every changed file against these specific criteria:

### 1. Architecture Violations
- Does any `packages/core` file import from `@cdo/db`, `@cdo/queue`, or NestJS?
- Does any `packages/shared` file have external dependencies?
- Does a worker directly import from `@cdo/mapping` or `@cdo/connectors` without going through an Orchestrator?

### 2. Multi-Tenancy
- Does every new DB query include `tenantId` scoping?
- Do new resolvers use `@CurrentTenant()` and `@UseGuards(GqlAuthGuard)`?

### 3. Security
- Are credentials or API keys logged anywhere?
- Is `process.env` used inside a `packages/` file?
- Are there any `.env` files or secrets accidentally staged?

### 4. Data Safety
- Do new connectors upsert (idempotent) rather than blindly create?
- Is Redlock acquired before destructive target operations?

### 5. Code Quality
- Are there `console.log` or `console.error` calls? (Should use Pino.)
- Are new mappers/connectors shipped with tests?
- Are there unused imports or `any` type assertions?

Provide specific, actionable feedback per file. Flag blockers vs. suggestions.
