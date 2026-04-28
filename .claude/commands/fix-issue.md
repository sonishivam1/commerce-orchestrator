---
description: Investigate and fix a GitHub issue by tracing it through the pipeline
argument-hint: [issue-number]
---

## Issue Details
!`gh issue view $ARGUMENTS`

## Recent Related Commits
!`gh issue view $ARGUMENTS --json title -q .title`

## Investigation Steps
1. Read the issue description and identify which layer is affected (API, Worker, Core Engine, Mapping, Connector, Frontend).
2. Trace the data flow through the pipeline to find the root cause.
3. Check if the issue is related to:
   - Missing `tenantId` scoping
   - Connector idempotency failures
   - Circuit breaker false positives
   - Zod validation rejecting valid data
   - Missing error classification (TransientError vs FatalError)
4. Fix the root cause in the correct layer.
5. Write a test in the appropriate `__tests__/` directory that would have caught this bug.
6. Run `npx tsc --noEmit` and `pnpm run test` to verify the fix.
