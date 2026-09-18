#!/usr/bin/env bash
# Run the dev server against the local Supabase from scripts/local-stack.sh.
#
# The keys are read from the running stack rather than written to a file, and
# they are exported before next starts. Next.js does not overwrite variables
# that are already in the environment, so these win over .env.local and the
# hosted credentials there are never used.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$root/.supabase-local"

if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_connect-me-app$'; then
  echo "The local stack is not running. Start it with: bash scripts/local-stack.sh" >&2
  exit 1
fi

eval "$(supabase --workdir "$workdir" status -o env \
  | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)=')"

export NEXT_PUBLIC_SUPABASE_URL="${API_URL//\"/}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY//\"/}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY//\"/}"
export DATABASE_URL="${DB_URL//\"/}"
# Admins not on this list are bounced to a one-time-code login, which needs
# a mail round trip. The demo admin is listed so sign-in is one step.
export NEXT_PUBLIC_ADMIN_EMAILS="admin@local.test"
export NEXT_PUBLIC_SITE_URL="http://localhost:3000"
export NEXT_PUBLIC_LOCAL_URL="http://localhost:3000"

echo "dev server -> $NEXT_PUBLIC_SUPABASE_URL"
cd "$root"
exec npm run dev
