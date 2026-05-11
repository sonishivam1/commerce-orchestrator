---
paths:
  - "docs/implementation-plans/**/*.md"
  - "apps/**/*.ts"
  - "packages/**/*.ts"
---

# Implementation Workflow Rules

## Sub-Plan Governance

Every significant feature or fix MUST have an approved sub-plan in `docs/implementation-plans/` before any code is written.

### Sub-Plan Lifecycle
1. **DRAFT** — Written by the architect. Stored in `docs/implementation-plans/`.
2. **AWAITING APPROVAL** — Presented to the user for review. No code written yet.
3. **APPROVED** — User has explicitly approved. Implementation can begin.
4. **IN PROGRESS** — `implementation-executor` agent is building it.
5. **COMPLETE** — All acceptance criteria met, `tsc --noEmit` passes.

### Sub-Plan Must Include
- Status header (AWAITING APPROVAL / APPROVED / IN PROGRESS / COMPLETE)
- Problem statement (why this work is needed)
- Acceptance criteria (checkboxes — every one must pass before marking COMPLETE)
- Files to change table (CREATE vs MODIFY, with purpose)
- Implementation detail (code snippets for non-trivial logic)
- Test plan
- Out of scope section (explicit boundaries)
- Skill references (which `.claude/skills/` files the executor must read)
- Agent assignment

### What Triggers a New Sub-Plan
- Any new NestJS module or service
- Any new connector or mapper
- Any database schema change
- Any change to worker processor logic (Redlock, job status, orchestrator)
- Any new Next.js page or significant component
- Any infrastructure change (docker-compose, CI, env vars)

### What Does NOT Need a Sub-Plan
- Bug fixes under 20 lines
- Adding a single test to an existing spec file
- Documentation updates
- Renaming a variable or fixing a lint error

---

## Implementation Rules (apply to all code changes)

### NestJS (API + Workers)
- Every resolver class gets `@UseGuards(GqlAuthGuard)` — no exceptions except login/register
- `tenantId` always from `@CurrentTenant()` — never from request body or args
- Services contain all business logic — resolvers only delegate
- Workers are responsible ONLY for: credential decryption, Redlock acquire/release, job status transitions, orchestrator delegation
- Orchestrators build pipeline context and run EtlEngine — workers do NOT wire connectors directly

### Pipeline
- `@cdo/core` must NEVER import from `@cdo/db`, `@cdo/queue`, or any NestJS module
- Redlock MUST be acquired before `orchestrator.execute()` and released in `finally`
- Lock key format: `lock:{tenantId}:{targetCredentialId}` — never deviate
- All target connectors MUST upsert — check-then-create-or-update, never blindly create
- Error classification is mandatory: `ValidationError | TransientError | FatalError`

### Logging
- Never use `console.log`, `console.warn`, or `console.error` — use `Logger` from `@nestjs/common`
- In pure packages without NestJS, accept a logger via constructor injection
- Every log must include context: at minimum `tenantId` and `jobId` where available

### Testing
- Unit tests live in `__tests__/` colocated with source
- Named `*.spec.ts`
- Mock connectors/repositories — never hit real APIs or databases in unit tests
- Every new service or utility must have at least one test file

### Security
- Credentials are AES-256-GCM encrypted at rest — never store plaintext
- Decryption only in worker memory — never in API layer
- `CREDENTIAL_KEY` must be exactly 64 hex chars (32 bytes) — validate on startup
- Never log decrypted credential values
