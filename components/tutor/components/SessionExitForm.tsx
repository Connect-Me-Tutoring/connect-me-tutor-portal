import React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Session } from "@/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash } from "lucide-react";
import {
  addDays,
  isAfter,
  parseISO,
  differenceInDays,
  isToday,
  isTomorrow,
} from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import CancellationForm from "./CancellationForm";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";

interface SessionExitFormProps {
  currSession: Session;
  isSessionExitFormOpen: boolean;
  setIsSessionExitFormOpen: (open: boolean) => void;
  selectedSession: Session | null;
  setSelectedSession: (session: Session | null) => void;
  notes: string;
  setNotes: (notes: string) => void;
  nextClassConfirmed: boolean;
  setNextClassConfirmed: (open: boolean) => void;
  handleSessionComplete: (
    session: Session,
    notes: string,
    isQuestionOrConcern: boolean,
    isFirstSession: boolean,
  ) => void;
  handleStatusChange: (session: Session) => void;
}

const calculateDeadline = (sessionDate: Date) => {
  const deadlineDate = addDays(sessionDate, 2);
  const month: string = String(deadlineDate.getMonth() + 1).padStart(2, "0");
  const day: string = String(deadlineDate.getDate()).padStart(2, "0");

  const mmdd: string = `${month}/${day}`;
  return mmdd;
};

const sessionExitFormDeadline = (currSession: Session) => {
  const date = new Date(currSession.date);
  const deadlineDate = addDays(date, 2);
  const daysUntilDeadline = differenceInDays(deadlineDate, new Date());

  let urgencyClass = "";
  let deadlineText = "";

  if (isToday(deadlineDate) || daysUntilDeadline === 0) {
    urgencyClass = "bg-red-500 text-white hover:bg-red-600 border-red-500";
    deadlineText = "SEF Due TODAY by 11:59pm EST";
  } else if (isTomorrow(deadlineDate) || daysUntilDeadline === 1) {
    urgencyClass =
      "bg-orange-500 text-white hover:bg-orange-600 border-orange-500";
    deadlineText = `SEF Due Tomorrow`;
  } else if (daysUntilDeadline <= 2) {
    urgencyClass =
      "bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500";
    deadlineText = `SEF Due in ${daysUntilDeadline} days`;
  } else {
    urgencyClass =
      "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200";
    deadlineText = `SEF Due ${calculateDeadline(date)}`;
  }

  return { urgencyClass, deadlineText };
};

const SessionExitForm = ({
  currSession,
  // isSessionExitFormOpen,
  // setIsSessionExitFormOpen,
  // selectedSession,
  // setSelectedSession,
  // notes,
  // setNotes,
  // nextClassConfirmed,
  // setNextClassConfirmed,
  handleSessionComplete,
  handleStatusChange,
}: any) => {
  const TC = useDashboardContext();

  const [isCancellation, setisCancellation] = useState(false);
  const [isFirstSession, setIsFirstSession] = useState(false);
  const [isQuestionOrConcern, setIsQuestionOrConcern] = useState(false);
  return (
    <Dialog
      open={TC.isSessionExitFormOpen}
      onOpenChange={TC.setIsSessionExitFormOpen}
    >
      <DialogTrigger asChild>
        <HoverCard>
          <HoverCardTrigger>
            <Button
              variant="outline"
              disabled={
                isAfter(parseISO(currSession.date), Date.now()) ||
                currSession.status !== "Active"
              }
              onClick={() => {
                TC.setSelectedSession(currSession);
                TC.setIsSessionExitFormOpen(true);
              }}
              className=""
            >
              {sessionExitFormDeadline(currSession).deadlineText}
            </Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <div className="space-y-1 text-sm">
              <p className="font-medium">Submit by 11:59pm EST</p>
              <p className="text-muted-foreground">
                Session Exit Form will be available after your session
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Session Exit Form
            <AlertDialog>
              <AlertDialogTrigger>
                <Button variant="outline">The session did not happen</Button>
              </AlertDialogTrigger>
              {TC.selectedSession ? (
                <CancellationForm
                  session={TC.selectedSession}
                  handleStatusChange={handleStatusChange}
                  onClose={() => TC.setIsSessionExitFormOpen(false)}
                />
              ) : (
                ""
              )}
            </AlertDialog>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="question-or-concern"
            checked={isQuestionOrConcern}
            onCheckedChange={(checked) =>
              setIsQuestionOrConcern(checked === true)
            }
          />
          <label htmlFor="next-class" className="text-sm font-medium">
            I have a question or a concern
          </label>
        </div>
        <Textarea
          value={TC.notes}
          onChange={(e) => TC.setNotes(e.target.value)}
          placeholder={
            isQuestionOrConcern
              ? "What is your question or concern?"
              : "In 2-4 sentences, What did you cover during your session?"
          }
        />
        <div className={isQuestionOrConcern ? "hidden" : ""}>
          {" "}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="next-class"
              checked={TC.nextClassConfirmed}
              onCheckedChange={(checked) =>
                TC.setNextClassConfirmed(checked === true)
              }
            />
            <label htmlFor="next-class" className="text-sm font-medium flex">
              <div className="text-red-500">*</div> My student knows about our
              next class
            </label>
          </div>
        </div>
        <Button
          onClick={() => {
            if (TC.selectedSession) {
              handleSessionComplete(
                TC.selectedSession,
                TC.notes,
                isQuestionOrConcern,
                isFirstSession,
              );
            }
          }}
          disabled={
            !TC.notes || (!TC.nextClassConfirmed && !isQuestionOrConcern)
          }
        >
          Submit
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SessionExitForm;
