import WorksheetsList from "@/components/tutor/WorksheetsList";
import { createClient } from "@/lib/supabase/server";
import type { FileObject } from "@supabase/storage-js";
import { logError } from "@/lib/posthog";

export type WorksheetResource = {
  name: string;
  path: string;
  category: string;
  collection: string;
  updatedAt: string | null;
  size: number | null;
};

const gradeFolders = new Set([
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "Algebra 1",
]);

// Reading worksheets keep their grade in the file name ("Fifth_Grade - Wonder Worksheet.docx")
// rather than in a subfolder, so map that prefix onto the same labels the grade folders use.
const fileNameGrades: Record<string, string> = {
  kindergarten: "Kindergarten",
  first: "1st Grade",
  second: "2nd Grade",
  third: "3rd Grade",
  fourth: "4th Grade",
  fifth: "5th Grade",
  sixth: "6th Grade",
  seventh: "7th Grade",
  eighth: "8th Grade",
};

const gradeFromFileName = (name: string) =>
  fileNameGrades[
    name
      .split(" - ")[0]
      .replace(/_grade$/i, "")
      .trim()
      .toLowerCase()
  ];

const isWorksheetFile = (file: FileObject) => /\.(pdf|docx?)$/i.test(file.name);

const isHiddenStorageItem = (file: FileObject) => file.name === ".emptyFolderPlaceholder";

const pageSize = 100;

const Worksheets = async () => {
  const supabase = await createClient();

  // Storage caps each list call, so page through a folder until it runs out of entries.
  const listFolder = async (prefix: string): Promise<FileObject[] | null> => {
    const files: FileObject[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.storage.from("worksheets").list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        console.error("Failed to load worksheets:", error);
        await logError(error, { prefix }, "worksheets_load_error");
        return null;
      }

      files.push(...(data ?? []));

      if ((data?.length ?? 0) < pageSize) return files;
    }
  };

  const listWorksheets = async (prefix = "", depth = 0): Promise<WorksheetResource[]> => {
    const data = await listFolder(prefix);

    if (!data) return [];

    const resources = await Promise.all(
      (data ?? [])
        .filter((file) => !isHiddenStorageItem(file))
        .map((file) => {
          const path = prefix ? `${prefix}/${file.name}` : file.name;

          if (isWorksheetFile(file)) {
            const [firstFolder = "", secondFolder = ""] = path.split("/");

            if (firstFolder === file.name) return Promise.resolve([]);

            const isGradeFirst = gradeFolders.has(firstFolder);
            const category = isGradeFirst ? "Math" : firstFolder;
            const collection = isGradeFirst
              ? firstFolder
              : gradeFolders.has(secondFolder)
                ? secondFolder
                : (gradeFromFileName(file.name) ?? firstFolder);

            return Promise.resolve([
              {
                name: file.name,
                path,
                category,
                collection,
                updatedAt: file.updated_at ?? file.created_at ?? null,
                size: typeof file.metadata?.size === "number" ? file.metadata.size : null,
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
    <main className="min-h-screen bg-gray-50 p-5 text-gray-900 md:p-8">
      <WorksheetsList worksheets={worksheets} />
    </main>
  );
};

export default Worksheets;
