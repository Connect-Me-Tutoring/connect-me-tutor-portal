import { describe, expect, it } from "vitest";
import { sanitizeForSheetCell } from "./spreadsheet";

describe("sanitizeForSheetCell", () => {
  it("keeps normal text unchanged", () => {
    expect(sanitizeForSheetCell("normal note")).toBe("normal note");
  });

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "   =1+1"])("neutralizes %s", (value) => {
    expect(sanitizeForSheetCell(value)).toBe(`'${value}`);
  });

  it("turns nullish values into empty strings", () => {
    expect(sanitizeForSheetCell(null)).toBe("");
    expect(sanitizeForSheetCell(undefined)).toBe("");
  });
});
