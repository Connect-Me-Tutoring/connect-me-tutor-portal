"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const AnalyticsDashboard = () => {
  const [mapUrl, setMapUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMap = async () => {
      try {
        const { data, error } = await supabase.storage
          .from("connect-me-data-analytics")
          .download("city_map.html");

        if (error) throw error;

        const html = await data.text();

        // Create a blob URL
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setMapUrl(url);
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
      if (mapUrl) URL.revokeObjectURL(mapUrl);
    };
  }, []);

  if (isLoading) return <div>Loading map...</div>;

  return (
    <iframe
      src={mapUrl}
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
      }}
      title="City Map"
    />
  );
};

export default AnalyticsDashboard;
