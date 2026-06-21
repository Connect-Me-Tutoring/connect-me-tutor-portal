"use client";

import { useMemo, useState } from "react";
import type { WorksheetResource } from "@/app/(protected)/dashboard/(tutor)/worksheets/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowUpRight,
  BookOpenCheck,
  Download,
  FileText,
  FolderOpen,
  LibraryBig,
  Search,
} from "lucide-react";

const gradeOrder = [
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "Algebra 1",
  "Ungrouped",
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

    for (const worksheet of worksheets) {
      counts.set(
        worksheet.collection,
        (counts.get(worksheet.collection) ?? 0) + 1,
      );
    }

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
        return collectionSort || cleanTitle(a.name).localeCompare(cleanTitle(b.name));
      });
  }, [activeCollection, searchQuery, worksheets]);

  const selectedCollection =
    activeCollection === "All"
      ? "All worksheet folders"
      : activeCollection;

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
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="border-b border-[#d8d0bf] pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-[#766d5b]">
              <LibraryBig className="h-4 w-4" />
              Resource shelf
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-[#211f1c] sm:text-4xl">
              Worksheets
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#6b6253]">
              Browse worksheets by grade folder, search by topic, then open or
              download the PDF without digging through one long file list.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:flex">
            <div className="border-l border-[#cfc6b4] px-4">
              <div className="text-2xl font-semibold text-[#211f1c]">
                {worksheets.length}
              </div>
              <div className="text-[#766d5b]">PDFs</div>
            </div>
            <div className="border-l border-[#cfc6b4] px-4">
              <div className="text-2xl font-semibold text-[#211f1c]">
                {collections.length}
              </div>
              <div className="text-[#766d5b]">Folders</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="border-y border-[#d8d0bf] py-3">
            <button
              type="button"
              onClick={() => setActiveCollection("All")}
              className={`flex w-full items-center justify-between px-1 py-3 text-left text-sm transition-colors ${
                activeCollection === "All"
                  ? "text-[#211f1c]"
                  : "text-[#766d5b] hover:text-[#211f1c]"
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4" />
                All folders
              </span>
              <span>{worksheets.length}</span>
            </button>
            {collections.map((collection) => (
              <button
                key={collection.name}
                type="button"
                onClick={() => setActiveCollection(collection.name)}
                className={`flex w-full items-center justify-between border-t border-[#e3dac8] px-1 py-3 text-left text-sm transition-colors ${
                  activeCollection === collection.name
                    ? "text-[#211f1c]"
                    : "text-[#766d5b] hover:text-[#211f1c]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </span>
                <span>{collection.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-b border-[#d8d0bf] pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.16em] text-[#8a806c]">
                {selectedCollection}
              </div>
              <div className="mt-1 text-lg font-medium text-[#211f1c]">
                {filteredWorksheets.length} worksheets
              </div>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a806c]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by topic or grade"
                className="h-11 rounded-none border-[#cfc6b4] bg-[#fffdf8] pl-9 text-[#211f1c] placeholder:text-[#8a806c] focus-visible:ring-[#8d7b5d]"
              />
            </div>
          </div>

          {filteredWorksheets.length === 0 ? (
            <div className="border-y border-[#d8d0bf] py-14 text-center">
              <FileText className="mx-auto mb-4 h-8 w-8 text-[#8a806c]" />
              <h2 className="text-lg font-medium text-[#211f1c]">
                No worksheets found
              </h2>
              <p className="mt-2 text-sm text-[#766d5b]">
                Try another folder or search term.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#d8d0bf] border-y border-[#d8d0bf]">
              {filteredWorksheets.map((worksheet) => (
                <article
                  key={worksheet.path}
                  className="grid gap-4 py-4 transition-colors hover:bg-[#fffaf0] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0 px-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="rounded-none border-[#c5b99f] bg-transparent text-[#5f5647] hover:bg-transparent">
                        {worksheet.collection}
                      </Badge>
                      <span className="text-xs text-[#8a806c]">
                        {formatSize(worksheet.size)}
                      </span>
                      <span className="text-xs text-[#8a806c]">
                        {formatDate(worksheet.updatedAt)}
                      </span>
                    </div>
                    <h2 className="truncate text-base font-medium text-[#211f1c] sm:text-lg">
                      {cleanTitle(worksheet.name)}
                    </h2>
                    <p className="mt-1 truncate text-sm text-[#766d5b]">
                      {worksheet.path}
                    </p>
                  </div>
                  <div className="flex gap-2 px-1 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openWorksheet(worksheet.path)}
                      className="rounded-none border-[#bfb49d] bg-[#fffdf8] text-[#211f1c] hover:bg-[#efe7d7]"
                    >
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => downloadWorksheet(worksheet)}
                      className="rounded-none bg-[#2b2924] text-[#fffaf0] hover:bg-[#464135]"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
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
