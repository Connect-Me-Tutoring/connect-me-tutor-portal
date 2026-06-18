"use client";

import { useState, use } from "react";
import type { FileObject } from "@supabase/storage-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase/client";

const getTags = (fileName: string): string[] => {
  const name = fileName.toLowerCase();
  const tags: string[] = [];

  if (name.includes("math")) tags.push("math");
  if (name.includes("english")) tags.push("english");
  if (name.includes("8")) tags.push("8th grade");

  return tags;
};

const WorksheetsList = ({
  worksheetsPromise,
}: {
  worksheetsPromise: Promise<FileObject[]>;
}) => {
  const worksheets = use(worksheetsPromise);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  const filteredWorksheets = worksheets.filter((file) => {
    const matchesSearch =
      !searchQuery.trim() ||
      file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === "all" || getTags(file.name).includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("worksheets")
      .download(path);
    if (error || !data) {
      console.error("Failed to download worksheet:", error);
      return;
    }
    const url = URL.createObjectURL(data);
    const download = document.createElement("a");
    download.href = url;
    download.download = path;
    download.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="space-x-2 mb-6">
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

      {filteredWorksheets.length === 0 ? (
        <p className="text-gray-600">No worksheets found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorksheets.map((file) => (
                <TableRow key={file.name}>
                  <TableCell className="font-medium">{file.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {getTags(file.name).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const { data } = supabase.storage
                            .from("worksheets")
                            .getPublicUrl(file.name);
                          window.open(data.publicUrl, "_blank");
                        }}
                      >
                        Open
                      </Button>
                      <Button size="sm" onClick={() => downloadFile(file.name)}>
                        Download
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

export default WorksheetsList;
