"use client";

import { useState } from "react";
import type { Profile } from "@/types";
import { deleteUser } from "@/lib/actions/auth/server.actions";
import { tutorDeletionConfirmationSchema } from "@/lib/auth/tutor-deletion";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DeleteTutorForm({
  tutors,
  onDeleted,
}: {
  tutors: Profile[];
  onDeleted: (profileId: string, email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [firstAccessFailure, setFirstAccessFailure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selected = tutors.find((tutor) => tutor.id === selectedId);
  const confirmation = tutorDeletionConfirmationSchema.safeParse({
    email,
    reason,
    recoveryAttempted,
    firstAccessFailure,
  });
  const canDelete = Boolean(
    selected?.email &&
    email.trim().toLowerCase() === selected.email.trim().toLowerCase() &&
    confirmation.success,
  );

  const resetConfirmation = () => {
    setEmail("");
    setReason("");
    setRecoveryAttempted(false);
    setFirstAccessFailure(false);
    setError("");
  };
  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    setOpen(next);
    setSelectedId("");
    resetConfirmation();
  };
  const handleDelete = async () => {
    if (!selected || !canDelete || !confirmation.success || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await deleteUser(selected.id, confirmation.data);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setSelectedId("");
      resetConfirmation();
      onDeleted(selected.id, result.email);
    } catch {
      setError("Unable to complete deletion. Refresh All Tutors before retrying or reinviting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-red-700 dark:text-red-400">
          Delete Tutor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Delete Tutor — onboarding recovery only</DialogTitle>
          <DialogDescription>
            Deactivate Tutor is the standard option for removing portal access while keeping
            tutoring records.
          </DialogDescription>
        </DialogHeader>
        <div
          className="rounded-md border border-destructive bg-destructive/5 p-4 space-y-3 text-sm"
          role="note"
        >
          <p className="font-bold text-red-700 dark:text-red-400">
            WE HIGHLY RECOMMEND DEACTIVATING TUTORS INSTEAD OF DELETING THEM.
          </p>
          <p>
            Permanent deletion should only be used as a last-resort troubleshooting measure for
            onboarding issues, specifically when a newly registered tutor is unable to access the
            portal for the first time and all standard account recovery methods have failed.
          </p>
          <p>
            Deleting a tutor may permanently remove associated records, including enrollments,
            pairings, tutoring hours, and session associations. This action cannot be undone.
          </p>
          <p>
            For tutors who have already begun tutoring or have existing activity, use Deactivate
            Tutor instead.
          </p>
        </div>
        <fieldset disabled={submitting} className="grid gap-4 min-w-0">
          <legend className="sr-only">Onboarding recovery confirmation</legend>
          <div className="space-y-2">
            <p id="delete-tutor-selector-label" className="text-sm font-medium">
              Search tutors by name or email
            </p>
            <div aria-labelledby="delete-tutor-selector-label">
              <Combobox
                key={String(open)}
                list={tutors
                  .filter((tutor) => tutor.role === "Tutor")
                  .map((tutor) => ({
                    value: tutor.id,
                    label: `${tutor.firstName} ${tutor.lastName} — ${tutor.email}`,
                  }))}
                category="tutors to delete"
                onValueChange={(id) => {
                  setSelectedId(id);
                  resetConfirmation();
                }}
              />
            </div>
            {selected && (
              <p className="text-sm break-words">
                Selected:{" "}
                <strong>
                  {selected.firstName} {selected.lastName} ({selected.email})
                </strong>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-tutor-reason">
              Onboarding issue and attempted recovery methods
            </Label>
            <Textarea
              id="delete-tutor-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={20}
              maxLength={2000}
              placeholder="Describe the first portal access failure and why the recovery attempts failed."
            />
            <p className="text-xs text-muted-foreground">
              At least 20 characters. This reason is saved in the deletion audit.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={firstAccessFailure}
              onChange={(event) => setFirstAccessFailure(event.target.checked)}
              className="mt-1"
            />
            This newly registered tutor has never successfully accessed the portal and needs a
            first-access onboarding reset.
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={recoveryAttempted}
              onChange={(event) => setRecoveryAttempted(event.target.checked)}
              className="mt-1"
            />
            I have attempted all standard account recovery methods and they have failed.
          </label>
          <div className="space-y-2">
            <Label htmlFor="delete-tutor-email">
              Type the tutor’s email address to confirm permanent deletion
            </Label>
            <Input
              id="delete-tutor-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canDelete || submitting} onClick={handleDelete}>
            {submitting ? "Deleting Tutor…" : "Permanently Delete Tutor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
