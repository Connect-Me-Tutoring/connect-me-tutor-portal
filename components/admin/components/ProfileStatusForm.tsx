import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Profile } from "@/types";

type Mode = "deactivate" | "reactivate";

interface ProfileStatusFormProps {
  profiles: Profile[];
  roleLabel: "Tutor" | "Student";
  mode: Mode;
  onConfirm: (profileId: string) => Promise<void>;
}

const COPY: Record<Mode, { verb: string; description: string; showStatus: Profile["status"] }> = {
  deactivate: {
    verb: "Deactivate",
    description:
      "Marks them Inactive, pauses their enrollments, removes them from the pairing queue, and hands their pending matches to someone else. Their sessions, enrollments, and hours are kept, and they can be reactivated later.",
    showStatus: "Active",
  },
  reactivate: {
    verb: "Reactivate",
    description:
      "Marks them Active again. Their enrollments stay paused and they aren't put back in the pairing queue. Resume those from the Enrollments and Pairing Queue pages.",
    showStatus: "Inactive",
  },
};

const ProfileStatusForm = ({ profiles, roleLabel, mode, onConfirm }: ProfileStatusFormProps) => {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { verb, description, showStatus } = COPY[mode];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSelectedId(null);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedId);
      handleOpenChange(false);
    } catch {
      // The page handler already showed the error toast and rethrew so the
      // dialog stays open for a retry. Swallow here so it doesn't surface as
      // an unhandled promise rejection.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className={mode === "deactivate" ? "bg-connect-me-blue-3" : undefined}
          variant={mode === "reactivate" ? "outline" : undefined}
        >
          {verb} {roleLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Select a {roleLabel} to {verb.toLowerCase()}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor={`${mode}-${roleLabel}-select`}>{roleLabel}</Label>
          <Combobox
            // Remount on open so a previous selection doesn't linger in the input.
            key={String(open)}
            list={profiles
              .filter((p) => p.status === showStatus)
              .map((p) => ({
                value: p.id,
                label: `${p.firstName} ${p.lastName} - ${p.email}`,
              }))}
            category={roleLabel.toLowerCase()}
            onValueChange={setSelectedId}
          />
        </div>
        <Button onClick={handleConfirm} disabled={!selectedId || submitting} className="w-full">
          {submitting ? `${verb.replace(/e$/, "")}ing...` : `Confirm ${verb.toLowerCase()}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileStatusForm;
