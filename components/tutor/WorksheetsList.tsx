"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface WorksheetFile {
  name: string;
}

const WorksheetsList = () => {
  const [worksheets, setWorksheets] = useState<WorksheetFile[]>([]);
  const [filteredWorksheets, setFilteredWorksheets] = useState<WorksheetFile[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const { data, error } = await supabase.storage.from("worksheets").list("");

    if (error) {
      toast.error("Failed to load worksheets");
      return;
    }

    setWorksheets((data ?? []).filter((file): file is WorksheetFile => !!file.name));
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    let results = worksheets;
    const query = searchQuery.toLowerCase();

    if (query.trim()) {
      results = results.filter((file) => file.name.toLowerCase().includes(query));
    }

    if (selectedTag !== "all") {
      results = results.filter((file) =>
        getTags(file.name).includes(selectedTag),
      );
    }

    setFilteredWorksheets(results);
  }, [searchQuery, selectedTag, worksheets]);

  const getTags = (fileName: string): string[] => {
    const name = fileName.toLowerCase();
    const tags: string[] = [];

    if (name.includes("math")) tags.push("math");
    if (name.includes("english")) tags.push("english");
    if (name.includes("8")) tags.push("8th grade");

    return tags;
  };

  const getPublicWorksheetUrl = (path: string) => {
    const { data } = supabase.storage.from("worksheets").getPublicUrl(path);
    return data.publicUrl;
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("worksheets").download(path);

    if (error || !data) {
      toast.error("Failed to download worksheet");
      return;
    }

    const url = URL.createObjectURL(data);
    const download = document.createElement("a");
    download.href = url;
    download.download = path;
    download.click();
    URL.revokeObjectURL(url);
  };

  const shareFile = async (path: string) => {
    const publicUrl = getPublicWorksheetUrl(path);

    if (!publicUrl) {
      toast.error("Unable to generate worksheet link");
      return;
    }

    if (!navigator.clipboard) {
      toast.error("Clipboard is not supported in this browser");
      return;
    }

    navigator.clipboard
      .writeText(publicUrl)
      .then(() => toast.success("Worksheet link copied!"))
      .catch(() => toast.error("Failed to copy worksheet link"));
  };

  const uploadFile = async () => {
    const file = uploadInputRef.current?.files?.[0];

    if (!file) {
      toast.error("Select a worksheet to post");
      return;
    }

    setIsUploading(true);

    const sanitizedFileName = file.name.replace(/\s+/g, "-");
    const filePath = `${Date.now()}-${sanitizedFileName}`;
    const { error } = await supabase.storage
      .from("worksheets")
      .upload(filePath, file, { upsert: false });

    if (error) {
      toast.error("Failed to post worksheet");
      setIsUploading(false);
      return;
    }

    toast.success("Worksheet posted");
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
    await fetchFiles();
    setIsUploading(false);
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Worksheets</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <input
          ref={uploadInputRef}
          aria-label="Upload worksheet"
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <Button type="button" onClick={uploadFile} disabled={isUploading}>
          {isUploading ? "Posting..." : "Post Worksheet"}
        </Button>
      </div>

      <div className="space-y-2 mb-6">
        <input
          type="text"
          placeholder="Search Worksheets"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All</option>
          <option value="math">Math</option>
          <option value="english">English</option>
          <option value="8th grade">8th Grade</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-6">
        {filteredWorksheets.map((file) => (
          <Card
            key={file.name}
            className="w-80 transition-shadow hover:shadow-md"
          >
            <CardHeader className="pb-6">
              <CardTitle className="text-lg font-semibold text-center">
                {file.name}
              </CardTitle>
              <div className="flex flex-wrap justify-center gap-2 mt-2 text-sm text-gray-600">
                {getTags(file.name).map((tag) => (
                  <span key={tag} className="bg-gray-100 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </CardHeader>

            <CardFooter>
              <div className="flex gap-3 w-full">
                <Button
                  className="w-1/3"
                  onClick={() => {
                    const publicUrl = getPublicWorksheetUrl(file.name);
                    if (!publicUrl) {
                      toast.error("Unable to open worksheet");
                      return;
                    }
                    window.open(publicUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open
                </Button>
                <Button
                  className="w-1/3"
                  onClick={() => downloadFile(file.name)}
                >
                  Download
                </Button>
                <Button className="w-1/3" onClick={() => shareFile(file.name)}>
                  Share
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default WorksheetsList;
