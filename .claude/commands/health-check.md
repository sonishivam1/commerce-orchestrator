---
description: Verify the health of the entire monorepo — types, tests, and dependency rules
---

## TypeScript Check
!`npx tsc --noEmit 2>&1 | tail -20`

## Test Suite
!`pnpm run test 2>&1 | tail -30`

## Dependency Violation Scan
Check for architecture violations:

1. **`@cdo/core` must not import infrastructure:**
!`grep -rn "from '@cdo/db'" packages/core/ 2>/dev/null || echo "✅ No @cdo/db imports in core"`
!`grep -rn "from '@cdo/queue'" packages/core/ 2>/dev/null || echo "✅ No @cdo/queue imports in core"`
!`grep -rn "from '@nestjs'" packages/core/ 2>/dev/null || echo "✅ No NestJS imports in core"`

2. **`@cdo/shared` must have zero internal deps:**
!`grep -rn "from '@cdo/" packages/shared/src/ 2>/dev/null || echo "✅ No internal deps in shared"`

3. **No console.log in production code:**
!`grep -rn "console\.\(log\|error\|warn\)" packages/ apps/ --include="*.ts" --exclude-dir=__tests__ --exclude-dir=node_modules 2>/dev/null | head -10 || echo "✅ No console statements found"`

4. **No process.env in packages:**
!`grep -rn "process\.env" packages/ --include="*.ts" --exclude-dir=node_modules 2>/dev/null | head -10 || echo "✅ No process.env in packages"`

Summarize findings. Flag any violations as blockers.
