#!/usr/bin/env bash
# Runs supabase/tests/access_controls.sql against a throwaway Postgres built
# from the migrations as they will exist once this branch merges.
#
# It does not apply supabase/migrations from the working tree. That directory
# still holds the pre-squash history this branch was cut from, which cannot
# build a database on its own: its earliest files assume tables that predate
# them. Merging into the target branch drops those files, so the harness
# resolves the merge in memory and uses the resulting migration set, which is
# what will actually run against the hosted database.
#
# Nothing here touches the hosted project: the container is created, used and
# destroyed. Requires Docker and a fetched origin.
#
#   bash scripts/db-access-tests.sh [target-branch]     # default origin/dev
#
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-origin/dev}"
container="cm-access-tests-$$"
image="public.ecr.aws/supabase/postgres:17.6.1.143"

cd "$root"

echo "==> resolving migrations as of a merge with $target"
tree="$(git merge-tree --write-tree "$target" HEAD)" || {
  echo "Merging $target into HEAD conflicts; resolve it before running these tests." >&2
  exit 1
}
# macOS ships bash 3.2, which has no mapfile.
migrations="$(git ls-tree --name-only "$tree" supabase/migrations/ | sort)"
[ -n "$migrations" ] || { echo "No migrations found in the merged tree" >&2; exit 1; }

cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -f "$root/.migration-failed"; }
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

echo "==> applying $(echo "$migrations" | wc -l | tr -d " ") migrations"
echo "$migrations" | while read -r path; do
  name="$(basename "$path")"
  # The baseline snapshot references storage.objects, which this bare image
  # does not ship. Those statements are expected to fail; anything else is not.
  unexpected="$(git show "$tree:$path" \
    | docker exec -i "$container" psql -v ON_ERROR_STOP=0 -q -U postgres -d postgres 2>&1 \
    | grep '^ERROR' | grep -v 'storage\.objects' || true)"
  if [ -n "$unexpected" ]; then
    echo "    $name" >&2
    echo "$unexpected" | sed 's/^/        /' >&2
    echo "Migration $name did not apply cleanly." >&2
    touch "$root/.migration-failed"
    exit 1
  fi
  echo "    $name"
done
if [ -f "$root/.migration-failed" ]; then rm -f "$root/.migration-failed"; exit 1; fi

echo "==> running access-control tests"
docker exec -i "$container" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres \
  < "$root/supabase/tests/access_controls.sql"

echo "==> all access-control expectations held"
