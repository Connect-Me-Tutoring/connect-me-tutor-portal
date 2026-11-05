#!/usr/bin/env bash
set -euo pipefail

# Generates types from the dev Supabase project, via SUPABASE_DEV_PROJECT_ID (a repo
# secret, used for dev in .github/workflows/ci.yml). Deliberately ignores `supabase link`:
# a local checkout is usually linked to prod, which would silently check the wrong database.
source "$(dirname "${BASH_SOURCE[0]}")/gen-types-lib.sh"

# Local dev keeps it in .env.local. Read only this key: the file's `KEY = value` lines
# aren't valid shell, so it can't be sourced.
if [ -z "${SUPABASE_DEV_PROJECT_ID:-}" ] && [ -f .env.local ]; then
  SUPABASE_DEV_PROJECT_ID="$(sed -nE "s/^[[:space:]]*SUPABASE_DEV_PROJECT_ID[[:space:]]*=[[:space:]]*[\"']?([^\"'[:space:]]*).*/\1/p" .env.local | tail -n 1)"
fi

if [ -z "${SUPABASE_DEV_PROJECT_ID:-}" ]; then
  echo "SUPABASE_DEV_PROJECT_ID is not set (in the environment or .env.local)." >&2
  exit 1
fi

write_types --project-id "$SUPABASE_DEV_PROJECT_ID"
