#!/bin/bash
# pre-tool-use.sh — CDO safety guardrails
# Runs before every shell command execution
# Exit 2 to BLOCK | Exit 0 to ALLOW

TOOL_NAME="$1"
TOOL_INPUT="$2"

# ─── DANGEROUS GIT OPERATIONS ────────────────────────────────────────────────

if echo "$TOOL_INPUT" | grep -qE "git push.*--force|git push.*-f\b"; then
  echo "BLOCKED: Force push is not allowed."
  exit 2
fi

if echo "$TOOL_INPUT" | grep -qE "git reset --hard"; then
  echo "BLOCKED: git reset --hard can destroy uncommitted work. Use git stash first."
  exit 2
fi

if echo "$TOOL_INPUT" | grep -qE "git branch -[dD]\b|git branch --delete"; then
  echo "BLOCKED: Branch deletion requires explicit confirmation."
  exit 2
fi

if echo "$TOOL_INPUT" | grep -qE "git commit.*--no-verify|git push.*--no-verify"; then
  echo "BLOCKED: Bypassing git hooks is not allowed."
  exit 2
fi

# ─── DANGEROUS FILE OPERATIONS ───────────────────────────────────────────────

if echo "$TOOL_INPUT" | grep -qE "rm -rf|rm -r /"; then
  echo "BLOCKED: Recursive delete (rm -rf) is not allowed."
  exit 2
fi

# ─── SECRETS PROTECTION ──────────────────────────────────────────────────────

if echo "$TOOL_INPUT" | grep -qE "cat \.env$|cat \.env\.|head \.env|tail \.env"; then
  echo "BLOCKED: Reading .env files is not allowed. Use .env.example for reference."
  exit 2
fi

# ─── PACKAGE PROTECTION ──────────────────────────────────────────────────────

if echo "$TOOL_INPUT" | grep -qE "npx create-|npm init"; then
  echo "BLOCKED: Creating new projects inside the monorepo is not allowed."
  exit 2
fi

# ─── ALLOW ALL OTHER COMMANDS ────────────────────────────────────────────────
exit 0
