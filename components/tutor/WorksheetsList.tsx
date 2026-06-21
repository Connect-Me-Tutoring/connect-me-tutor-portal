"use client";

import { useMemo, useState } from "react";
import type { WorksheetResource } from "@/app/(protected)/dashboard/(tutor)/worksheets/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { Download, FileText, FolderOpen, Search } from "lucide-react";

const gradeOrder = [
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "Algebra 1",
];

const cleanTitle = (name: string) =>
  name
    .replace(/\.pdf$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const formatSize = (size: number | null) => {
  if (!size) return "PDF";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (date: string | null) => {
  if (!date) return "Recently added";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
};

const getCollectionSortIndex = (collection: string) => {
  const index = gradeOrder.indexOf(collection);
  return index === -1 ? gradeOrder.length : index;
};

const WorksheetsList = ({ worksheets }: { worksheets: WorksheetResource[] }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCollection, setActiveCollection] = useState("All");

  const collections = useMemo(() => {
    const counts = new Map<string, number>();

    worksheets.forEach((worksheet) => {
      counts.set(
        worksheet.collection,
        (counts.get(worksheet.collection) ?? 0) + 1,
      );
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const gradeSort =
          getCollectionSortIndex(a.name) - getCollectionSortIndex(b.name);
        return gradeSort || a.name.localeCompare(b.name);
      });
  }, [worksheets]);

  const filteredWorksheets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return worksheets
      .filter((worksheet) => {
        const matchesCollection =
          activeCollection === "All" ||
          worksheet.collection === activeCollection;
        const matchesSearch =
          !query ||
          worksheet.name.toLowerCase().includes(query) ||
          worksheet.collection.toLowerCase().includes(query);

        return matchesCollection && matchesSearch;
      })
      .sort((a, b) => {
        const collectionSort =
          getCollectionSortIndex(a.collection) -
          getCollectionSortIndex(b.collection);
        return (
          collectionSort || cleanTitle(a.name).localeCompare(cleanTitle(b.name))
        );
      });
  }, [activeCollection, searchQuery, worksheets]);

  const openWorksheet = (path: string) => {
    const { data } = supabase.storage.from("worksheets").getPublicUrl(path);
    window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  };

  const downloadWorksheet = async (worksheet: WorksheetResource) => {
    const { data, error } = await supabase.storage
      .from("worksheets")
      .download(worksheet.path);

    if (error || !data) {
      console.error("Failed to download worksheet:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const download = document.createElement("a");
    download.href = url;
    download.download = worksheet.name;
    download.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Worksheets
        </h1>
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search worksheets"
            className="h-10 bg-white pl-9"
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-white p-2 lg:sticky lg:top-6 lg:self-start">
          <button
            type="button"
            onClick={() => setActiveCollection("All")}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
              activeCollection === "All"
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span>All folders</span>
            <span className="text-xs opacity-75">{worksheets.length}</span>
          </button>

          <div className="mt-1 space-y-1">
            {collections.map((collection) => (
              <button
                key={collection.name}
                type="button"
                onClick={() => setActiveCollection(collection.name)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  activeCollection === collection.name
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </span>
                <span className="text-xs opacity-75">{collection.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-medium text-gray-900">
              {activeCollection === "All" ? "All worksheets" : activeCollection}
            </div>
            <div className="text-sm text-gray-500">
              {filteredWorksheets.length} shown
            </div>
          </div>

          {filteredWorksheets.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-gray-400" />
              <h2 className="text-base font-medium text-gray-900">
                No worksheets found
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Try another folder or search term.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredWorksheets.map((worksheet) => (
                <article
                  key={worksheet.path}
                  className="grid gap-3 p-3 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => openWorksheet(worksheet.path)}
                    className="min-w-0 rounded-md px-3 py-2 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 rounded-md border bg-gray-50 p-2 text-gray-500">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-medium text-gray-900">
                          {cleanTitle(worksheet.name)}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                          <span>{worksheet.collection}</span>
                          <span>{formatSize(worksheet.size)}</span>
                          <span>{formatDate(worksheet.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadWorksheet(worksheet)}
                    className="h-10 justify-center gap-2 sm:w-32"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default WorksheetsList;
