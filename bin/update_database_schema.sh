#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID=$(grep -E '^SUPABASE_PROJECT_ID[[:space:]]*=' .env.local \
  | sed -E 's/^[^=]*=[[:space:]]*//' \
  | tr -d '"\r' \
  | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//')

if [ -z "${PROJECT_ID:-}" ]; then
  echo "Error: SUPABASE_PROJECT_ID not found in .env.local" >&2
  exit 1
fi

npx supabase gen types typescript --project-id "$PROJECT_ID" --schema public > database.types.ts
