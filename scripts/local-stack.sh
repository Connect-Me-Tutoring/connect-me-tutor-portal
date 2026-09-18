#!/usr/bin/env bash
# Boot a local Supabase, apply this branch's migrations, and seed demo data.
#
# `supabase start` from the repo root would try to build a database from
# supabase/migrations and fail, because the history has no baseline: the
# earliest files assume tables that predate them. So the stack starts from a
# shadow workdir with the repo's config and an empty migrations directory, and
# the migrations are applied afterwards by hand, in filename order.
#
#   bash scripts/local-stack.sh          # boot, migrate, seed
#   bash scripts/local-stack.sh --reset  # wipe and start over
#
# Local only. Nothing here reaches the hosted project.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$root/.supabase-local"
db="supabase_db_connect-me-app"

if [ "${1:-}" = "--reset" ]; then
  echo "==> stopping and wiping"
  supabase --workdir "$workdir" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$workdir"
fi

mkdir -p "$workdir/supabase/migrations"

# Another Supabase project may already hold the default 543xx ports, so this
# stack runs on 544xx. Only the shadow copy of the config is rewritten; the
# repo's own config.toml is left alone.
# (perl, not sed: BSD sed on macOS has no \b)
perl -pe 's/\b543(\d\d)\b/544$1/g' "$root/supabase/config.toml" > "$workdir/supabase/config.toml"

echo "==> starting the local stack (first run pulls images, give it a few minutes)"
supabase --workdir "$workdir" start

already="$(docker exec "$db" psql -U postgres -d postgres -tAc \
  "select 1 from pg_tables where schemaname='public' and tablename='Profiles'" 2>/dev/null || true)"

if [ "$already" = "1" ]; then
  echo "==> schema already present, leaving it alone (use --reset to rebuild)"
else
  echo "==> applying migrations"
  for path in "$root"/supabase/migrations/*.sql; do
    name="$(basename "$path")"
    unexpected="$(docker exec -i "$db" psql -v ON_ERROR_STOP=0 -q -U postgres -d postgres < "$path" 2>&1 \
      | grep '^ERROR' || true)"
    if [ -n "$unexpected" ]; then
      echo "    $name" >&2
      echo "$unexpected" | sort | uniq -c | sed 's/^/        /' >&2
      echo "Migration $name did not apply cleanly." >&2
      exit 1
    fi
    echo "    $name"
  done

  echo "==> seeding demo data"
  docker exec -i "$db" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres \
    < "$root/supabase/seed/local_demo.sql"
fi

echo
supabase --workdir "$workdir" status
