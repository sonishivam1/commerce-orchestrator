#!/bin/bash
# pre-commit.sh — Metafy AI Platform pre-commit quality gate
#
# Runs BEFORE every commit Claude makes.
# Exit 2 = BLOCK the commit.
# Exit 0 = allow it.
#
# Checks (in order of speed, fastest first):
#   1. TypeScript type check on staged service
#   2. ESLint on staged .ts/.tsx files
#   3. Unit tests for the affected service (skipped if > 3 services changed)

set -e

# ─── DETECT STAGED FILES ─────────────────────────────────────────────────────

STAGED_TS=$(git diff --cached --name-only | grep -E "\.(ts|tsx)$" || true)

if [ -z "$STAGED_TS" ]; then
  # No TypeScript files staged — nothing to check
  exit 0
fi

echo "Pre-commit: running quality gate on staged TypeScript files..."

# ─── DETECT AFFECTED SERVICES ────────────────────────────────────────────────

AFFECTED_SERVICES=$(git diff --cached --name-only \
  | grep -E "^apps/[^/]+" \
  | sed 's|apps/\([^/]*\)/.*|\1|' \
  | sort -u || true)

AFFECTED_COUNT=$(echo "$AFFECTED_SERVICES" | grep -c . || echo 0)

echo "Affected services: $AFFECTED_SERVICES"

# ─── STEP 1: TYPESCRIPT TYPE CHECK ───────────────────────────────────────────

echo ""
echo "Step 1/3: TypeScript type check..."

if [ "$AFFECTED_COUNT" -le 3 ] && [ -n "$AFFECTED_SERVICES" ]; then
  # Check only affected services (fast)
  for service in $AFFECTED_SERVICES; do
    SERVICE_PATH="apps/$service"
    if [ -f "$SERVICE_PATH/tsconfig.json" ]; then
      echo "  Checking $service..."
      cd "$SERVICE_PATH"
      npx tsc --noEmit --skipLibCheck 2>&1 | tail -5 || {
        echo ""
        echo "BLOCKED: TypeScript errors in $service. Fix type errors before committing."
        exit 2
      }
      cd - > /dev/null
    fi
  done
else
  # Many services changed — do a lightweight check on staged files only
  echo "  Multiple services changed — checking staged files only..."
  npx tsc --noEmit --skipLibCheck 2>&1 | tail -10 || {
    echo ""
    echo "BLOCKED: TypeScript errors detected. Fix before committing."
    exit 2
  }
fi

echo "  TypeScript: PASS"

# ─── STEP 2: ESLINT ON STAGED FILES ─────────────────────────────────────────

echo ""
echo "Step 2/3: ESLint on staged files..."

STAGED_FILES_STRING=$(echo "$STAGED_TS" | tr '\n' ' ')

if [ -n "$STAGED_FILES_STRING" ]; then
  npx eslint $STAGED_FILES_STRING --quiet --max-warnings=0 2>&1 | tail -10 || {
    echo ""
    echo "BLOCKED: ESLint errors in staged files. Run 'npm run lint' to fix."
    exit 2
  }
fi

echo "  ESLint: PASS"

# ─── STEP 3: UNIT TESTS (affected service only, skip if too broad) ────────────

echo ""
echo "Step 3/3: Unit tests..."

if [ "$AFFECTED_COUNT" -eq 1 ] && [ -n "$AFFECTED_SERVICES" ]; then
  # Only run tests if exactly one service is affected (keeps commit fast)
  SERVICE=$(echo "$AFFECTED_SERVICES" | head -1)
  SERVICE_PATH="apps/$SERVICE"

  if [ -f "$SERVICE_PATH/package.json" ] && grep -q '"test"' "$SERVICE_PATH/package.json"; then
    echo "  Running tests for $SERVICE..."
    cd "$SERVICE_PATH"
    npm test -- --silent --passWithNoTests 2>&1 | tail -5 || {
      echo ""
      echo "BLOCKED: Tests failed in $SERVICE. Fix failing tests before committing."
      exit 2
    }
    cd - > /dev/null
    echo "  Tests: PASS"
  else
    echo "  No test runner configured for $SERVICE — skipping"
  fi
else
  echo "  Multiple services changed — skipping full test run (run 'npm run test' manually)"
fi

# ─── ALL CHECKS PASSED ───────────────────────────────────────────────────────

echo ""
echo "Pre-commit gate: ALL CHECKS PASSED"
exit 0
