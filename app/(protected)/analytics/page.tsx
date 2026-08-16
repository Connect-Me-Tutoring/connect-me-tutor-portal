import React from "react";
import AnalyticsCard from "@/components/analytics/AnalyticsCard";

export default function AnalyticsPage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-slate-600 mt-1">Tutor Portal analytics and realtime charts.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard title="Tutor Attendance" subtitle="Attendance over time for tutors" className="border-black">
          <div className="h-48 w-full flex items-center justify-center text-slate-400">Chart placeholder</div>
        </AnalyticsCard>

        <AnalyticsCard title="Student Attendance" subtitle="Attendance over time for students" className="border-black">
          <div className="h-48 w-full flex items-center justify-center text-slate-400">Chart placeholder</div>
        </AnalyticsCard>

        <AnalyticsCard title="Reasons for Cancellation" subtitle="Top cancellation reasons">
          <div className="h-48 w-full flex items-center justify-center text-slate-400">Chart placeholder</div>
        </AnalyticsCard>

        <AnalyticsCard title="Quick Stats" subtitle="Snapshot metrics">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded bg-slate-50 p-3 text-center">Total Sessions<br/><span className="text-lg font-bold">—</span></div>
            <div className="rounded bg-slate-50 p-3 text-center">Cancellations<br/><span className="text-lg font-bold">—</span></div>
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Realtime Feed" subtitle="Incoming events">
          <div className="h-48 w-full overflow-auto text-sm text-slate-500 p-2">No events yet</div>
        </AnalyticsCard>
      </div>
    </main>
  );
}
