import WorksheetsList from "@/components/tutor/WorksheetsList";
import { createClient } from "@/lib/supabase/server";
import type { FileObject } from "@supabase/storage-js";

export type WorksheetResource = {
  name: string;
  path: string;
  collection: string;
  updatedAt: string | null;
  size: number | null;
};

const isWorksheetFile = (file: FileObject) =>
  file.name.toLowerCase().endsWith(".pdf");

const isHiddenStorageItem = (file: FileObject) =>
  file.name === ".emptyFolderPlaceholder";

const Worksheets = async () => {
  const supabase = await createClient();

  const listWorksheets = async (
    prefix = "",
    depth = 0,
  ): Promise<WorksheetResource[]> => {
    const { data, error } = await supabase.storage
      .from("worksheets")
      .list(prefix, {
        limit: 200,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        console.error("Failed to load worksheets:", error);
        return [];
      }

    const resources = await Promise.all(
      (data ?? []).filter((file) => !isHiddenStorageItem(file)).map((file) => {
        const path = prefix ? `${prefix}/${file.name}` : file.name;

        if (isWorksheetFile(file)) {
          const [collection = "Ungrouped"] = path.split("/");

          return Promise.resolve([
            {
              name: file.name,
              path,
              collection:
                collection === file.name ? "Ungrouped" : collection,
              updatedAt: file.updated_at ?? file.created_at ?? null,
              size:
                typeof file.metadata?.size === "number"
                  ? file.metadata.size
                  : null,
            },
          ]);
        }

        if (depth >= 3) return Promise.resolve([]);
        return listWorksheets(path, depth + 1);
      }),
    );

    return resources.flat();
  };

  const worksheets = await listWorksheets();

  return (
    <main className="min-h-screen bg-[#f7f4ec] px-4 py-6 text-[#211f1c] sm:px-6 lg:px-8">
      <WorksheetsList worksheets={worksheets} />
    </main>
  );
};

export default Worksheets;
