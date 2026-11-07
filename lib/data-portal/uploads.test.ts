import { describe, expect, it } from "vitest";
import {
  MAX_COLUMNS,
  chunk,
  datasetNameFromFilename,
  datasetNameSchema,
  datasetTitleFromFilename,
  isStoragePathFor,
  parseCsvForImport,
  storagePathFor,
  toColumnNames,
} from "./uploads";

describe("dataset names", () => {
  it("suggests a table name from the file name", () => {
    expect(datasetNameFromFilename("Tutor Applications (Nov).csv")).toBe("tutor_applications_nov");
    expect(datasetNameFromFilename("2026-zoom export.csv")).toBe("d_2026_zoom_export");
    expect(datasetNameFromFilename("###.csv")).toBe("dataset");
  });

  it("suggests a title from the file name", () => {
    expect(datasetTitleFromFilename("tutor-applications_nov.csv")).toBe("Tutor applications nov");
  });

  it("accepts only identifiers the database will accept", () => {
    expect(datasetNameSchema.safeParse("tutor_applications").success).toBe(true);
    for (const bad of ["", "1abc", "Tutor", "a-b", 'x"; drop table y; --', "a".repeat(49)]) {
      expect(datasetNameSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("keeps uploads inside the dataset's own folder", () => {
    const path = storagePathFor("tutor_applications", "2026-11-04T10-00-00-000Z-ab12cd34");
    expect(isStoragePathFor("tutor_applications", path)).toBe(true);
    expect(isStoragePathFor("other", path)).toBe(false);
    expect(isStoragePathFor("tutor_applications", "datasets/tutor_applications/../x.csv")).toBe(
      false,
    );
    expect(isStoragePathFor("tutor_applications", "datasets/tutor_applications/a/b.csv")).toBe(
      false,
    );
  });
});

describe("toColumnNames", () => {
  it("makes lowercase, unique identifiers", () => {
    expect(toColumnNames(["First Name", "first name", "First-Name", "Email Address"])).toEqual([
      "first_name",
      "first_name_2",
      "first_name_3",
      "email_address",
    ]);
  });

  it("never leaves a column without a usable name", () => {
    expect(toColumnNames(["", "2026 Grade", "Café ☕", '"; drop table x; --'])).toEqual([
      "column_1",
      "c_2026_grade",
      "cafe",
      "drop_table_x",
    ]);
  });

  it("keeps names within Postgres's identifier limit", () => {
    const [name] = toColumnNames(["x".repeat(200)]);
    expect(name.length).toBeLessThanOrEqual(63);
  });
});

describe("parseCsvForImport", () => {
  it("reads the header and rows, turning empty values into null", () => {
    const result = parseCsvForImport('﻿Name,Grade\r\n"Smith, Ana",9\r\nLee,\r\n\r\n');
    expect(result).toEqual({
      ok: true,
      header: ["Name", "Grade"],
      columns: ["name", "grade"],
      rows: [
        ["Smith, Ana", "9"],
        ["Lee", null],
      ],
    });
  });

  it("refuses a row with the wrong number of values, naming the row", () => {
    const result = parseCsvForImport("a,b\n1,2\n3\n");
    expect(result).toEqual({ ok: false, error: "Row 3 has 1 values but the header has 2." });
  });

  it("refuses files with nothing to import", () => {
    expect(parseCsvForImport("")).toMatchObject({ ok: false, error: "The file is empty." });
    expect(parseCsvForImport("a,b\n")).toMatchObject({
      ok: false,
      error: "The file has a header row but no data rows.",
    });
  });

  it("refuses more columns than a dataset can hold", () => {
    const header = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(",");
    expect(parseCsvForImport(`${header}\n${header}\n`)).toMatchObject({ ok: false });
  });
});

describe("chunk", () => {
  it("splits rows into chunks of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
