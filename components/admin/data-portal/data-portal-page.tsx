"use client";

import { useEffect, useRef, useState } from "react";
import { getDataPortalOverview } from "@/lib/actions/data-portal/server.actions";
import { DataPortalOverview, type OverviewState } from "./data-portal-overview";
import styles from "./data-portal.module.css";

/**
 * Client half of /dashboard/data-portal: loads everything on arrival — one
 * database call through the caller's own session against the admin-gated
 * overview function — and again on range change or refresh.
 */
export function DataPortalPage() {
  const [dateRange, setDateRange] = useState("last-90-days");
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const requestSerial = useRef(0);
  const started = useRef(false);

  const load = async (range: string) => {
    const serial = ++requestSerial.current;
    setState({ status: "loading" });

    const outcome = await getDataPortalOverview(range);
    // A stale response (range changed mid-flight) must not overwrite the
    // newer request's state.
    if (serial !== requestSerial.current) return;

    setState(
      outcome.ok
        ? { status: "ready", generatedAt: outcome.generatedAt, sections: outcome.sections }
        : { status: "error", message: outcome.error },
    );
  };

  useEffect(() => {
    // Strict mode mounts effects twice in development; load once.
    if (started.current) return;
    started.current = true;
    void load("last-90-days");
  }, []);

  const handleRangeChange = (next: string) => {
    setDateRange(next);
    void load(next);
  };

  return (
    <div className="p-4 md:p-6">
      <div className={styles.root}>
        <h1 className={styles.title}>Data Portal</h1>
        <p className={styles.subtitle}>
          Read-only aggregates over Connect Me&apos;s operational data.
        </p>

        <DataPortalOverview
          state={state}
          dateRange={dateRange}
          onDateRangeChange={handleRangeChange}
          onReload={() => void load(dateRange)}
        />
      </div>
    </div>
  );
}
