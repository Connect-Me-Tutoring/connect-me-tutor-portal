#!/usr/bin/env node
/**
 * Load JSON input for lookup_proposed_matches_static and print results.
 *
 *   export DATABASE_URL=...
 *   node scripts/lookup-proposed-matches-perf/run-static-from-json.mjs [path/to/input.json]
 *
 * Flags:
 *   --table     Pretty table (default is JSON object with requestor_role + results[])
 *   --schema    Print paths to JSON Schema + sample files and exit
 *   --help      Usage
 *
 * Default input: scripts/lookup-proposed-matches-perf/samples/lookup-static-input.sample.json
 *
 * Requires: psql on PATH, migrations through 20260408130000_subject_alignment_json_output.sql
 */

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage(exitCode = 0) {
  console.error(`
Usage: node run-static-from-json.mjs [--table] [--schema] [--help] [input.json]

  --table   Pretty table instead of JSON envelope
  --schema  Print paths to JSON Schema + sample files
  --help    This message

Input JSON must include requestor_role: "student" | "tutor" (same idea as lookup_proposed_matches request_type).
Optional per-candidate "role": "student" | "tutor" — when requestor_role is set, only opposite-role candidates are scored; candidates without role are still included.

Environment: DATABASE_URL (required for runs other than --schema / --help)
`);
  process.exit(exitCode);
}

const args = process.argv.slice(2).filter((a) => a !== "");
let table = false;
let inputPath = null;
for (const a of args) {
  if (a === "--help" || a === "-h") usage(0);
  if (a === "--schema") {
    const base = join(__dirname);
    console.log(
      JSON.stringify(
        {
          inputJsonSchema: join(base, "schemas/lookup-static-input.schema.json"),
          outputEnvelopeSchema: join(base, "schemas/lookup-static-output-envelope.schema.json"),
          rowSchema: join(base, "schemas/lookup-static-output.schema.json"),
          inputSampleStudent: join(base, "samples/lookup-static-input.sample.json"),
          inputSampleTutor: join(base, "samples/lookup-static-input.tutor-requestor.sample.json"),
          outputSample: join(base, "samples/lookup-static-output.sample.json"),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  if (a === "--table") {
    table = true;
    continue;
  }
  if (a.startsWith("-")) {
    console.error("Unknown flag:", a);
    usage(1);
  }
  inputPath = a;
}

if (!inputPath) {
  inputPath = join(__dirname, "samples/lookup-static-input.sample.json");
}

const raw = readFileSync(inputPath, "utf8");
/** @type {{
 *   requestor_subjects: string[],
 *   candidates: object[],
 *   requestor_role: string,
 *   exclude_ids?: string[],
 *   limit?: number
 * }} */
const input = JSON.parse(raw);

if (!Array.isArray(input.requestor_subjects) || !Array.isArray(input.candidates)) {
  console.error("Invalid JSON: need requestor_subjects and candidates arrays.");
  process.exit(1);
}

const requestorRole = input.requestor_role;
if (requestorRole !== "student" && requestorRole !== "tutor") {
  console.error('Invalid JSON: requestor_role must be "student" or "tutor".');
  process.exit(1);
}

const rsJson = JSON.stringify(input.requestor_subjects);
const candJson = JSON.stringify(input.candidates);
const exJson = JSON.stringify(input.exclude_ids ?? []);
const lim = Number.isFinite(Number(input.limit)) && Number(input.limit) > 0 ? Number(input.limit) : 5;

function dollarQuote(body) {
  const tag = `lpm${Math.random().toString(36).slice(2, 12)}`;
  return `$${tag}$${body.replaceAll(`$${tag}$`, `${tag}_dup`)}$${tag}$`;
}

const excludeSql =
  input.exclude_ids && input.exclude_ids.length > 0
    ? `ARRAY(SELECT jsonb_array_elements_text(${dollarQuote(exJson)}::jsonb))`
    : `NULL::text[]`;

const rrSql = `${dollarQuote(requestorRole)}::text`;

const inner = `
SELECT * FROM public.lookup_proposed_matches_static(
  ARRAY(SELECT jsonb_array_elements_text(${dollarQuote(rsJson)}::jsonb)),
  ${dollarQuote(candJson)}::jsonb,
  ${excludeSql},
  ${lim},
  ${rrSql}
)`;

const sqlTable = `${inner};
`;

const sqlJson = `
SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.rank_score DESC), '[]'::json)::text
FROM (${inner}) AS t;
`;

const repoRoot = join(__dirname, "..", "..");

function composePostgresUp() {
  const r = spawnSync(
    "docker",
    ["compose", "-f", join(repoRoot, "docker-compose.yml"), "ps", "postgres"],
    { encoding: "utf8" },
  );
  return r.status === 0 && /Up/.test(r.stdout || "");
}

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && composePostgresUp()) {
  const port = process.env.POSTGRES_PORT || "5432";
  const db = process.env.POSTGRES_DB || "connect_me";
  databaseUrl = `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres"}@127.0.0.1:${port}/${db}`;
  console.error(`DATABASE_URL not set; using docker compose Postgres: ${databaseUrl}`);
}

if (!databaseUrl && !composePostgresUp()) {
  console.error(
    "Set DATABASE_URL or start: docker compose up -d postgres (requires psql on PATH, or Docker for fallback).",
  );
  process.exit(1);
}

/**
 * @param {string} sqlPath
 * @param {string[]} tailArgs psql args after -f file (e.g. -t -A)
 */
function runPsqlFile(sqlPath, tailArgs) {
  const args = [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath, ...tailArgs];
  let r = spawnSync("psql", args, { encoding: "utf8" });
  if (r.error?.code === "ENOENT" && composePostgresUp()) {
    r = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        join(repoRoot, "docker-compose.yml"),
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        process.env.POSTGRES_USER || "postgres",
        "-d",
        process.env.POSTGRES_DB || "connect_me",
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
        ...tailArgs,
      ],
      { encoding: "utf8", input: readFileSync(sqlPath, "utf8") },
    );
  }
  return r;
}

const dir = mkdtempSync(join(tmpdir(), "lpm-json-"));
const sqlPath = join(dir, "run.sql");
try {
  writeFileSync(sqlPath, table ? sqlTable : sqlJson, "utf8");
  const tailArgs = table ? [] : ["-t", "-A"];
  const r = runPsqlFile(sqlPath, tailArgs);
  if (r.error?.code === "ENOENT" && !composePostgresUp()) {
    console.error(
      "psql not found. Install PostgreSQL client tools, or run: docker compose up -d postgres",
    );
    process.exit(1);
  }
  if (r.error && r.error.code !== "ENOENT") {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  const out = (r.stdout || "").trim();
  if (!table) {
    try {
      const results = JSON.parse(out);
      console.log(
        JSON.stringify(
          {
            requestor_role: requestorRole,
            results,
          },
          null,
          2,
        ),
      );
    } catch {
      console.log(out);
    }
  } else {
    console.log(`requestor_role: ${requestorRole}`);
    console.log(out);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
