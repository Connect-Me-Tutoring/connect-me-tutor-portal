#!/usr/bin/env bash
# Shared by gen-types.sh (prod) and gen-types-dev.sh (dev). Source it, then call
# write_types with the arguments that select the Supabase project.

target="types/database.types.ts"
tmp_file="${target}.new"

# The dev and prod projects run different PostgREST versions, and the CLI writes
# the version of whichever project it reads into __InternalSupabase. Pin it to
# prod's so both CI checks agree and supabase-js types queries for prod. Bump
# this when prod's PostgREST is upgraded.
pinned_postgrest_version="12.2.3"

write_types() {
  trap 'rm -f "$tmp_file"' EXIT

  supabase gen types typescript "$@" --schema public > "$tmp_file"

  if [ ! -s "$tmp_file" ]; then
    echo "supabase gen types produced empty output; leaving $target untouched" >&2
    exit 1
  fi

  mv "$tmp_file" "$target"

  # Raw CLI output isn't Prettier-formatted, but the committed file is (format:check
  # enforces this repo-wide) - format the real path in place so the CI drift-check
  # diffs like-for-like instead of flagging cosmetic differences as schema drift.
  npx prettier --write "$target" >/dev/null

  # Runs after Prettier so the quoting is always the formatted double quotes.
  if ! grep -q 'PostgrestVersion: "' "$target"; then
    echo "PostgrestVersion not found in $target; update the pin in scripts/gen-types-lib.sh" >&2
    exit 1
  fi
  sed -i.bak -E "s/(PostgrestVersion: \")[^\"]*(\")/\1${pinned_postgrest_version}\2/" "$target"
  rm -f "${target}.bak"
}
