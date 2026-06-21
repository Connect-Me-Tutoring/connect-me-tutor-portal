#!/usr/bin/env node
/**
 * Dump user-defined Postgres functions to one SQL file each under rpc/.
 *
 * Uses DATABASE_URL (direct Postgres). Excludes extension-owned objects,
 * system schemas, and functions whose args/return use pgvector types
 * (vector, halfvec, sparsevec).
 *
 *   export DATABASE_URL=postgresql://...
 *   node scripts/dump-rpc-definitions.mjs [--out rpc] [--clean] [--help]
 *
 * Loads .env.local then .env if present (same idea as test-webhook.js).
 */

import { readFileSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

function loadEnvFile() {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = join(repoRoot, envFile);
    try {
      const content = readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=#\s][^=]*?)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = value;
          }
        }
      });
      break;
    } catch {
      // continue
    }
  }
}

loadEnvFile();

function composePostgresUp() {
  const r = spawnSync(
    "docker",
    ["compose", "-f", join(repoRoot, "docker-compose.yml"), "ps", "postgres"],
    { encoding: "utf8" },
  );
  return r.status === 0 && /Up/.test(r.stdout || "");
}

function resolveDatabaseUrl() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && composePostgresUp()) {
    const port = process.env.POSTGRES_PORT || "5432";
    const db = process.env.POSTGRES_DB || "connect_me";
    databaseUrl = `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres"}@127.0.0.1:${port}/${db}`;
    console.error(`DATABASE_URL not set; using docker compose Postgres: ${databaseUrl}`);
  }
  return databaseUrl;
}

function usage(exitCode = 0) {
  console.error(`
Usage: node scripts/dump-rpc-definitions.mjs [options]

Options:
  --out DIR   Output directory (default: rpc)
  --clean     Remove *.sql in output directory before writing
  --help, -h  Show this message

Environment:
  DATABASE_URL   PostgreSQL connection string (required unless docker compose postgres is up)
`);
  process.exit(exitCode);
}

function slugifyIdentityArgs(identityArgs) {
  const s = String(identityArgs ?? "").trim();
  if (!s) return "no_args";
  return s
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 180) || "args";
}

function safeFilePart(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}

const LIST_SQL = `
SELECT
  p.oid::bigint AS oid,
  n.nspname AS schema_name,
  p.proname AS func_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prokind IN ('f', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname !~ '^pg_temp_'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_depend d
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.deptype = 'e'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM (
      SELECT unnest(COALESCE(p.proallargtypes, p.proargtypes::oid[])) AS t_oid
      UNION ALL
      SELECT NULLIF(p.prorettype, 0)
    ) x
    JOIN pg_type t ON t.oid = x.t_oid
    WHERE x.t_oid IS NOT NULL
      AND t.typname IN ('vector', 'halfvec', 'sparsevec')
  )
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.oid;
`;

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  let outDir = join(repoRoot, "rpc");
  let clean = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") usage(0);
    if (a === "--clean") {
      clean = true;
      continue;
    }
    if (a.startsWith("--out=")) {
      outDir = join(repoRoot, a.slice("--out=".length));
      continue;
    }
    if (a === "--out") {
      const next = args[++i];
      if (!next) {
        console.error("Missing value for --out");
        usage(1);
      }
      outDir = join(repoRoot, next);
      continue;
    }
    console.error("Unknown argument:", a);
    usage(1);
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      "Set DATABASE_URL or start: docker compose up -d postgres",
    );
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });

  if (clean) {
    for (const name of readdirSync(outDir)) {
      if (name.endsWith(".sql")) {
        unlinkSync(join(outDir, name));
      }
    }
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query(LIST_SQL);
    const usedFilenames = new Set();

    for (const row of rows) {
      const schema = row.schema_name;
      const fname = row.func_name;
      const idArgs = row.identity_args ?? "";
      const base = `${safeFilePart(schema)}__${safeFilePart(fname)}__${slugifyIdentityArgs(idArgs)}`;
      let filename = `${base}.sql`;
      if (usedFilenames.has(filename)) {
        filename = `${base}__oid_${row.oid}.sql`;
      }
      let guard = 0;
      while (usedFilenames.has(filename) && guard < 10) {
        filename = `${base}__oid_${row.oid}_${guard}.sql`;
        guard += 1;
      }
      usedFilenames.add(filename);

      const body = String(row.definition).trimEnd() + "\n";
      const outPath = join(outDir, filename);
      writeFileSync(outPath, body, "utf8");
      console.error(`Wrote ${filename} (${schema}.${fname})`);
    }

    console.log(`Dumped ${rows.length} function(s) to ${outDir}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
