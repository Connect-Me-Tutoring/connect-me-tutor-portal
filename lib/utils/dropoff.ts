/**
 * Helpers for DropoffChart. The heavy lifting (6-week gap detection) happens in
 * the get_dropoff_stats RPC; these only filter and summarize its rows.
 */

export type DropoffRole = "Tutor" | "Student";

/** One row of get_dropoff_stats. dropped/returned are null until is_complete. */
export interface DropoffRow {
  role: DropoffRole;
  month: string; // "YYYY-MM-DD", first day of the month
  active: number;
  dropped: number | null; // includes people who returned
  returned: number | null;
  is_complete: boolean;
}

export interface DropoffSummary {
  completeMonths: DropoffRow[];
  /** Active people added up across complete months (the rate's denominator). */
  active: number;
  /** All drop-offs, including people who returned. */
  dropped: number;
  returned: number;
  permanentlyLeft: number;
  /** Drop-offs shown under the current toggle. */
  shown: number;
  /** shown / active, as a percentage. 0 when there are no complete months. */
  rate: number;
}

/** "2026-03-01" -> "2026-03", the value shape of <input type="month">. */
export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export const permanentlyLeft = (row: DropoffRow): number | null =>
  row.dropped === null ? null : row.dropped - (row.returned ?? 0);

/** Drop-offs for a row under the "include people who returned" setting. */
export const shownDropped = (row: DropoffRow, includeReturned: boolean): number | null =>
  includeReturned ? row.dropped : permanentlyLeft(row);

/** Rows for one role within an inclusive "YYYY-MM" range (empty bounds = open). */
export const filterRows = (
  rows: DropoffRow[],
  role: DropoffRole,
  from: string,
  to: string,
): DropoffRow[] =>
  rows.filter((r) => {
    if (r.role !== role) return false;
    const k = monthKey(r.month);
    if (from && k < from) return false;
    if (to && k > to) return false;
    return true;
  });

/**
 * Pools complete months: total drop-offs / total active. Pooling (rather than
 * averaging each month's rate) weights busy months more than quiet ones.
 * Incomplete months are left out entirely.
 */
export const summarize = (rows: DropoffRow[], includeReturned: boolean): DropoffSummary => {
  const completeMonths = rows.filter((r) => r.is_complete && r.dropped !== null);
  const active = completeMonths.reduce((s, r) => s + r.active, 0);
  const dropped = completeMonths.reduce((s, r) => s + (r.dropped ?? 0), 0);
  const returned = completeMonths.reduce((s, r) => s + (r.returned ?? 0), 0);
  const shown = includeReturned ? dropped : dropped - returned;
  return {
    completeMonths,
    active,
    dropped,
    returned,
    permanentlyLeft: dropped - returned,
    shown,
    rate: active > 0 ? (100 * shown) / active : 0,
  };
};

/** Months in the range whose 6-week window hasn't passed yet. */
export const pendingMonths = (rows: DropoffRow[]): DropoffRow[] =>
  rows.filter((r) => !r.is_complete);

export const formatMonth = (isoDate: string, long = false) =>
  new Date(`${isoDate.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: long ? "numeric" : "2-digit",
  });

export const formatPct = (value: number) => `${(Math.round(value * 10) / 10).toFixed(1)}%`;

/** "May 2026", "May 2026 and Jun 2026", "Jun 2026, Jul 2026, and Aug 2026". */
export const joinMonths = (rows: DropoffRow[]) => {
  const names = rows.map((r) => formatMonth(r.month, true));
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};
