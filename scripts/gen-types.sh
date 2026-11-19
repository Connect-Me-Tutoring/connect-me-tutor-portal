#!/usr/bin/env bash
set -euo pipefail

# Generates types from the prod Supabase project.
#
# Local dev: after a one-time `supabase link`, the CLI remembers the project
# in the gitignored supabase/.temp/ dir, so --linked needs no further config.
# CI (and anyone who hasn't linked yet): falls back to the explicit project
# id via SUPABASE_PROJECT_ID (a repo secret, used for main in .github/workflows/ci.yml).
source "$(dirname "${BASH_SOURCE[0]}")/gen-types-lib.sh"

if [ -f supabase/.temp/project-ref ]; then
  write_types --linked
elif [ -n "${SUPABASE_PROJECT_ID:-}" ]; then
  write_types --project-id "$SUPABASE_PROJECT_ID"
else
  echo "Not linked (run 'supabase link') and SUPABASE_PROJECT_ID is not set." >&2
  exit 1
fi
