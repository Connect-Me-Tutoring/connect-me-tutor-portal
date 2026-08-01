import React from "react";
import { useState } from "react";
import { formatSessionDate, formatDateAdmin } from "@/lib/utils";
import { Session, Meeting } from "@/types";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  CalendarDays,
  UserRoundPlus,
  CircleCheck,
  MessageSquare,
  CalendarX,
  Video,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import CancellationForm from "../../tutor/components/CancellationForm";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { MobileCard } from "@/components/ui/mobile-card";
// import SessionExitForm from "./SessionExitForm";
// import RescheduleForm from "./RescheduleDialog";
// import CancellationForm from "./CancellationForm";

interface CurrentSessionTableProps {
  currentSessions: Session[];
  filteredSessions: Session[];
  meetings: Meeting[];
  currentPage: number;
  totalPages: number;
  rowsPerPage: string;
  selectedSession: Session | null;
  selectedSessionDate: string | null;
  isDialogOpen: boolean;
  isSessionExitFormOpen: boolean;
  notes: string;
  nextClassConfirmed: boolean;
  setSelectedSession: (session: Session | null) => void;
  setSelectedSessionDate: (date: string | null) => void;
  setIsDialogOpen: (open: boolean) => void;
  setIsSessionExitFormOpen: (open: boolean) => void;
  setNotes: (notes: string) => void;
  setNextClassConfirmed: (confirmed: boolean) => void;
  handleStatusChange: (session: Session) => void;
  handleReschedule: (sessionId: string, newDate: string, meetingId: string) => void;
  handleSessionComplete: (
    session: Session,
    notes: string,
    isQuestionOrConcern: boolean,
    isFirstSession: boolean,
  ) => void;
  handlePageChange: (page: number) => void;
  handleRowsPerPageChange: (value: string) => void;
  handleInputChange: (e: { target: { name: string; value: string } }) => void;
}

const CurrentSessionsTable = ({
  handleStatusChange,
}: {
  handleStatusChange: (session: Session) => void;
}) => {
  const SC = useDashboardContext();

  return (
    <>
      <div className="hidden md:block w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mark Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Tutor</TableHead>
            <TableHead>Meeting</TableHead>
            <TableHead>Feedback</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SC.currentSessions.map((session, index) => (
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
                Tutoring Session with {session.tutor?.firstName} {session.tutor?.lastName}
              </TableCell>
              <TableCell>
                {session.tutor?.firstName} {session.tutor?.lastName}
              </TableCell>
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
                <a
                  href="https://docs.google.com/forms/d/1YPS8angPHS1HEyDn6ub2d5iEsfjuvi0N_Yr7YevaSIc/viewform?edit_requested=true#responses"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-connect-me-blue-2 transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Feedback
                </a>
              </TableCell>
              <TableCell>
                {session.status === "Active" ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Cancel session"
                      >
                        <CalendarX className="h-4 w-4 mr-1.5" />
                        Cancel
                      </Button>
                    </AlertDialogTrigger>
                    <CancellationForm
                      session={session}
                      handleStatusChange={handleStatusChange}
                      onClose={() => {}}
                      actor="student"
                    />
                  </AlertDialog>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <div className="md:hidden space-y-4">
        {SC.currentSessions.map((session, index) => (
          <MobileCard key={index}>
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium text-sm">
                Tutoring Session with {session.tutor?.firstName} {session.tutor?.lastName}
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
            <div className="text-sm">
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
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://docs.google.com/forms/d/1YPS8angPHS1HEyDn6ub2d5iEsfjuvi0N_Yr7YevaSIc/viewform?edit_requested=true#responses"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-connect-me-blue-2 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Feedback
              </a>
              {session.status === "Active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      title="Cancel session"
                    >
                      <CalendarX className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <CancellationForm
                    session={session}
                    handleStatusChange={handleStatusChange}
                    onClose={() => {}}
                    actor="student"
                  />
                </AlertDialog>
              ) : null}
            </div>
          </MobileCard>
        ))}
      </div>
    </>
  );
};

export default CurrentSessionsTable;
