"use client";

import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { getUserGrowthMetrics, TimeInterval } from "@/lib/actions/analytics/userMetrics";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function UserGrowthChart() {
  const [range, setRange] = useState<TimeInterval>("30d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await getUserGrowthMetrics(range);
      if (res.error) {
        setErr(res.error);
      } else {
        setData(res.data);
        setErr(null);
      }
      setLoading(false);
    }
    fetchData();
  }, [range]);

  const chartData = {
    labels: data?.labels || [],
    datasets: [
      {
        label: "Tutors Added",
        data: data?.tutorsAdded || [],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        tension: 0.2,
      },
      {
        label: "Students Added",
        data: data?.studentsAdded || [],
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.5)",
        tension: 0.2,
      },
      {
        label: "Students Removed",
        data: data?.studentsRemoved || [],
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.5)",
        tension: 0.2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setRange("7d")}
            className={`px-3 py-1.5 rounded-md ${range === "7d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Past Week
          </button>
          <button
            onClick={() => setRange("30d")}
            className={`px-3 py-1.5 rounded-md ${range === "30d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            Past Month
          </button>
          <button
            onClick={() => setRange("90d")}
            className={`px-3 py-1.5 rounded-md ${range === "90d" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            3 Months
          </button>
          <button
            onClick={() => setRange("1y")}
            className={`px-3 py-1.5 rounded-md ${range === "1y" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            1 Year
          </button>
          <button
            onClick={() => setRange("all")}
            className={`px-3 py-1.5 rounded-md ${range === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
          >
            All Time
          </button>
        </div>

        {data?.summary && (
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="text-blue-600">+{data.summary.totalTutorsAdded} Tutors</span>
            <span className="text-emerald-600">+{data.summary.totalStudentsAdded} Students</span>
            <span className="text-rose-600">-{data.summary.totalStudentsRemoved} Removed</span>
          </div>
        )}
      </div>

      <div className="h-64 w-full relative flex items-center justify-center">
        {loading ? (
          <div className="text-sm text-slate-400">Loading chart...</div>
        ) : err ? (
          <div className="text-sm text-rose-500">{err}</div>
        ) : !data?.labels?.length ? (
          <div className="text-sm text-slate-400">No data available</div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
}
