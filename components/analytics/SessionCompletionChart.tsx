"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface PeriodStat {
  period: string; // "YYYY-MM-DD" (first day of the period)
  total_completed: number;
  total_resolved: number;
  pct_completed: number;
}

type Metric = "completed" | "pct";
type Granularity = "month" | "week";

/** Least-squares linear fit over y-values indexed 0..n-1. */
const linearTrend = (values: number[]): number[] => {
  const n = values.length;
  if (n < 2) return values;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((acc, y, i) => acc + i * y, 0);
  const sumXX = values.reduce((acc, _, i) => acc + i * i, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return values;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => slope * i + intercept);
};

// Range inputs hold a different value shape per mode, so the comparison key
// has to match: "YYYY-MM" for months, "YYYY-MM-DD" for weeks.
const rangeKey = (isoDate: string, g: Granularity) =>
  g === "month" ? isoDate.slice(0, 7) : isoDate.slice(0, 10);

const SessionCompletionChart = () => {
  const [data, setData] = useState<PeriodStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [granularity, setGranularity] = useState<Granularity>("month");
  const [firstOnly, setFirstOnly] = useState(false);
  const [metric, setMetric] = useState<Metric>("completed");
  const [showTable, setShowTable] = useState(false);
  const [showTrendline, setShowTrendline] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Guards against out-of-order responses: only the most recently issued
  // request is allowed to apply its result (e.g. rapidly switching
  // Monthly -> Weekly can resolve out of order).
  const latestRequestIdRef = useRef(0);

  const fetchStats = useCallback(
    async (g: Granularity, first: boolean, isManualRefresh = false) => {
      const requestId = ++latestRequestIdRef.current;
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_period_session_completion_stats", {
          p_granularity: g,
          p_first_sessions_only: first,
        });
        if (requestId !== latestRequestIdRef.current) return;
        if (error) throw error;
        const rows: PeriodStat[] = data ?? [];
        setData(rows);
        // Reset the range to span the new dataset. Required on a granularity
        // switch because the input value format changes between modes.
        if (rows.length) {
          setRangeStart(rangeKey(rows[0].period, g));
          setRangeEnd(rangeKey(rows[rows.length - 1].period, g));
        } else {
          setRangeStart("");
          setRangeEnd("");
        }
      } catch (error) {
        if (requestId !== latestRequestIdRef.current) return;
        console.error(error);
        toast.error("Unable to load session completion stats");
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchStats(granularity, firstOnly);
  }, [fetchStats, granularity, firstOnly]);

  const formatPeriod = useCallback(
    (iso: string, long = false) => {
      const d = new Date(`${iso}T00:00:00`);
      if (granularity === "month") {
        return d.toLocaleDateString("en-US", {
          month: "short",
          year: long ? "numeric" : "2-digit",
        });
      }
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(long ? { year: "numeric" } : {}),
      });
    },
    [granularity],
  );

  // Filtering is client-side: one fetch per granularity, then filter in memory
  // rather than hitting the RPC again on every date change.
  const filtered = useMemo(
    () =>
      data.filter((d) => {
        const k = rangeKey(d.period, granularity);
        if (rangeStart && k < rangeStart) return false;
        if (rangeEnd && k > rangeEnd) return false;
        return true;
      }),
    [data, rangeStart, rangeEnd, granularity],
  );

  // Recharts reads every series off the same row objects, so the active value
  // and its trend get folded in here rather than passed as separate arrays.
  const chartData = useMemo(() => {
    const values = filtered.map((d) =>
      metric === "completed" ? d.total_completed : d.pct_completed,
    );
    const trend = showTrendline && values.length >= 2 ? linearTrend(values) : null;
    return filtered.map((d, i) => ({
      ...d,
      label: formatPeriod(d.period),
      value: values[i],
      trend: trend ? Number(trend[i].toFixed(2)) : undefined,
    }));
  }, [filtered, metric, showTrendline, formatPeriod]);

  const resetRange = () => {
    if (!data.length) return;
    setRangeStart(rangeKey(data[0].period, granularity));
    setRangeEnd(rangeKey(data[data.length - 1].period, granularity));
  };

  if (isLoading) return <div>Loading completion stats...</div>;
  if (!data.length) return <div>No data available</div>;

  const scopeLabel = firstOnly ? "First sessions" : "Sessions";
  const axisTitle = metric === "completed" ? `${scopeLabel} completed` : "% completed";

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as PeriodStat & { value: number };
    return (
      <div className="rounded border bg-white px-3 py-2 text-xs shadow">
        <div className="font-medium">
          {granularity === "week"
            ? `Week of ${formatPeriod(row.period, true)}`
            : formatPeriod(row.period, true)}
        </div>
        <div className="text-gray-600">
          {row.total_completed.toLocaleString()} completed ({row.pct_completed}
          %)
        </div>
        <div className="text-gray-500">{row.total_resolved.toLocaleString()} resolved</div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={() => fetchStats(granularity, firstOnly, true)}
          disabled={isRefreshing}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Scope, granularity, and metric toggles */}
      <div className="flex flex-wrap items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFirstOnly(false)}
            className={`text-xs px-3 py-1 rounded border ${
              !firstOnly ? "bg-emerald-700 text-white border-emerald-700" : "text-gray-600"
            }`}
          >
            All sessions
          </button>
          <button
            onClick={() => setFirstOnly(true)}
            className={`text-xs px-3 py-1 rounded border ${
              firstOnly ? "bg-emerald-700 text-white border-emerald-700" : "text-gray-600"
            }`}
          >
            First sessions
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setGranularity("month")}
            className={`text-xs px-3 py-1 rounded border ${
              granularity === "month" ? "bg-gray-800 text-white border-gray-800" : "text-gray-600"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setGranularity("week")}
            className={`text-xs px-3 py-1 rounded border ${
              granularity === "week" ? "bg-gray-800 text-white border-gray-800" : "text-gray-600"
            }`}
          >
            Weekly
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setMetric("completed")}
            className={`text-xs px-3 py-1 rounded border ${
              metric === "completed" ? "bg-blue-600 text-white border-blue-600" : "text-gray-600"
            }`}
          >
            Sessions completed
          </button>
          <button
            onClick={() => setMetric("pct")}
            className={`text-xs px-3 py-1 rounded border ${
              metric === "pct" ? "bg-blue-600 text-white border-blue-600" : "text-gray-600"
            }`}
          >
            % completed
          </button>
        </div>
      </div>

      {/* Range + display options */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-gray-500">From</span>
          <input
            type={granularity === "month" ? "month" : "date"}
            value={rangeStart}
            max={rangeEnd || undefined}
            onChange={(e) => setRangeStart(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-gray-500">To</span>
          <input
            type={granularity === "month" ? "month" : "date"}
            value={rangeEnd}
            min={rangeStart || undefined}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </label>
        <button onClick={resetRange} className="text-xs text-blue-600 hover:underline">
          Reset range
        </button>

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={showTrendline}
            onChange={(e) => setShowTrendline(e.target.checked)}
          />
          <span className="text-gray-600">Trendline</span>
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

      {chartData.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">
          No {granularity === "week" ? "weeks" : "months"} with{" "}
          {firstOnly ? "first sessions" : "sessions"} in the selected range.
        </div>
      ) : (
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                // Week mode can run to 70+ bars; let Recharts thin the labels.
                interval={granularity === "week" ? "preserveStartEnd" : 0}
                angle={-45}
                textAnchor="end"
                height={56}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={metric === "pct" ? [0, 100] : [0, "auto"]}
                tickFormatter={(v) => (metric === "pct" ? `${v}%` : v.toLocaleString())}
                label={{
                  value: axisTitle,
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "#6b7280" },
                }}
              />
              <Tooltip content={renderTooltip} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar dataKey="value" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              {showTrendline && (
                <Line
                  type="linear"
                  dataKey="trend"
                  stroke="#ea580c"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
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
                <th className="py-2 pr-4 font-medium">
                  {granularity === "week" ? "Week of" : "Month"}
                </th>
                <th className="py-2 pr-4 font-medium">Completed</th>
                <th className="py-2 pr-4 font-medium">Resolved</th>
                <th className="py-2 font-medium">% completed</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d) => (
                <tr key={d.period} className="border-b last:border-0">
                  <td className="py-2 pr-4">{formatPeriod(d.period, true)}</td>
                  <td className="py-2 pr-4">{d.total_completed.toLocaleString()}</td>
                  <td className="py-2 pr-4">{d.total_resolved.toLocaleString()}</td>
                  <td className="py-2">{d.pct_completed}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SessionCompletionChart;
