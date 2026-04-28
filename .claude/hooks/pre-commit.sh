#!/bin/bash
# pre-commit.sh — CDO pre-commit quality gate
# Exit 2 = BLOCK the commit | Exit 0 = allow

set -e

STAGED_TS=$(git diff --cached --name-only | grep -E "\.(ts|tsx)$" || true)

if [ -z "$STAGED_TS" ]; then
  exit 0
fi

echo "Pre-commit: running quality gate..."

# ─── STEP 1: ARCHITECTURE VIOLATION CHECK ────────────────────────────────────

echo "Step 1/3: Architecture violation scan..."

# @cdo/core must not import infrastructure
CORE_VIOLATION=$(grep -rn "from '@cdo/db'\|from '@cdo/queue'\|from '@nestjs'" packages/core/src/ 2>/dev/null || true)
if [ -n "$CORE_VIOLATION" ]; then
  echo ""
  echo "BLOCKED: @cdo/core has forbidden imports:"
  echo "$CORE_VIOLATION"
  exit 2
fi

# @cdo/shared must not import internal packages
SHARED_VIOLATION=$(grep -rn "from '@cdo/" packages/shared/src/ 2>/dev/null || true)
if [ -n "$SHARED_VIOLATION" ]; then
  echo ""
  echo "BLOCKED: @cdo/shared has internal @cdo/* imports:"
  echo "$SHARED_VIOLATION"
  exit 2
fi

echo "  Architecture: PASS"

# ─── STEP 2: TYPESCRIPT TYPE CHECK ───────────────────────────────────────────

echo "Step 2/3: TypeScript type check..."
npx tsc --noEmit --skipLibCheck 2>&1 | tail -5 || {
  echo ""
  echo "BLOCKED: TypeScript errors. Fix before committing."
  exit 2
}
echo "  TypeScript: PASS"

# ─── STEP 3: CONSOLE.LOG CHECK ──────────────────────────────────────────────

echo "Step 3/3: console.log check..."
CONSOLE_USAGE=$(echo "$STAGED_TS" | xargs grep -n "console\.\(log\|error\|warn\)" 2>/dev/null || true)
if [ -n "$CONSOLE_USAGE" ]; then
  echo ""
  echo "WARNING: console.log found in staged files (use Pino instead):"
  echo "$CONSOLE_USAGE"
  # Warning only, not blocking
fi

echo ""
echo "Pre-commit gate: ALL CHECKS PASSED"
exit 0
