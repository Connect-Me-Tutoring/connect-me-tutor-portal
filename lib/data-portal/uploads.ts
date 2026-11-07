import Papa from "papaparse";
import { z } from "zod/v4";

/**
 * Turning an uploaded CSV into rows for an uploads.<name> table.
 *
 * The other half of this contract is
 * supabase/migrations/20261104000000_add_data_portal_uploads.sql, which checks
 * every name and row again. The limits here match the ones there, so a file
 * that would be refused is refused before anything is sent.
 */

export const UPLOADS_BUCKET = "data-portal-uploads";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_ROWS = 200_000;
export const MAX_COLUMNS = 200;
export const ROWS_PER_CHUNK = 2_000;

export const datasetNameSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]{0,47}$/,
    "Use lowercase letters, numbers and underscores, starting with a letter.",
  );

export const datasetTitleSchema = z.string().trim().min(1).max(120);

const STORAGE_FILE = /^[A-Za-z0-9_.-]{1,120}\.csv$/;

/** Where an upload's original file lives in the bucket. */
export function storagePathFor(name: string, fileId: string): string {
  return `datasets/${name}/${fileId}.csv`;
}

export function isStoragePathFor(name: string, path: string): boolean {
  const prefix = `datasets/${name}/`;
  return path.startsWith(prefix) && STORAGE_FILE.test(path.slice(prefix.length));
}

function toIdentifier(raw: string, maxLength: number): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, maxLength).replace(/_+$/, "");
}

/** A suggested dataset name from a file name: "Tutor Applications (Nov).csv" -> "tutor_applications_nov". */
export function datasetNameFromFilename(filename: string): string {
  const base = toIdentifier(filename.replace(/\.[^.]*$/, ""), 48);
  if (!base) return "dataset";
  return /^[a-z]/.test(base) ? base : `d_${base}`.slice(0, 48);
}

/** A suggested title from a file name: "tutor-applications_nov.csv" -> "Tutor applications nov". */
export function datasetTitleFromFilename(filename: string): string {
  const words = filename
    .replace(/\.[^.]*$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = words ? words[0].toUpperCase() + words.slice(1) : "Uploaded data";
  return title.slice(0, 120);
}

/**
 * Column names for the table, from the CSV's header row: lowercase
 * identifiers, unique, and never empty. "First Name", "first name" and
 * "First-Name" become first_name, first_name_2 and first_name_3.
 */
export function toColumnNames(header: string[]): string[] {
  const used = new Set<string>();
  return header.map((raw, index) => {
    let base = toIdentifier(raw, 58) || `column_${index + 1}`;
    if (/^[0-9]/.test(base)) base = `c_${base}`.slice(0, 58);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
    used.add(name);
    return name;
  });
}

export type ParsedCsv =
  | { ok: true; header: string[]; columns: string[]; rows: (string | null)[][] }
  | { ok: false; error: string };

/**
 * Parses the file strictly: the first row is the header, and every other row
 * must have exactly as many values as it does. A row that does not would put
 * values under the wrong column, so the whole file is refused and the row is
 * named. Empty values become null.
 */
export function parseCsvForImport(text: string): ParsedCsv {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });

  const fatal = parsed.errors.find((e) => e.type === "Quotes");
  if (fatal) {
    return { ok: false, error: `The file has an unclosed quote near row ${(fatal.row ?? 0) + 1}.` };
  }

  const [header, ...body] = parsed.data;
  if (!header || header.every((cell) => cell.trim() === "")) {
    return { ok: false, error: "The file is empty." };
  }
  if (header.length > MAX_COLUMNS) {
    return {
      ok: false,
      error: `The file has ${header.length} columns; the limit is ${MAX_COLUMNS}.`,
    };
  }
  if (body.length === 0) {
    return { ok: false, error: "The file has a header row but no data rows." };
  }
  if (body.length > MAX_ROWS) {
    return {
      ok: false,
      error: `The file has ${body.length.toLocaleString()} rows; the limit is ${MAX_ROWS.toLocaleString()}.`,
    };
  }

  const rows: (string | null)[][] = [];
  for (let i = 0; i < body.length; i++) {
    const row = body[i];
    if (row.length !== header.length) {
      // Row numbers as a spreadsheet shows them: the header is row 1.
      return {
        ok: false,
        error: `Row ${i + 2} has ${row.length} values but the header has ${header.length}.`,
      };
    }
    rows.push(row.map((value) => (value === "" ? null : value)));
  }

  return { ok: true, header, columns: toColumnNames(header), rows };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// The payloads the database functions return, checked before anything uses them.

export const datasetSummarySchema = z.object({
  name: z.string(),
  title: z.string(),
  columns: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  originalFilename: z.string(),
  uploadedAt: z.string(),
  uploadedBy: z.string().nullable(),
  versions: z.number().int().nonnegative(),
});
export type DatasetSummary = z.infer<typeof datasetSummarySchema>;

export const datasetListSchema = z.array(datasetSummarySchema);

export const datasetPreviewSchema = z.object({
  name: z.string(),
  columns: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  rows: z.array(z.array(z.string().nullable())),
});
export type DatasetPreview = z.infer<typeof datasetPreviewSchema>;
