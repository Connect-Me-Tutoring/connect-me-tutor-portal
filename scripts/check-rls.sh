#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres and then checks what the
# row-level security policies actually leave behind.
#
# The first half matters as much as the second: a policy that fails to compile
# still leaves its DROP behind, so "did every migration apply without a single
# error" is itself the test. Run this before pushing anything that touches
# supabase/migrations.
#
#   bash scripts/check-rls.sh
#
# Nothing here touches the hosted project. Requires Docker.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="cm-rls-check-$$"
image="public.ecr.aws/supabase/postgres:17.6.1.143"

cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting $image"
docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres "$image" >/dev/null

# The image restarts Postgres once while it initialises, so a single successful
# connection is not enough to call it ready.
ready=""
for _ in $(seq 1 90); do
  if docker exec "$container" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
    sleep 10
    if docker exec "$container" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  sleep 2
done
[ -n "$ready" ] || { echo "Postgres never became ready" >&2; exit 1; }

echo "==> applying migrations"
failed=0
for path in "$root"/supabase/migrations/*.sql; do
  name="$(basename "$path")"
  # The baseline snapshot references storage.objects, which this bare image
  # does not ship. Those statements are expected to fail; nothing else is.
  unexpected="$(docker exec -i "$container" psql -v ON_ERROR_STOP=0 -q -U postgres -d postgres < "$path" 2>&1 \
    | grep '^ERROR' | grep -v 'storage\.objects' || true)"
  if [ -n "$unexpected" ]; then
    echo "    $name" >&2
    echo "$unexpected" | sort | uniq -c | sed 's/^/        /' >&2
    failed=1
  else
    echo "    $name"
  fi
done
[ "$failed" -eq 0 ] || { echo "Migrations did not apply cleanly; see above." >&2; exit 1; }

echo "==> checking what the policies leave behind"
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres \
  < "$root/supabase/tests/rls_sanity.sql"

echo "==> row-level security looks sound"
