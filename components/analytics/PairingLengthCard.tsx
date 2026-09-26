"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { z } from "zod";

interface PairingLengthStat {
  population: "active" | "ended" | "all";
  pairs: number;
  avg_days: number;
  median_days: number;
  max_days: number;
  single_session_pairs: number;
}

interface PairingRow {
  tutor_name: string;
  student_name: string;
  days: number;
  status: "active" | "ended";
  started_on: string;
}

// database.types.ts types this RPC's returns as non-nullable: Postgres does not expose
// nullability for a function's RETURNS TABLE columns, so the generator has nothing to
// read and marks every function return non-nullable, while the table types are accurate.
// gen:types overwrites any hand edit to that file, so the real shape is enforced here,
// at the point the data arrives.
//
// The nulls are real. captured_on is the start of a week; a week with no capture comes
// back with every other field null, and a week captured while a population had no
// pairings comes back with pairs 0 and null averages.
const nullableNumber = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value) => (value === null ? null : Number(value)));

const HistoryPointSchema = z.object({
  captured_on: z.string(),
  pairs: nullableNumber,
  avg_days: nullableNumber,
  median_days: nullableNumber,
  single_session_pairs: nullableNumber,
});

const HistoryResponseSchema = z.array(HistoryPointSchema);

type HistoryPoint = z.infer<typeof HistoryPointSchema>;

type Population = "active" | "ended" | "all";
type HistoryMetric = "avg" | "median";

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 300;

const months = (days: number) => (days / 30.44).toFixed(1);

const shortDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const PairingLengthCard = () => {
  const [stats, setStats] = useState<PairingLengthStat[]>([]);
  const [rows, setRows] = useState<PairingRow[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  const [population, setPopulation] = useState<Population>("active");
  const [historyMetric, setHistoryMetric] = useState<HistoryMetric>("median");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Only the most recently issued request may apply its result. Typing in the
  // search box fires overlapping requests that can resolve out of order, which
  // would otherwise leave the table showing a stale query's rows.
  const rowsRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_pairing_length_stats");
      if (error) throw error;
      setStats((data ?? []) as PairingLengthStat[]);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load pairing length stats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (pop: Population) => {
    const requestId = ++historyRequestIdRef.current;
    try {
      const { data, error } = await supabase.rpc("get_pairing_length_history", {
        p_population: pop,
      });
      if (requestId !== historyRequestIdRef.current) return;
      if (error) throw error;

      const parsed = HistoryResponseSchema.safeParse(data ?? []);
      if (!parsed.success) {
        // Shape changed under us: surface it rather than rendering wrong numbers.
        console.error("Unexpected get_pairing_length_history payload", parsed.error.issues);
        toast.error("Unable to load pairing length history");
        setHistory([]);
        return;
      }

      setHistory(parsed.data);
    } catch (error) {
      if (requestId !== historyRequestIdRef.current) return;
      console.error(error);
      toast.error("Unable to load pairing length history");
    }
  }, []);

  const fetchRows = useCallback(async (pop: Population, term: string, offset: number) => {
    const requestId = ++rowsRequestIdRef.current;
    if (offset === 0) setIsLoadingRows(true);
    else setIsLoadingMore(true);

    try {
      const { data, error } = await supabase.rpc("get_pairing_lengths", {
        p_population: pop,
        // Omitted rather than nulled: the RPC parameter defaults to null server-side.
        p_search: term === "" ? undefined : term,
        p_limit: PAGE_SIZE,
        p_offset: offset,
      });
      if (requestId !== rowsRequestIdRef.current) return;
      if (error) throw error;

      const page = (data ?? []) as PairingRow[];
      setRows((prev) => (offset === 0 ? page : [...prev, ...page]));
      setNextOffset(offset + page.length);
      // A short page means the server ran out of rows, so there is no next page.
      setHasMore(page.length === PAGE_SIZE);
    } catch (error) {
      if (requestId !== rowsRequestIdRef.current) return;
      console.error(error);
      toast.error("Unable to load pairing lengths");
    } finally {
      if (requestId === rowsRequestIdRef.current) {
        setIsLoadingRows(false);
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchHistory(population);
  }, [fetchHistory, population]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Any change of population or search term restarts paging from the top. Load-more
  // is driven imperatively from its button, so paging never re-runs this effect.
  useEffect(() => {
    fetchRows(population, search, 0);
  }, [fetchRows, population, search]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchStats(), fetchHistory(population), fetchRows(population, search, 0)]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const byPop = (p: Population) => stats.find((s) => s.population === p);
  const active = byPop("active");
  const ended = byPop("ended");

  const singleSessionPct =
    ended && ended.pairs ? Math.round((ended.single_session_pairs / ended.pairs) * 100) : null;

  const chartData = useMemo(
    () =>
      history.map((point) => {
        const raw = historyMetric === "avg" ? point.avg_days : point.median_days;
        return {
          label: shortDate(point.captured_on),
          days: raw,
          pairs: point.pairs,
          // No snapshot at all, as opposed to a snapshot that found no pairings.
          missing: point.pairs === null,
        };
      }),
    [history, historyMetric],
  );

  if (isLoading) return <div>Loading pairing lengths...</div>;
  if (!stats.length) return <div>No data available</div>;

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
          {(["active", "ended", "all"] as Population[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPopulation(p)}
              className={`px-3 py-1.5 rounded-md capitalize ${
                population === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-4">
          <p className="text-xs text-slate-500 mb-1">Active pairings</p>
          <p className="text-2xl font-semibold">{active?.pairs.toLocaleString() ?? "-"}</p>
          <p className="text-xs text-slate-400 mt-1">
            Median {active ? months(active.median_days) : "-"} months
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-4">
          <p className="text-xs text-slate-500 mb-1">Ended pairings</p>
          <p className="text-2xl font-semibold">{ended?.pairs.toLocaleString() ?? "-"}</p>
          <p className="text-xs text-slate-400 mt-1">Median {ended?.median_days ?? "-"} days</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-4">
          <p className="text-xs text-slate-500 mb-1">Single-session pairings</p>
          <p className="text-2xl font-semibold">
            {ended?.single_session_pairs.toLocaleString() ?? "-"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {singleSessionPct !== null ? `${singleSessionPct}% of ended pairings` : "-"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div>
            <p className="text-sm font-medium">Length over time</p>
            <p className="text-xs text-slate-400">One point per week, {population} pairings</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
            {(
              [
                ["median", "Median"],
                ["avg", "Average"],
              ] as [HistoryMetric, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setHistoryMetric(value)}
                className={`px-3 py-1.5 rounded-md ${
                  historyMetric === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-center text-xs text-slate-400 px-4">
            No snapshots recorded yet. The first point appears after the next weekly capture, and
            the line fills in one point per week from there.
          </div>
        ) : (
          <>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={44} />
                  <Tooltip
                    formatter={(value, _name, item) => {
                      const point = item?.payload as { missing?: boolean } | undefined;
                      if (point?.missing) return ["No capture that week", "Length"];
                      return [
                        typeof value === "number"
                          ? `${value} days (${months(value)} mo)`
                          : "No pairings that week",
                        "Length",
                      ];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="days"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {chartData.length === 1 && (
              <p className="text-xs text-slate-400 mt-2">
                Only one snapshot so far, so there is no trend to read yet.
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              A break in the line means no snapshot was captured that week. Past weeks cannot be
              recovered, so a repeated gap means the weekly job needs looking at.
            </p>
            {population !== "ended" && (
              <p className="text-xs text-slate-400 mt-2">
                Active length is measured from the pairing date to today, so it climbs by seven days
                a week on its own. A dip means new pairings started or long-running ones ended.
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search a tutor or student name"
          className="w-full sm:w-80 rounded-lg border px-3 py-2 text-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-auto" style={{ maxHeight: 400 }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-4 font-medium">Tutor</th>
              <th className="py-2 pr-4 font-medium">Student</th>
              <th className="py-2 pr-4 font-medium">Started</th>
              <th className="py-2 pr-4 font-medium text-right">Length</th>
              <th className="py-2 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.tutor_name}-${r.student_name}-${r.started_on}-${i}`}
                className="border-b last:border-0"
              >
                <td className="py-2 pr-4">{r.tutor_name || "Unknown"}</td>
                <td className="py-2 pr-4">{r.student_name || "Unknown"}</td>
                <td className="py-2 pr-4 text-slate-500">
                  {new Date(`${r.started_on}T00:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="py-2 pr-4 text-right">{months(r.days)} mo</td>
                <td
                  className={`py-2 text-right capitalize ${
                    r.status === "active" ? "text-emerald-600" : "text-slate-500"
                  }`}
                >
                  {r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoadingRows && <p className="py-3 text-xs text-slate-400">Loading pairings...</p>}

        {!isLoadingRows && rows.length === 0 && (
          <p className="py-3 text-xs text-slate-400">
            {search
              ? `No matching ${population === "all" ? "" : population} pairings.${
                  population === "all" ? "" : " Past pairings are filed under All."
                }`
              : "No pairings to show."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-400">
          Showing {rows.length.toLocaleString()} {search ? "matching" : "longest"}{" "}
          {population === "all" ? "" : population} pairings
          {hasMore ? ", more available" : ""}
        </p>
        {hasMore && (
          <button
            type="button"
            onClick={() => fetchRows(population, search, nextOffset)}
            disabled={isLoadingMore}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : `Load next ${PAGE_SIZE}`}
          </button>
        )}
      </div>
    </div>
  );
};

export default PairingLengthCard;
