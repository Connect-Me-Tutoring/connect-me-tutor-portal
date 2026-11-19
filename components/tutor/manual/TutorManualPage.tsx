"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TutorManual } from "@/constants/tutor-manual";
import { EASTERN_TIMEZONE } from "@/lib/utils/timezone";

import TutorManualEditor from "./TutorManualEditor";
import TutorManualView from "./TutorManualView";

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: EASTERN_TIMEZONE,
  });
}

/** Everyone sees the manual; admins also get an Edit button that swaps in the editor. */
export default function TutorManualPage({
  initialManual,
  canEdit,
}: {
  initialManual: TutorManual;
  canEdit: boolean;
}) {
  const [manual, setManual] = useState(initialManual);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-connect-me-blue-4">Tutor Portal Manual</h1>
          {manual.updatedAt ? (
            <p className="text-sm text-connect-me-gray-1">
              Last updated {formatUpdatedAt(manual.updatedAt)}
              {canEdit && manual.updatedByName ? ` by ${manual.updatedByName}` : ""}
            </p>
          ) : (
            canEdit && (
              <p className="text-sm text-connect-me-gray-1">
                Showing the built-in default. Your first save becomes the live version.
              </p>
            )
          )}
        </div>
        {canEdit && !isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit manual
          </Button>
        )}
      </header>

      {canEdit && isEditing ? (
        <TutorManualEditor
          sections={manual.sections}
          onCancel={() => setIsEditing(false)}
          onSaved={(saved) => {
            setManual(saved);
            setIsEditing(false);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <TutorManualView sections={manual.sections} />
      )}
    </div>
  );
}
