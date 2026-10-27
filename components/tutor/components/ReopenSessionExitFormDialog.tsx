"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatSessionDate } from "@/lib/utils";
import { requestSessionExitFormReopen } from "@/lib/actions/ticket/server.actions";
import { Session } from "@/types";

interface ReopenSessionExitFormDialogProps {
  session: Session | null;
  onOpenChange: (open: boolean) => void;
}

/** Lets a tutor ask operations to reopen the Session Exit Form of an Unconfirmed session. */
export default function ReopenSessionExitFormDialog({
  session,
  onOpenChange,
}: ReopenSessionExitFormDialogProps) {
  const pathname = usePathname();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Reset each time the dialog opens for a session.
  useEffect(() => {
    if (session) {
      setReason("");
      setSubmittedTicketId(null);
    }
  }, [session]);

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const result = await requestSessionExitFormReopen(session.id, reason, pathname);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubmittedTicketId(result.ticketId);
    } catch (error) {
      console.error("Unable to request Session Exit Form reopen", error);
      toast.error("We couldn't submit your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const studentName = `${session?.student?.firstName ?? ""} ${session?.student?.lastName ?? ""}`;

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {submittedTicketId ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <DialogTitle>Request submitted</DialogTitle>
            <DialogDescription>
              Our team will review your request and email you once the Session Exit Form has been
              reopened.
              <br />
              <span className="text-xs">Reference: {submittedTicketId.slice(0, 8)}</span>
            </DialogDescription>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request to Reopen Session Exit Form</DialogTitle>
              <DialogDescription>
                This session was marked Unconfirmed because its Session Exit Form wasn&apos;t
                submitted in time. Tell us what happened and we&apos;ll open a ticket to reopen the
                form.
              </DialogDescription>
            </DialogHeader>

            {session && (
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <div className="font-medium">Tutoring Session with {studentName.trim()}</div>
                <div className="text-muted-foreground">{formatSessionDate(session.date)}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reopen-sef-reason">Reason</Label>
              <Textarea
                id="reopen-sef-reason"
                placeholder="e.g. The session happened but I forgot to submit the form before the deadline."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || reason.trim().length < 10}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
