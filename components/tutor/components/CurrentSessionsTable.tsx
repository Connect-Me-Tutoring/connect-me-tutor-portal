import React from "react";
import { useState } from "react";
import { formatSessionDate, formatDateAdmin, formatSessionDuration } from "@/lib/utils";
import { Session, Meeting } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Circle,
  CircleCheckBig,
  CircleX,
  Clock,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CalendarX,
  UserRoundPlus,
  CircleCheck,
  X,
  Video,
} from "lucide-react";
import { format, parseISO, isAfter, addDays } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import SessionExitForm from "./SessionExitForm";
import CancellationForm from "./CancellationForm";
import EditSessionForm from "./EditSessionForm";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { MobileCard } from "@/components/ui/mobile-card";

const CurrentSessionsTable = ({
  meetings,
  totalPages,
  handleStatusChange,
  handleSessionComplete,
  handlePageChange,
  handleRowsPerPageChange,
  handleUndoCancel,
}: any) => {
  const calculateDeadline = (sessionDate: Date) => {
    const deadlineDate = addDays(sessionDate, 2);
    const month: string = String(deadlineDate.getMonth() + 1).padStart(2, "0");
    const day: string = String(deadlineDate.getDate()).padStart(2, "0");

    const mmdd: string = `${month}/${day}`;
    return mmdd;
  };

  const sessionExitFormDeadline = (currSession: Session) => {
    const date = new Date(currSession.date);
    const deadlineDay = calculateDeadline(date);
    return (
      <>
        {isAfter(parseISO(currSession.date), Date.now())
          ? `SEF Due ${deadlineDay} 11:59 pm EST`
          : `SEF Due ${deadlineDay} 11:59 pm EST`}
      </>
    );
  };

  const markSessionComplete = async (
    updatedSession: Session,
    notes: string,
    isQuestionOrConcern: boolean,
    isFirstSession: boolean,
    category?: string,
  ) => {
    await handleSessionComplete(
      updatedSession,
      notes,
      isQuestionOrConcern,
      isFirstSession,
      category,
    );
    try {
      await fetch("/api/send-feedback-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: updatedSession.student?.email,
          studentName: updatedSession.student?.firstName,
        }),
      });
    } catch (emailError) {
      console.error("Failed to send feedback email:", emailError);
    }
  };

  const TC = useDashboardContext();
  return (
    <>
      <div className="hidden md:block w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mark Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Meeting</TableHead>
            <TableHead>Session Exit Form</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {TC.currentSessions.map((session, index) => (
            <TableRow key={index}>
              <TableCell>
                {session.status === "Active" ? (
                  <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    <Clock size={14} className="mr-1" />
                    Active
                  </span>
                ) : session.status === "Complete" ? (
                  <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200">
                    <CircleCheckBig size={14} className="mr-1" />
                    Complete
                  </span>
                ) : session.status === "Cancelled" ? (
                  <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200">
                    <CircleX size={14} className="mr-1" />
                    Cancelled
                  </span>
                ) : (
                  ""
                )}
              </TableCell>
              <TableCell>{formatSessionDate(session.date)}</TableCell>
              <TableCell className="font-medium">
                Tutoring Session with {session.student?.firstName} {session.student?.lastName}
              </TableCell>
              <TableCell>
                {session.student?.firstName} {session.student?.lastName}
              </TableCell>
              <TableCell>{formatSessionDuration(session.duration)}</TableCell>
              <TableCell>
                {session?.meeting?.meetingId ? (
                  <button
                    onClick={() => (window.location.href = `/meeting/${session?.meeting?.id}`)}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-connect-me-blue-2 transition-colors"
                  >
                    <Video className="h-4 w-4" />
                    Meeting
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground/50">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <SessionExitForm
                  currSession={session}
                  // isSessionExitFormOpen={isSessionExitFormOpen}
                  // setIsSessionExitFormOpen={setIsSessionExitFormOpen}
                  // selectedSession={selectedSession}
                  // setSelectedSession={setSelectedSession}
                  // notes={notes}
                  // setNotes={setNotes}
                  // nextClassConfirmed={nextClassConfirmed}
                  // setNextClassConfirmed={setNextClassConfirmed}
                  handleSessionComplete={markSessionComplete}
                  handleStatusChange={handleStatusChange}
                />
              </TableCell>
              <TableCell className="flex content-center">
                <EditSessionForm
                  session={session}
                  meetings={meetings}
                  handleStatusChange={handleStatusChange}
                  isDropdownItem={false}
                />

                <HoverCard>
                  <HoverCardTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => (window.location.href = "https://forms.gle/AC4an7K6NSNumDwKA")}
                    >
                      <UserRoundPlus className="h-4 w-4" />
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <center>Request a Substitute</center>
                  </HoverCardContent>
                </HoverCard>
                {/* changed to show X icon for cancelled sessions, trash for active */}
                {session.status === "Cancelled" ? (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUndoCancel?.(session.id)}
                      >
                        <X className="h-4 w-4" color="#10b981" />
                      </Button>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      <center>Undo Cancel</center>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <CalendarX className="h-4 w-4" color="#ef4444" />
                      </Button>
                    </AlertDialogTrigger>
                    <CancellationForm
                      session={session}
                      handleStatusChange={handleStatusChange}
                      onClose={() => {}}
                    />
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <div className="md:hidden space-y-4">
        {TC.currentSessions.map((session, index) => (
          <MobileCard key={index}>
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium text-sm">
                Tutoring Session with {session.student?.firstName} {session.student?.lastName}
              </div>
              {session.status === "Active" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                  <Clock size={14} className="mr-1" />
                  Active
                </span>
              ) : session.status === "Complete" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                  <CircleCheckBig size={14} className="mr-1" />
                  Complete
                </span>
              ) : session.status === "Cancelled" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                  <CircleX size={14} className="mr-1" />
                  Cancelled
                </span>
              ) : (
                ""
              )}
            </div>
            <div className="text-sm text-muted-foreground">{formatSessionDate(session.date)}</div>
            <div className="text-sm space-y-1">
              <div>Duration: {formatSessionDuration(session.duration)}</div>
              <div>
                {session?.meeting?.meetingId ? (
                  <button
                    onClick={() => (window.location.href = `/meeting/${session?.meeting?.id}`)}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-connect-me-blue-2 transition-colors"
                  >
                    <Video className="h-4 w-4" />
                    Meeting
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground/50">No meeting link</span>
                )}
              </div>
            </div>
            <div>
              <SessionExitForm
                currSession={session}
                handleSessionComplete={markSessionComplete}
                handleStatusChange={handleStatusChange}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <EditSessionForm
                session={session}
                meetings={meetings}
                handleStatusChange={handleStatusChange}
                isDropdownItem={false}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (window.location.href = "https://forms.gle/AC4an7K6NSNumDwKA")}
              >
                <UserRoundPlus className="h-4 w-4" />
              </Button>
              {session.status === "Cancelled" ? (
                <Button variant="ghost" size="icon" onClick={() => handleUndoCancel?.(session.id)}>
                  <X className="h-4 w-4" color="#10b981" />
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <CalendarX className="h-4 w-4" color="#ef4444" />
                    </Button>
                  </AlertDialogTrigger>
                  <CancellationForm
                    session={session}
                    handleStatusChange={handleStatusChange}
                    onClose={() => {}}
                  />
                </AlertDialog>
              )}
            </div>
          </MobileCard>
        ))}
      </div>
    </>
  );
};

export default CurrentSessionsTable;
