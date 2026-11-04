import React, { useState } from "react";
import { Loader2, UserRoundCheck, UserRoundPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  requestSubstitute,
  undoSubstituteRequest,
  type SubstituteRequestResult,
} from "@/lib/actions/tutor/actions";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { openSubstituteRequestForm, SUBSTITUTE_REQUEST_FORM_URL } from "@/lib/session-substitute";
import { formatSessionDate } from "@/lib/utils";
import type { Session } from "@/types";

interface RequestSubstituteDialogProps {
  session: Session;
  isDropdownItem?: boolean;
}

const failureMessage = (result: Extract<SubstituteRequestResult, { ok: false }>, action: string) =>
  result.reason === "not_allowed"
    ? `This session can't be ${action} anymore. Refresh the page to see its current status.`
    : `Couldn't update this session. Please try again.`;

/**
 * Request Substitute action for a tutor's session. Confirming marks the session Sub Requested
 * (no hours, no exit form) and opens the substitute request form; on a Sub Requested session
 * the same action reopens the form or undoes the request. Other statuses get no action.
 */
export default function RequestSubstituteDialog({
  session,
  isDropdownItem = false,
}: RequestSubstituteDialogProps) {
  const TC = useDashboardContext();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const isSubRequested = session.status === "Sub-Request";
  if (session.status !== "Active" && !isSubRequested) return null;

  const studentName =
    `${session.student?.firstName ?? ""} ${session.student?.lastName ?? ""}`.trim();
  const label = isSubRequested ? "Sub Requested" : "Request a Substitute";
  const Icon = isSubRequested ? UserRoundCheck : UserRoundPlus;

  const replaceSession = (updated: Session) => {
    TC.setCurrentSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    TC.setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  /** Runs a status change, closing the dialog afterwards; a thrown call counts as an error. */
  const runStatusChange = async (
    action: (sessionId: string) => Promise<SubstituteRequestResult>,
  ): Promise<SubstituteRequestResult> => {
    setPending(true);
    try {
      return await action(session.id);
    } catch (error) {
      console.error("Substitute status change failed:", error);
      return { ok: false, reason: "error" };
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  const handleRequest = async () => {
    // Open the form before awaiting anything so the browser doesn't block the new tab.
    const formOpened = openSubstituteRequestForm();
    const result = await runStatusChange(requestSubstitute);

    if (!result.ok) {
      toast.error(failureMessage(result, "marked for a substitute"));
      return;
    }
    replaceSession(result.session);
    toast.success("Session marked Sub Requested. Submit the substitute request form to finish.");
    if (!formOpened) window.location.href = SUBSTITUTE_REQUEST_FORM_URL;
  };

  const handleReopenForm = () => {
    setOpen(false);
    if (!openSubstituteRequestForm()) window.location.href = SUBSTITUTE_REQUEST_FORM_URL;
  };

  const handleUndo = async () => {
    const result = await runStatusChange(undoSubstituteRequest);

    if (!result.ok) {
      toast.error(failureMessage(result, "changed back to Active"));
      return;
    }
    replaceSession(result.session);
    toast.success("Substitute request undone. The session is Active again.");
  };

  const trigger = isDropdownItem ? (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
    >
      <Icon className="h-4 w-4 mr-2" />
      {isSubRequested ? "Sub Requested" : "Request Substitute"}
    </DropdownMenuItem>
  ) : (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} onClick={() => setOpen(true)}>
          <Icon className={isSubRequested ? "h-4 w-4 text-teal-600" : "h-4 w-4"} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <center>{label}</center>
      </HoverCardContent>
    </HoverCard>
  );

  return (
    <>
      {trigger}
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isSubRequested ? "Substitute requested" : "Request a substitute?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {isSubRequested ? (
                <div className="space-y-2">
                  <p>
                    Your session with {studentName} on {formatSessionDate(session.date)} is marked
                    Sub Requested, so it won&apos;t count toward your volunteer hours and
                    doesn&apos;t need a Session Exit Form.
                  </p>
                  <p>
                    Haven&apos;t submitted the substitute request form yet? Open it again. Teaching
                    this session after all? Undo the request.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    Your session with {studentName} on {formatSessionDate(session.date)} will be
                    marked Sub Requested. You won&apos;t receive volunteer hours for it, and no
                    Session Exit Form is needed.
                  </p>
                  <p>
                    The substitute request form opens next. Submit it so a substitute can be found.
                    Requests should be made at least 24 hours in advance.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {isSubRequested ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {isSubRequested ? (
              <>
                <Button variant="outline" disabled={pending} onClick={handleUndo}>
                  {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Undo sub request
                </Button>
                <Button disabled={pending} onClick={handleReopenForm}>
                  Open form
                </Button>
              </>
            ) : (
              <Button disabled={pending} onClick={handleRequest}>
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Mark &amp; open form
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
