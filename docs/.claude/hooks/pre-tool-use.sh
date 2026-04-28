#!/bin/bash
# pre-tool-use.sh — Metafy AI Platform safety guardrails
# Runs before every Claude tool execution that involves shell commands
# Exit 2 to BLOCK the action | Exit 0 to ALLOW

TOOL_NAME="$1"
TOOL_INPUT="$2"

# ─── DANGEROUS GIT OPERATIONS ────────────────────────────────────────────────

# Block force push (always destructive on shared branches)
if echo "$TOOL_INPUT" | grep -qE "git push.*--force|git push.*-f\b"; then
  echo "BLOCKED: Force push is not allowed. Discuss with the team before force-pushing."
  exit 2
fi

# Block hard reset (discards uncommitted work)
if echo "$TOOL_INPUT" | grep -qE "git reset --hard"; then
  echo "BLOCKED: git reset --hard can destroy uncommitted work. Use git stash first, or confirm this is intentional."
  exit 2
fi

# Block deleting branches without confirmation
if echo "$TOOL_INPUT" | grep -qE "git branch -[dD]\b|git branch --delete"; then
  echo "BLOCKED: Branch deletion requires explicit user confirmation. Ask before deleting."
  exit 2
fi

# ─── DANGEROUS FILE OPERATIONS ───────────────────────────────────────────────

# Block recursive delete
if echo "$TOOL_INPUT" | grep -qE "rm -rf|rm -r /"; then
  echo "BLOCKED: Recursive delete (rm -rf) is not allowed. Delete files individually or ask user to confirm."
  exit 2
fi

# ─── SECRETS PROTECTION ──────────────────────────────────────────────────────

# Block reading .env files (may contain real secrets)
if echo "$TOOL_INPUT" | grep -qE "cat .env$|cat .env\.|head .env|tail .env"; then
  echo "BLOCKED: Reading .env files is not allowed. Use .env.example for reference, or ask the user."
  exit 2
fi

# ─── PRODUCTION DATABASE PROTECTION ─────────────────────────────────────────

# Block running migrations on production
if echo "$TOOL_INPUT" | grep -qE "migration.*--env=prod|migration.*NODE_ENV=production"; then
  echo "BLOCKED: Cannot run database migrations against production. Run on staging first."
  exit 2
fi

# ─── SKIP-HOOK BYPASS PREVENTION ─────────────────────────────────────────────

# Block bypassing git hooks
if echo "$TOOL_INPUT" | grep -qE "git commit.*--no-verify|git push.*--no-verify"; then
  echo "BLOCKED: Bypassing git hooks (--no-verify) is not allowed. Fix the underlying hook failure instead."
  exit 2
fi

# ─── ALLOW ALL OTHER COMMANDS ────────────────────────────────────────────────
exit 0
