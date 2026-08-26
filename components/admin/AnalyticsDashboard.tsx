"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import AnalyticsCard from "@/components/analytics/AnalyticsCard";
import UserGrowthChart from "@/components/analytics/UserGrowthChart";
import SessionCompletionChart from "@/components/analytics/SessionCompletionChart";

const AnalyticsDashboard = () => {
  const [mapUrl, setMapUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let blobUrl: string | null = null;

    const fetchMap = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("connect-me-data-analytics")
          .download("city_map.html");

        if (error) throw error;

        const html = await data.text();

        // Create a blob URL
        const blob = new Blob([html], { type: "text/html" });
        blobUrl = URL.createObjectURL(blob);
        setMapUrl(blobUrl);
      } catch (error) {
        console.error(error);
        toast.error("Unable to fetch city map of applicants");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMap();

    // Cleanup
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, []);

  if (isLoading) return <div>Loading map...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <AnalyticsCard
          title="User Growth Metrics"
          subtitle="Tutors added and students added / removed over given intervals"
        >
          <UserGrowthChart />
        </AnalyticsCard>
      </div>

      {/* <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-6">
        <AnalyticsCard
          title="Tutor Attendance (preview)"
          subtitle="Placeholder"
          className="border-black"
        >
          <div className="h-24 w-full flex items-center justify-center text-slate-400">
            Placeholder chart
          </div>
        </AnalyticsCard>

        <AnalyticsCard title="Cancellation Reasons (preview)" subtitle="Placeholder">
          <div className="h-24 w-full flex items-center justify-center text-slate-400">
            Placeholder chart
          </div>
        </AnalyticsCard>
      </div> */}

      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="h-[60vh] md:h-[70vh] w-full">
          <iframe
            src={mapUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            title="City Map"
          />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
