import { Suspense } from "react";
import WorksheetsList from "@/components/tutor/WorksheetsList";
import { WorksheetsTableSkeleton } from "@/components/tutor/WorksheetsTableSkeleton";
import { createClient } from "@/lib/supabase/server";

const Worksheets = async () => {
  const supabase = await createClient();

  const worksheetsPromise = supabase.storage
    .from("worksheets")
    .list("")
    .then(({ data, error }) => {
      if (error) {
        console.error("Failed to load worksheets:", error);
        return [];
      }
      return (data ?? []).filter(
        (file) => file.id !== null && file.name !== ".emptyFolderPlaceholder",
      );
    });

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Worksheets</h1>
      <Suspense fallback={<WorksheetsTableSkeleton />}>
        <WorksheetsList worksheetsPromise={worksheetsPromise} />
      </Suspense>
    </main>
  );
};

export default Worksheets;
