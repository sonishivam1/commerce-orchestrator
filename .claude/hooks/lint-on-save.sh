#!/bin/bash
# lint-on-save.sh — Auto-format files after edits
# Runs after every Edit or Write tool call

EDITED_FILE="$1"

if [ -z "$EDITED_FILE" ] || [ ! -f "$EDITED_FILE" ]; then
  exit 0
fi

EXTENSION="${EDITED_FILE##*.}"

# TypeScript / TSX
if [[ "$EXTENSION" == "ts" || "$EXTENSION" == "tsx" ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" \
      --parser typescript \
      --single-quote \
      --trailing-comma es5 \
      --print-width 100 \
      --log-level silent 2>/dev/null || true
  fi
fi

# JSON
if [[ "$EXTENSION" == "json" ]]; then
  if command -v npx &> /dev/null; then
    npx prettier --write "$EDITED_FILE" --parser json --log-level silent 2>/dev/null || true
  fi
fi

exit 0
