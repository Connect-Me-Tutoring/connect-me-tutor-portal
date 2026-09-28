"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropoffRole,
  DropoffRow,
  DropoffSummary,
  filterRows,
  formatMonth,
  formatPct,
  joinMonths,
  monthKey,
  pendingMonths,
  permanentlyLeft,
  shownDropped,
  summarize,
} from "@/lib/utils/dropoff";

type View = "count" | "rate";

const LEFT_COLOR = "#0E5B94"; // connect-me-blue-3
const RETURNED_COLOR = "#b4b2a9";
const HATCH_ID = "dropoff-too-recent";

const toggleClass = (on: boolean) =>
  `text-xs px-3 py-1 rounded border ${on ? "bg-gray-800 text-white border-gray-800" : "text-gray-600"}`;

const DropoffChart = () => {
  const [data, setData] = useState<DropoffRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [role, setRole] = useState<DropoffRole>("Tutor");
  const [view, setView] = useState<View>("count");
  const [includeReturned, setIncludeReturned] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeError, setRangeError] = useState("");

  const latestRequestIdRef = useRef(0);

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    const requestId = ++latestRequestIdRef.current;
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_dropoff_stats");
      if (requestId !== latestRequestIdRef.current) return;
      if (error) throw error;
      // Generated types can't express that dropped/returned are null until a
      // month is complete, so narrow to the real shape here.
      const rows = (data ?? []) as unknown as DropoffRow[];
      setData(rows);
      if (rows.length) {
        setRangeStart(monthKey(rows.reduce((a, r) => (r.month < a ? r.month : a), rows[0].month)));
        setRangeEnd(monthKey(rows.reduce((a, r) => (r.month > a ? r.month : a), rows[0].month)));
      }
      setRangeError("");
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;
      console.error(error);
      toast.error("Unable to load drop-off stats");
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const bounds = useMemo(() => {
    if (!data.length) return { min: "", max: "" };
    const keys = data.map((r) => monthKey(r.month)).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
  }, [data]);

  const setRange = (start: string, end: string) => {
    if (!start || !end) return setRangeError("Pick both a start and end month.");
    if (start > end) return setRangeError("The start month needs to be before the end month.");
    setRangeError("");
    setRangeStart(start);
    setRangeEnd(end);
  };

  const rows = useMemo(
    () => filterRows(data, role, rangeStart, rangeEnd),
    [data, role, rangeStart, rangeEnd],
  );
  const summary = useMemo(() => summarize(rows, includeReturned), [rows, includeReturned]);
  const pending = useMemo(() => pendingMonths(rows), [rows]);

  // Striped placeholder for months that are too recent: a quarter of the
  // tallest known bar, so it reads as "something goes here" without implying a value.
  const placeholder = useMemo(() => {
    const known = rows.map((r) => shownDropped(r, includeReturned) ?? 0);
    return Math.max(4, Math.round((known.length ? Math.max(...known) : 10) * 0.25));
  }, [rows, includeReturned]);

  const chartData = useMemo(
    () =>
      rows.map((r) => {
        const left = permanentlyLeft(r);
        return {
          ...r,
          label: formatMonth(r.month),
          left,
          returnedShown: includeReturned ? r.returned : null,
          pending: r.is_complete ? null : placeholder,
          leftRate: left === null ? null : Number(((100 * left) / r.active).toFixed(1)),
          allRate: r.dropped === null ? null : Number(((100 * r.dropped) / r.active).toFixed(1)),
        };
      }),
    [rows, includeReturned, placeholder],
  );

  if (isLoading) return <div>Loading drop-off stats...</div>;
  if (!data.length) return <div>No data available</div>;

  const who = role === "Tutor" ? "tutors" : "students";

  const tiles: { label: string; value: string; hint: string }[] = summary.completeMonths.length
    ? [
        {
          label: includeReturned ? "Avg monthly drop-off, incl. returned" : "Avg monthly drop-off",
          value: formatPct(summary.rate),
          hint: `of active ${who} each month`,
        },
        {
          label: includeReturned ? "Left, incl. returned" : "Permanently left",
          value: summary.shown.toLocaleString(),
          hint: `${who} over ${summary.completeMonths.length} month${summary.completeMonths.length > 1 ? "s" : ""}`,
        },
        ...(includeReturned
          ? [
              {
                label: "Returned",
                value: summary.dropped
                  ? `${Math.round((100 * summary.returned) / summary.dropped)}%`
                  : "0%",
                hint: `${summary.returned.toLocaleString()} of ${summary.dropped.toLocaleString()} drop-offs`,
              },
            ]
          : []),
      ]
    : [];

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as DropoffRow & { leftRate: number; allRate: number };
    const left = permanentlyLeft(row);
    return (
      <div className="rounded border bg-white px-3 py-2 text-xs shadow">
        <div className="font-medium">
          {formatMonth(row.month, true)}: {row.active.toLocaleString()} active {who}
        </div>
        {!row.is_complete ? (
          <div className="text-gray-500">Too recent to know yet</div>
        ) : view === "count" ? (
          <>
            <div className="text-gray-600">Permanently left: {left}</div>
            {includeReturned && <div className="text-gray-600">Returned: {row.returned}</div>}
          </>
        ) : (
          <>
            <div className="text-gray-600">Permanently left: {row.leftRate}%</div>
            {includeReturned && (
              <div className="text-gray-600">Including returned: {row.allRate}%</div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-4 mb-3">
        <InfoDialog
          who={who}
          summary={summary}
          includeReturned={includeReturned}
          rangeLabel={
            summary.completeMonths.length
              ? `${formatMonth(summary.completeMonths[0].month, true)} to ${formatMonth(
                  summary.completeMonths[summary.completeMonths.length - 1].month,
                  true,
                )}`
              : ""
          }
        />
        <button
          onClick={() => fetchStats(true)}
          disabled={isRefreshing}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-3">
        <div className="flex items-center gap-1" role="group" aria-label="Show">
          <button onClick={() => setRole("Tutor")} className={toggleClass(role === "Tutor")}>
            Tutors
          </button>
          <button onClick={() => setRole("Student")} className={toggleClass(role === "Student")}>
            Students
          </button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Measure">
          <button onClick={() => setView("count")} className={toggleClass(view === "count")}>
            Count
          </button>
          <button onClick={() => setView("rate")} className={toggleClass(view === "rate")}>
            Rate
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-gray-500">From</span>
          <input
            type="month"
            value={rangeStart}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setRange(e.target.value, rangeEnd)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-gray-500">To</span>
          <input
            type="month"
            value={rangeEnd}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => setRange(rangeStart, e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={() => setRange(bounds.min, bounds.max)}
          className="text-xs text-blue-600 hover:underline"
        >
          Reset range
        </button>

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={includeReturned}
            onChange={(e) => setIncludeReturned(e.target.checked)}
          />
          <span className="text-gray-600">Include people who returned</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showTable}
            onChange={(e) => setShowTable(e.target.checked)}
          />
          <span className="text-gray-600">Show data table</span>
        </label>
      </div>
      {rangeError && (
        <p className="text-xs text-red-600 mb-2" role="alert">
          {rangeError}
        </p>
      )}

      {tiles.length ? (
        <div
          className={`grid grid-cols-1 gap-3 mt-3 ${tiles.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg bg-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">{t.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
              <p className="text-xs text-gray-500">{t.hint}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-gray-100 px-4 py-3 mt-3 text-sm text-gray-600">
          No complete months in this range. Pick a range that includes months at least 6 weeks old.
        </div>
      )}
      {pending.length > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {joinMonths(pending)} {pending.length > 1 ? "are" : "is"} too recent to know yet and{" "}
          {pending.length > 1 ? "aren't" : "isn't"} included in these numbers.
        </p>
      )}

      <Legend
        view={view}
        includeReturned={includeReturned}
        hasPending={pending.length > 0}
        who={who}
      />

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">
          No months with completed sessions in the selected range.
        </div>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <defs>
                <pattern
                  id={HATCH_ID}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="6" stroke={RETURNED_COLOR} strokeWidth="2" />
                </pattern>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                tickFormatter={(v) => (view === "rate" ? `${v}%` : v.toLocaleString())}
                label={{
                  value:
                    view === "rate"
                      ? `% of active ${who}`
                      : `${who[0].toUpperCase()}${who.slice(1)}`,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
              />
              <Tooltip content={renderTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              {/* No fragments here: with React 19, recharts 2.x can't see inside
                  <>...</> (react-is 18 isFragment is false) and silently drops the
                  series. Each series gets its own condition instead. */}
              {view === "count" && (
                <Bar
                  dataKey="left"
                  stackId="d"
                  fill={LEFT_COLOR}
                  maxBarSize={28}
                  radius={includeReturned ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                />
              )}
              {view === "count" && includeReturned && (
                <Bar
                  dataKey="returnedShown"
                  stackId="d"
                  fill={RETURNED_COLOR}
                  maxBarSize={28}
                  radius={[4, 4, 0, 0]}
                />
              )}
              {view === "count" && (
                <Bar dataKey="pending" stackId="d" fill={`url(#${HATCH_ID})`} maxBarSize={28} />
              )}
              {view === "rate" && (
                <Line
                  type="monotone"
                  dataKey="leftRate"
                  stroke={LEFT_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              )}
              {view === "rate" && includeReturned && (
                <Line
                  type="monotone"
                  dataKey="allRate"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {showTable && chartData.length > 0 && (
        <div className="mt-4 overflow-auto" style={{ maxHeight: 400 }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Permanently left</th>
                {includeReturned && <th className="py-2 pr-4 font-medium">Returned</th>}
                <th className="py-2 font-medium">Drop-off rate</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.month} className="border-b last:border-0">
                  <td className="py-2 pr-4">{formatMonth(d.month, true)}</td>
                  {d.is_complete ? (
                    <>
                      <td className="py-2 pr-4">{d.left?.toLocaleString()}</td>
                      {includeReturned && (
                        <td className="py-2 pr-4">{d.returned?.toLocaleString()}</td>
                      )}
                      <td className="py-2">
                        {formatPct((100 * (shownDropped(d, includeReturned) ?? 0)) / d.active)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 pr-4 text-gray-400">—</td>
                      {includeReturned && <td className="py-2 pr-4 text-gray-400">—</td>}
                      <td className="py-2 text-gray-400">Too recent</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            {summary.completeMonths.length > 0 && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-4">
                    Total ({summary.completeMonths.length} complete month
                    {summary.completeMonths.length > 1 ? "s" : ""})
                  </td>
                  <td className="py-2 pr-4">{summary.permanentlyLeft.toLocaleString()}</td>
                  {includeReturned && (
                    <td className="py-2 pr-4">{summary.returned.toLocaleString()}</td>
                  )}
                  <td className="py-2">{formatPct(summary.rate)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Excludes test and dummy accounts, and sessions whose person was deleted. See &ldquo;How this
        is calculated&rdquo; for details.
      </p>
    </div>
  );
};

const Legend = ({
  view,
  includeReturned,
  hasPending,
  who,
}: {
  view: View;
  includeReturned: boolean;
  hasPending: boolean;
  who: string;
}) => (
  <div className="flex flex-wrap gap-4 text-xs text-gray-600 mt-4 mb-1">
    {view === "count" ? (
      <>
        <LegendItem
          swatch={
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: LEFT_COLOR }}
            />
          }
        >
          Permanently left
        </LegendItem>
        {includeReturned && (
          <LegendItem
            swatch={
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: RETURNED_COLOR }}
              />
            }
          >
            Returned
          </LegendItem>
        )}
        {hasPending && (
          <LegendItem
            swatch={
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm border"
                style={{
                  borderColor: RETURNED_COLOR,
                  background: `repeating-linear-gradient(135deg, ${RETURNED_COLOR} 0 2px, transparent 2px 5px)`,
                }}
              />
            }
          >
            Too recent to know
          </LegendItem>
        )}
      </>
    ) : (
      <>
        <LegendItem
          swatch={
            <span className="inline-block w-4 border-t-2" style={{ borderColor: LEFT_COLOR }} />
          }
        >
          Permanently left, % of active {who}
        </LegendItem>
        {includeReturned && (
          <LegendItem
            swatch={<span className="inline-block w-4 border-t-2 border-dashed border-gray-500" />}
          >
            Including returned
          </LegendItem>
        )}
      </>
    )}
  </div>
);

const LegendItem = ({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {children}
  </span>
);

const InfoDialog = ({
  who,
  summary,
  includeReturned,
  rangeLabel,
}: {
  who: string;
  summary: DropoffSummary;
  includeReturned: boolean;
  rangeLabel: string;
}) => {
  const n = summary.completeMonths.length;
  const counts = includeReturned
    ? "everyone who dropped off, including people who returned"
    : "people who permanently left";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          How this is calculated
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How drop-off is calculated</DialogTitle>
          <DialogDescription>
            Every number follows the Tutors/Students choice, the date range, and the
            &ldquo;returned&rdquo; setting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm text-gray-600">
          <section>
            <h4 className="font-semibold text-gray-900 mb-1">What counts as a drop-off</h4>
            <p>
              Someone drops off when they go <b>6 weeks (42 days) without a completed session</b>.
              They&rsquo;re counted in the month of their <b>last session before the gap</b>.
            </p>
            <div className="my-2 flex items-center gap-2 text-xs text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEFT_COLOR }} />
              Nov 10 session
              <span className="relative flex-1 border-t-2 border-dashed border-gray-300 text-center">
                <span className="relative -top-2.5 bg-white px-1.5">84 days, no sessions</span>
              </span>
              Feb 2 session
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEFT_COLOR }} />
            </div>
            <p>
              In this example the person dropped off in <b>November</b>. Only sessions marked
              Complete count; cancelled and upcoming sessions don&rsquo;t.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">Permanently left vs. returned</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <b>Permanently left:</b> no completed session after the gap, as of today.
              </li>
              <li>
                <b>Returned:</b> they had another completed session after the gap, so it was a break
                rather than leaving. These are hidden unless &ldquo;Include people who
                returned&rdquo; is on.
              </li>
            </ul>
            <p className="mt-1">
              A person can drop off more than once (for example, leave in December, return in
              February, leave again in May). Each time counts in its own month.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">
              Why recent months say &ldquo;too recent to know&rdquo;
            </h4>
            <p>
              A 6-week gap can&rsquo;t be confirmed until 6 weeks have passed after a month ends.
              Those months show as striped and are left out of every total and average; they fill in
              on their own as time passes.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">What each number means</h4>
            {n === 0 ? (
              <p>Pick a range with at least one complete month to see worked examples.</p>
            ) : (
              <div className="space-y-3">
                <Metric
                  title={
                    includeReturned
                      ? "Avg monthly drop-off, incl. returned"
                      : "Avg monthly drop-off"
                  }
                >
                  <p>
                    The share of active {who} who dropped off in a typical month.
                    &ldquo;Active&rdquo; means they had at least one completed session that month,
                    so this is <b>not</b> a percentage of everyone signed up on the portal. It
                    counts {counts}.
                  </p>
                  <Formula
                    text={`Drop-offs in the range ÷ active ${who} added up across those months`}
                    example={`Now: ${summary.shown.toLocaleString()} ÷ ${summary.active.toLocaleString()} = ${formatPct(summary.rate)} (${rangeLabel})`}
                  />
                  <p>
                    Months are pooled rather than averaged, so busy months weigh more than quiet
                    ones.
                  </p>
                </Metric>
                <Metric title={includeReturned ? "Left, incl. returned" : "Permanently left"}>
                  <p>
                    How many times {who} dropped off in the selected range, counting {counts}.
                    Someone who leaves twice counts twice.
                  </p>
                  <Formula
                    text="Sum of monthly drop-offs"
                    example={`Now: ${summary.shown.toLocaleString()} across ${n} complete month${n > 1 ? "s" : ""}`}
                  />
                </Metric>
                {includeReturned && (
                  <Metric title="Returned">
                    <p>
                      Of everyone who dropped off, the share who later had another completed
                      session. Recent months are undercounted because those people have had less
                      time to return.
                    </p>
                    <Formula
                      text="Returned ÷ all drop-offs"
                      example={`Now: ${summary.returned.toLocaleString()} ÷ ${summary.dropped.toLocaleString()} = ${
                        summary.dropped ? Math.round((100 * summary.returned) / summary.dropped) : 0
                      }%`}
                    />
                  </Metric>
                )}
                <Metric title="Chart and table">
                  <p>
                    Each month shows {who} whose last session before a 6-week gap fell in that
                    month. A month&rsquo;s drop-off rate is that count ÷ that month&rsquo;s active{" "}
                    {who}.
                  </p>
                </Metric>
              </div>
            )}
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 mb-1">What isn&rsquo;t counted</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Test and dummy accounts.</li>
              <li>
                Accounts that were deleted: their sessions lose the person&rsquo;s ID, so they
                can&rsquo;t be traced. This slightly undercounts drop-off.
              </li>
              <li>
                Why someone left. This measures activity only; a person still enrolled but with all
                sessions cancelled for 6 weeks counts as a drop-off.
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Metric = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t pt-3 space-y-1">
    <p className="font-semibold text-gray-900">{title}</p>
    {children}
  </div>
);

const Formula = ({ text, example }: { text: string; example: string }) => (
  <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-900">
    {text}
    <span className="block text-gray-500 mt-0.5">{example}</span>
  </div>
);

export default DropoffChart;
