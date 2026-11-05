import { describe, it, expect } from "vitest";
import {
  DropoffRow,
  filterRows,
  formatPct,
  joinMonths,
  pendingMonths,
  permanentlyLeft,
  shownDropped,
  summarize,
} from "./dropoff";

const row = (
  ym: string,
  active: number,
  dropped: number | null,
  returned: number | null,
  role: DropoffRow["role"] = "Tutor",
): DropoffRow => ({
  role,
  month: `${ym}-01`,
  active,
  dropped,
  returned,
  is_complete: dropped !== null,
});

// Real tutor rows from get_dropoff_stats run against the Jul 5 2026 export.
const TUTORS: DropoffRow[] = [
  row("2025-03", 82, 4, 1),
  row("2025-04", 101, 10, 3),
  row("2025-05", 110, 33, 13),
  row("2025-06", 92, 25, 12),
  row("2025-07", 86, 15, 8),
  row("2025-08", 106, 13, 6),
  row("2025-09", 125, 14, 6),
  row("2025-10", 167, 19, 5),
  row("2025-11", 193, 29, 15),
  row("2025-12", 199, 29, 10),
  row("2026-01", 239, 30, 12),
  row("2026-02", 273, 38, 6),
  row("2026-03", 284, 50, 11),
  row("2026-04", 266, 47, 8),
  row("2026-05", 251, null, null),
  row("2026-06", 216, null, null),
];

describe("summarize", () => {
  it("matches the approved demo for tutors, Mar 2025 to Jun 2026", () => {
    const off = summarize(TUTORS, false);
    expect(off.completeMonths).toHaveLength(14);
    expect(off.active).toBe(2323);
    expect(off.dropped).toBe(356);
    expect(off.returned).toBe(116);
    expect(off.permanentlyLeft).toBe(240);
    expect(off.shown).toBe(240);
    expect(formatPct(off.rate)).toBe("10.3%");

    const on = summarize(TUTORS, true);
    expect(on.shown).toBe(356);
    expect(formatPct(on.rate)).toBe("15.3%");
  });

  it("leaves incomplete months out of every total", () => {
    const s = summarize([row("2026-04", 100, 10, 2), row("2026-05", 999, null, null)], false);
    expect(s.active).toBe(100);
    expect(s.shown).toBe(8);
    expect(s.rate).toBeCloseTo(8);
  });

  it("pools months instead of averaging their rates", () => {
    // 1/10 = 10% and 10/1000 = 1%: a plain average would be 5.5%, pooled is 11/1010.
    const s = summarize([row("2025-01", 10, 1, 0), row("2025-02", 1000, 10, 0)], false);
    expect(s.rate).toBeCloseTo((100 * 11) / 1010);
  });

  it("returns a zero rate, not NaN, when nothing is complete", () => {
    const s = summarize([row("2026-06", 50, null, null)], true);
    expect(s.completeMonths).toHaveLength(0);
    expect(s.rate).toBe(0);
    expect(summarize([], false).rate).toBe(0);
  });
});

describe("filterRows", () => {
  const mixed = [...TUTORS, row("2025-03", 108, 7, 1, "Student")];

  it("keeps only the chosen role", () => {
    expect(filterRows(mixed, "Student", "", "")).toHaveLength(1);
    expect(filterRows(mixed, "Tutor", "", "")).toHaveLength(16);
  });

  it("treats both range ends as inclusive", () => {
    const r = filterRows(TUTORS, "Tutor", "2025-09", "2025-11");
    expect(r.map((x) => x.month)).toEqual(["2025-09-01", "2025-10-01", "2025-11-01"]);
  });

  it("treats empty bounds as open", () => {
    expect(filterRows(TUTORS, "Tutor", "2026-05", "")).toHaveLength(2);
    expect(filterRows(TUTORS, "Tutor", "", "2025-04")).toHaveLength(2);
  });
});

describe("row helpers", () => {
  it("permanently left = dropped minus returned, null while incomplete", () => {
    expect(permanentlyLeft(row("2025-05", 110, 33, 13))).toBe(20);
    expect(permanentlyLeft(row("2026-05", 251, null, null))).toBeNull();
  });

  it("shownDropped follows the returned toggle", () => {
    const r = row("2025-05", 110, 33, 13);
    expect(shownDropped(r, false)).toBe(20);
    expect(shownDropped(r, true)).toBe(33);
  });

  it("pendingMonths lists only incomplete months", () => {
    expect(pendingMonths(TUTORS).map((r) => r.month)).toEqual(["2026-05-01", "2026-06-01"]);
  });
});

describe("joinMonths", () => {
  it("reads naturally for one, two, and three months", () => {
    expect(joinMonths([row("2026-05", 1, null, null)])).toBe("May 2026");
    expect(joinMonths(pendingMonths(TUTORS))).toBe("May 2026 and Jun 2026");
    expect(
      joinMonths([
        row("2026-06", 1, null, null),
        row("2026-07", 1, null, null),
        row("2026-08", 1, null, null),
      ]),
    ).toBe("Jun 2026, Jul 2026, and Aug 2026");
  });
});
