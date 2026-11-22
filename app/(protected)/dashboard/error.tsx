"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils/error";
import ReportIssueDialog from "@/components/dashboard/ReportIssueDialog";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {getErrorMessage(error, "An unexpected error occurred in the dashboard.")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" variant="outline" onClick={() => reset()}>
          Try again
        </Button>
        <Button type="button" onClick={() => router.push("/dashboard")}>
          Go home
        </Button>
        <Button type="button" variant="ghost" onClick={() => setReportOpen(true)}>
          Report an issue
        </Button>
      </div>

      <ReportIssueDialog open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
