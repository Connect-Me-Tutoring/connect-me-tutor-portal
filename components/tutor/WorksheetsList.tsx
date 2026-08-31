"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { WorksheetResource } from "@/app/(protected)/dashboard/(tutor)/worksheets/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { ChevronLeft, Download, ExternalLink, FileText, FolderOpen, Search } from "lucide-react";

const allCategories = "All categories";
const allCollections = "All grades";

const submitWorksheetFormUrl = "https://forms.gle/yXht2JBQ7dBiKpZr6";

const gradeOrder = [
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "Algebra 1",
];

const cleanTitle = (name: string) =>
  name
    .replace(/\.(pdf|docx?)$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^[A-Za-z]+(_Grade)? - /, "")
    .replace(/\s+/g, " ")
    .trim();

const getCollectionSortIndex = (collection: string) => {
  const index = gradeOrder.indexOf(collection);
  return index === -1 ? gradeOrder.length : index;
};

const PickerScreen = ({
  title,
  options,
  onSelect,
  onBack,
  action,
}: {
  title: string;
  options: { name: string; count: number }[];
  onSelect: (name: string) => void;
  onBack?: () => void;
  action?: ReactNode;
}) => (
  <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-col gap-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-base text-gray-500 transition-colors hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {action}
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.name}
          type="button"
          onClick={() => onSelect(option.name)}
          className="flex items-center justify-between gap-3 rounded-lg border bg-white p-5 text-left transition-colors hover:border-gray-900 hover:bg-gray-50"
        >
          <span className="flex min-w-0 items-center gap-3">
            <FolderOpen className="h-6 w-6 shrink-0 text-gray-500" />
            <span className="truncate text-lg font-medium text-gray-900">{option.name}</span>
          </span>
          <span className="shrink-0 text-base text-gray-500">{option.count}</span>
        </button>
      ))}
    </div>
  </section>
);

const WorksheetsList = ({ worksheets }: { worksheets: WorksheetResource[] }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    worksheets.forEach((worksheet) => {
      counts.set(worksheet.category, (counts.get(worksheet.category) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [worksheets]);

  const categoryWorksheets = useMemo(
    () =>
      worksheets.filter(
        (worksheet) => activeCategory === allCategories || worksheet.category === activeCategory,
      ),
    [activeCategory, worksheets],
  );

  const collections = useMemo(() => {
    const counts = new Map<string, number>();

    categoryWorksheets.forEach((worksheet) => {
      counts.set(worksheet.collection, (counts.get(worksheet.collection) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const gradeSort = getCollectionSortIndex(a.name) - getCollectionSortIndex(b.name);
        return gradeSort || a.name.localeCompare(b.name);
      });
  }, [categoryWorksheets]);

  const filteredWorksheets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return worksheets
      .filter((worksheet) => {
        const matchesCategory =
          activeCategory === allCategories || worksheet.category === activeCategory;
        const matchesCollection =
          activeCollection === allCollections || worksheet.collection === activeCollection;
        const matchesSearch =
          !query ||
          worksheet.name.toLowerCase().includes(query) ||
          worksheet.category.toLowerCase().includes(query) ||
          worksheet.collection.toLowerCase().includes(query);

        return matchesCategory && matchesCollection && matchesSearch;
      })
      .sort((a, b) => {
        const collectionSort =
          getCollectionSortIndex(a.collection) - getCollectionSortIndex(b.collection);
        return collectionSort || cleanTitle(a.name).localeCompare(cleanTitle(b.name));
      });
  }, [activeCategory, activeCollection, searchQuery, worksheets]);

  const openWorksheet = (path: string) => {
    const { data } = supabase.storage.from("worksheets").getPublicUrl(path);
    window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  };

  const downloadWorksheet = async (worksheet: WorksheetResource) => {
    const { data, error } = await supabase.storage.from("worksheets").download(worksheet.path);

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

  // Step through subject then grade on the way in; the sidebar takes over once a grade is picked.
  if (!activeCategory) {
    return (
      <PickerScreen
        title="Worksheets"
        options={categories}
        onSelect={setActiveCategory}
        action={
          <Button asChild variant="outline" className="h-11 w-fit justify-center gap-2 text-base">
            <a href={submitWorksheetFormUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-5 w-5" />
              Submit your worksheet
            </a>
          </Button>
        }
      />
    );
  }

  if (!activeCollection) {
    return (
      <PickerScreen
        title={activeCategory}
        options={[{ name: allCollections, count: categoryWorksheets.length }, ...collections]}
        onSelect={setActiveCollection}
        onBack={() => setActiveCategory(null)}
      />
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Worksheets</h1>
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search worksheets"
            className="h-12 bg-white pl-12 text-base"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveCategory(allCategories);
            setActiveCollection(allCollections);
          }}
          className={`rounded-md border px-4 py-2 text-base transition-colors ${
            activeCategory === allCategories
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.name}
            type="button"
            onClick={() => {
              setActiveCategory(category.name);
              setActiveCollection(allCollections);
            }}
            className={`rounded-md border px-4 py-2 text-base transition-colors ${
              activeCategory === category.name
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-lg border bg-white p-3 lg:sticky lg:top-6 lg:self-start">
          <button
            type="button"
            onClick={() => setActiveCollection(allCollections)}
            className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left text-base transition-colors ${
              activeCollection === allCollections
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span>{allCollections}</span>
            <span className="text-xs opacity-75">{categoryWorksheets.length}</span>
          </button>

          <div className="mt-2 space-y-1">
            {collections.map((collection) => (
              <button
                key={collection.name}
                type="button"
                onClick={() => setActiveCollection(collection.name)}
                className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left text-base transition-colors ${
                  activeCollection === collection.name
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderOpen className="h-5 w-5 shrink-0" />
                  <span className="truncate">{collection.name}</span>
                </span>
                <span className="text-xs opacity-75">{collection.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="text-base font-medium text-gray-900">
              {activeCollection === allCollections ? "All worksheets" : activeCollection}
            </div>
            <div className="text-base text-gray-500">{filteredWorksheets.length} shown</div>
          </div>

          {filteredWorksheets.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <FileText className="mx-auto mb-3 h-9 w-9 text-gray-400" />
              <h2 className="text-lg font-medium text-gray-900">No worksheets found</h2>
              <p className="mt-1 text-base text-gray-500">Try another folder or search term.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredWorksheets.map((worksheet) => (
                <article
                  key={worksheet.path}
                  className="grid gap-4 p-4 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => openWorksheet(worksheet.path)}
                    className="min-w-0 rounded-md px-3 py-3 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 rounded-md border bg-gray-50 p-2.5 text-gray-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-medium text-gray-900">
                          {cleanTitle(worksheet.name)}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-base text-gray-500">
                          <span>{worksheet.category}</span>
                          <span>{worksheet.collection}</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openWorksheet(worksheet.path)}
                      className="h-11 justify-center gap-2 text-base sm:w-28"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => downloadWorksheet(worksheet)}
                      className="h-11 justify-center gap-2 text-base sm:w-36"
                    >
                      <Download className="h-5 w-5" />
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
