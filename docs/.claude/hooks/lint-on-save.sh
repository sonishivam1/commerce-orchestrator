#!/bin/bash
# lint-on-save.sh — Auto-format files after Claude edits them
# Runs after every Edit or Write tool call.
# Keeps code consistently formatted without manual Prettier runs.

EDITED_FILE="$1"

if [ -z "$EDITED_FILE" ]; then
  exit 0
fi

# Only process files that exist
if [ ! -f "$EDITED_FILE" ]; then
  exit 0
fi

EXTENSION="${EDITED_FILE##*.}"

# ─── TYPESCRIPT / TSX ────────────────────────────────────────────────────────
if [[ "$EXTENSION" == "ts" || "$EXTENSION" == "tsx" ]]; then
  # Run Prettier
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" \
      --parser typescript \
      --single-quote \
      --trailing-comma es5 \
      --print-width 100 \
      --log-level silent 2>/dev/null || true
  fi
fi

# ─── JAVASCRIPT ──────────────────────────────────────────────────────────────
if [[ "$EXTENSION" == "js" || "$EXTENSION" == "jsx" || "$EXTENSION" == "mjs" ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" --log-level silent 2>/dev/null || true
  fi
fi

# ─── JSON ─────────────────────────────────────────────────────────────────────
if [[ "$EXTENSION" == "json" ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" --parser json --log-level silent 2>/dev/null || true
  fi
fi

# ─── MARKDOWN ────────────────────────────────────────────────────────────────
if [[ "$EXTENSION" == "md" ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" --parser markdown --prose-wrap always \
      --log-level silent 2>/dev/null || true
  fi
fi

exit 0
