#!/usr/bin/env bash
set -euo pipefail

# Local dev: after a one-time `supabase link`, the CLI remembers the project
# in the gitignored supabase/.temp/ dir, so --linked needs no further config.
# CI (and anyone who hasn't linked yet): falls back to the explicit project
# ref via SUPABASE_PROJECT_REF (set as a repo secret in .github/workflows/ci.yml).
tmp_file=$(mktemp)
trap 'rm -f "$tmp_file"' EXIT

if [ -f supabase/.temp/project-ref ]; then
  supabase gen types typescript --linked --schema public > "$tmp_file"
elif [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > "$tmp_file"
else
  echo "Not linked (run 'supabase link') and SUPABASE_PROJECT_REF is not set." >&2
  exit 1
fi

if [ ! -s "$tmp_file" ]; then
  echo "supabase gen types produced empty output; leaving types/database.types.ts untouched" >&2
  exit 1
fi

mv "$tmp_file" types/database.types.ts
