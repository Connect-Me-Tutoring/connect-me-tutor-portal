#!/usr/bin/env bash
set -euo pipefail

# SUPABASE_PROJECT_REF is already an explicit env var in CI (see .github/workflows/ci.yml).
# For local dev, derive it from NEXT_PUBLIC_SUPABASE_URL in .env.local so there's nothing
# extra to configure.
if [ -z "${SUPABASE_PROJECT_REF:-}" ] && [ -f .env.local ]; then
  ref=$(grep -oE 'https://[a-z0-9]+\.supabase\.co' .env.local | head -1 | sed -E 's#https://([a-z0-9]+)\.supabase\.co#\1#')
  if [ -n "$ref" ]; then
    export SUPABASE_PROJECT_REF="$ref"
  fi
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "SUPABASE_PROJECT_REF is not set and could not be derived from .env.local's NEXT_PUBLIC_SUPABASE_URL" >&2
  exit 1
fi

tmp_file=$(mktemp)
trap 'rm -f "$tmp_file"' EXIT

supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > "$tmp_file"

if [ ! -s "$tmp_file" ]; then
  echo "supabase gen types produced empty output; leaving types/database.types.ts untouched" >&2
  exit 1
fi

mv "$tmp_file" types/database.types.ts
