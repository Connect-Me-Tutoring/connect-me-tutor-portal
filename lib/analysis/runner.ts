import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { findAnalysis, type AnalysisSpec } from "./catalog";

/**
 * Runs an analysis from the dataAnalysis repository.
 *
 * Two ways, chosen by configuration:
 *
 *   - Against a deployed analysis service, when ANALYSIS_SERVICE_URL and
 *     ANALYSIS_SERVICE_KEY are set. This is how it runs in production, because
 *     the analyses are Python and a Node serverless function cannot spawn a
 *     Python environment. Both values are ordinary environment variables, so on
 *     Vercel they are two project secrets and nothing else.
 *
 *   - By spawning the repository's CLI locally, when those are not set and the
 *     repository is checked out beside this one. Useful while developing.
 *
 * Either way it reads and returns; nothing is written back.
 *
 * For the local path, three things keep spawning from being dangerous:
 *
 *   - the analysis id must come from the allow list in catalog.ts, so no
 *     request can name a script;
 *   - arguments are passed as an argv array and never through a shell, so
 *     nothing in them is interpreted;
 *   - every run gets a fresh directory, a wall-clock timeout and a cap on how
 *     much output is kept.
 *
 * The data comes from Supabase through the repository's own fetcher, which is
 * read-only, and lands in that same per-run directory. Nothing is written back.
 */

export type AnalysisSection =
  | { kind: "text"; title: string; body: string }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] };

export type AnalysisResult =
  | {
      ok: true;
      id: string;
      title: string;
      ranAt: string;
      durationMs: number;
      rowsRead: Record<string, number>;
      sections: AnalysisSection[];
      limitations: string[];
    }
  | { ok: false; id: string; error: string };

const RUN_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_BYTES = 256 * 1024;
const MAX_TABLE_ROWS = 200;

function repoRoot(): string {
  return process.env.ANALYSIS_REPO_PATH ?? path.resolve(process.cwd(), "..", "dataAnalysis");
}

function pythonBin(): string {
  return process.env.ANALYSIS_PYTHON ?? path.join(repoRoot(), ".venv", "bin", "python");
}

/** Present so the page can explain itself instead of failing mysteriously. */
export function analysisBackendStatus(): { ready: boolean; reason?: string } {
  if (process.env.ANALYSIS_SERVICE_URL && process.env.ANALYSIS_SERVICE_KEY) {
    return { ready: true };
  }
  const root = repoRoot();
  if (!existsSync(root)) {
    return { ready: false, reason: `The analysis repository is not at ${root}.` };
  }
  if (!existsSync(pythonBin())) {
    return {
      ready: false,
      reason:
        "No analysis service is configured, and the local analysis repository has no virtual environment.",
    };
  }
  return { ready: true };
}

function run(
  bin: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    // No shell: argv goes to execve as-is, so quoting and metacharacters in an
    // argument cannot turn into another command.
    const child = spawn(bin, args, { cwd: options.cwd, env: options.env, shell: false });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, RUN_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: String(error), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

/** Minimal CSV reader. Handles quoted fields and embedded commas, nothing more. */
function parseCsv(text: string): { columns: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (nonEmpty.length === 0) return { columns: [], rows: [] };
  return { columns: nonEmpty[0], rows: nonEmpty.slice(1, 1 + MAX_TABLE_ROWS) };
}

async function collect(spec: AnalysisSpec, outputDir: string, stdout: string) {
  const sections: AnalysisSection[] = [];

  for (const output of spec.outputs) {
    if (output.kind === "stdout") {
      if (stdout.trim()) sections.push({ kind: "text", title: output.title, body: stdout.trim() });
      continue;
    }

    const file = path.join(outputDir, output.file);
    if (!existsSync(file)) continue;
    const body = await readFile(file, "utf8");

    if (output.kind === "text") {
      if (body.trim()) sections.push({ kind: "text", title: output.title, body: body.trim() });
    } else {
      const { columns, rows } = parseCsv(body);
      if (columns.length > 0 && rows.length > 0) {
        sections.push({ kind: "table", title: output.title, columns, rows });
      }
    }
  }

  return sections;
}

async function runRemote(spec: AnalysisSpec, url: string, key: string): Promise<AnalysisResult> {
  const started = Date.now();
  try {
    const response = await fetch(new URL("/run", url), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ id: spec.id }),
      signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[analysis] Service returned", response.status, "for", spec.id);
      return { ok: false, id: spec.id, error: "The analysis service could not run it." };
    }

    const payload = (await response.json()) as {
      rowsRead?: Record<string, number>;
      sections?: AnalysisSection[];
    };
    const sections = payload.sections ?? [];
    if (sections.length === 0) {
      return { ok: false, id: spec.id, error: "The analysis produced no output to show." };
    }

    return {
      ok: true,
      id: spec.id,
      title: spec.title,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      rowsRead: payload.rowsRead ?? {},
      sections,
      // Taken from here, not from the service, so the caveats cannot go missing
      // because a deployment is out of date.
      limitations: spec.limitations,
    };
  } catch (error) {
    console.error("[analysis] Service call failed.", spec.id, error);
    return { ok: false, id: spec.id, error: "The analysis service could not be reached." };
  }
}

export async function runAnalysis(id: string): Promise<AnalysisResult> {
  const spec = findAnalysis(id);
  // The only path to running anything, and it only opens for an id on the list.
  if (!spec) return { ok: false, id, error: "Unknown analysis." };

  const analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL;
  const analysisServiceKey = process.env.ANALYSIS_SERVICE_KEY;
  if (analysisServiceUrl && analysisServiceKey) {
    return runRemote(spec, analysisServiceUrl, analysisServiceKey);
  }

  const status = analysisBackendStatus();
  if (!status.ready) return { ok: false, id, error: status.reason ?? "Not available." };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, id, error: "The analysis backend has no database credentials." };
  }

  const started = Date.now();
  const workdir = await mkdtemp(path.join(tmpdir(), "portal-analysis-"));
  const inputDir = path.join(workdir, "input");
  const outputDir = path.join(workdir, "output");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    // Several scripts import matplotlib, and a couple call show(). Without a
    // headless backend that blocks until the timeout kills it.
    MPLBACKEND: "Agg",
  };

  try {
    const fetched = await run(
      path.join(repoRoot(), ".venv", "bin", "connectme-fetch-supabase"),
      ["--output-dir", inputDir, "--overwrite"],
      { cwd: repoRoot(), env },
    );

    if (fetched.code !== 0) {
      console.error("[analysis] Supabase export failed.", fetched.stderr.slice(0, 2000));
      return { ok: false, id, error: "The data export failed." };
    }

    const rowsRead: Record<string, number> = {};
    for (const line of fetched.stdout.split("\n")) {
      const match = line.match(/^(\w+): (\d+) row/);
      if (match) rowsRead[match[1]] = Number(match[2]);
    }

    const result = await run(
      path.join(repoRoot(), ".venv", "bin", "connectme-analysis"),
      ["run", spec.id, "--", ...spec.args({ inputDir, outputDir })],
      { cwd: repoRoot(), env },
    );

    if (result.timedOut) {
      return { ok: false, id, error: "The analysis took too long and was stopped." };
    }
    if (result.code !== 0) {
      console.error("[analysis] Run failed.", spec.id, result.stderr.slice(0, 2000));
      return { ok: false, id, error: "The analysis did not finish." };
    }

    const sections = await collect(spec, outputDir, result.stdout);
    if (sections.length === 0) {
      return { ok: false, id, error: "The analysis produced no output to show." };
    }

    return {
      ok: true,
      id: spec.id,
      title: spec.title,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      rowsRead,
      sections,
      limitations: spec.limitations,
    };
  } finally {
    // The repo's runner also leaves a copy of the analysis tree in the system
    // temp dir. This at least keeps our own per-run directory from piling up.
    await rm(workdir, { recursive: true, force: true }).catch(() => {});
    void readdir;
  }
}
