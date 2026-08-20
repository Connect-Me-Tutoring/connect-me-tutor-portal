"use client";

import React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatSessionDate, formatDateAdmin } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Circle,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserRoundPlus,
  Clock,
  CircleCheckBig,
  CircleX,
  Copy,
  MessageSquare,
  CalendarX,
  Video,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import CancellationForm from "../../tutor/components/CancellationForm";
// import SessionExitForm from "./SessionExitForm";
// import RescheduleForm from "./RescheduleDialog";
// import CancellationForm from "./CancellationForm";
import { boolean } from "zod";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { MobileCard } from "@/components/ui/mobile-card";
import { LoadMoreButton } from "@/components/ui/load-more-button";

interface SessionsTableProps {
  paginatedSessions: Session[];
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

const ActiveSessionsTable = ({
  paginatedSessions,
  filteredSessions,
  visibleSessions,
  hasMore,
  loadMore,
  // meetings,
  // currentPage,
  totalPages,
  // rowsPerPage,
  // selectedSession,
  // selectedSessionDate,
  // isDialogOpen,
  // isSessionExitFormOpen,
  // notes,
  // nextClassConfirmed,
  // setSelectedSession,
  // setSelectedSessionDate,
  // setIsDialogOpen,
  // setIsSessionExitFormOpen,
  // setNotes,
  // setNextClassConfirmed,
  handleStatusChange,
  handleReschedule,
  handleSessionComplete,
  handlePageChange,
  handleRowsPerPageChange,
  handleInputChange,
}: any) => {
  const SC = useDashboardContext();
  const t = useTranslations("student.tables.common");
  return (
    <>
      <div className="hidden md:block w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("headers.markStatus")}</TableHead>
              <TableHead>{t("headers.date")}</TableHead>
              <TableHead>{t("headers.title")}</TableHead>
              <TableHead>{t("headers.tutor")}</TableHead>
              <TableHead>{t("headers.meeting")}</TableHead>
              <TableHead>{t("headers.feedback")}</TableHead>
              <TableHead>{t("headers.actions")}</TableHead>
              {/* <TableHead>Reschedule</TableHead> */}
              {/* <TableHead>Request Substitute</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session: any, index: number) => (
              <TableRow key={index}>
                <TableCell>
                  {session.status === "Active" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      <Clock size={14} className="mr-1" />
                      {t("status.active")}
                    </span>
                  ) : session.status === "Complete" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200">
                      <CircleCheckBig size={14} className="mr-1" />
                      {t("status.complete")}
                    </span>
                  ) : session.status === "Cancelled" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200">
                      <CircleX size={14} className="mr-1" />
                      {t("status.cancelled")}
                    </span>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell>{formatSessionDate(session.date)}</TableCell>
                <TableCell className="font-medium">
                  {t("sessionTitle", {
                    firstName: session.tutor?.firstName ?? "",
                    lastName: session.tutor?.lastName ?? "",
                  })}
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
                      {t("headers.meeting")}
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground/50">{t("notAvailable")}</span>
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
                    {t("headers.feedback")}
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
                          title={t("cancelSessionTooltip")}
                        >
                          <CalendarX className="h-4 w-4 mr-1.5" />
                          {t("cancel")}
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
                {/* <TableCell></TableCell> */}

                {/* <TableCell></TableCell> */}
                {/* <TableCell>
                <SessionExitForm
                  currSession={session}
                  isSessionExitFormOpen={isSessionExitFormOpen}
                  setIsSessionExitFormOpen={setIsSessionExitFormOpen}
                  selectedSession={selectedSession}
                  setSelectedSession={setSelectedSession}
                  notes={notes}
                  setNotes={setNotes}
                  nextClassConfirmed={nextClassConfirmed}
                  setNextClassConfirmed={setNextClassConfirmed}
                  handleSessionComplete={handleSessionComplete}
                  handleStatusChange={handleStatusChange}
                />
              </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 hidden md:flex justify-between items-center">
          <span>{t("rowsTotal", { count: SC.filteredSessions.length })}</span>
          <div className="flex items-center space-x-2">
            <span>{t("rowsPerPage")}</span>
            <Select
              value={SC.rowsPerPageActiveSessions.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={SC.rowsPerPageActiveSessions.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span>
              {t("pageOf", { page: SC.currentPageActiveSessions, total: totalPages })}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={SC.currentPageActiveSessions === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(SC.currentPageActiveSessions - 1)}
                disabled={SC.currentPageActiveSessions === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(SC.currentPageActiveSessions + 1)}
                disabled={SC.currentPageActiveSessions === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={SC.currentPageActiveSessions === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {(visibleSessions ?? []).map((session: any, index: number) => (
          <MobileCard key={index}>
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium text-sm">
                {t("sessionTitle", {
                  firstName: session.tutor?.firstName ?? "",
                  lastName: session.tutor?.lastName ?? "",
                })}
              </div>
              {session.status === "Active" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                  <Clock size={14} className="mr-1" />
                  {t("status.active")}
                </span>
              ) : session.status === "Complete" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                  <CircleCheckBig size={14} className="mr-1" />
                  {t("status.complete")}
                </span>
              ) : session.status === "Cancelled" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                  <CircleX size={14} className="mr-1" />
                  {t("status.cancelled")}
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
                  {t("headers.meeting")}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground/50">{t("noMeetingLink")}</span>
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
                {t("headers.feedback")}
              </a>
              {session.status === "Active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      title={t("cancelSessionTooltip")}
                    >
                      <CalendarX className="h-4 w-4 mr-1.5" />
                      {t("cancel")}
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
        <LoadMoreButton hasMore={!!hasMore} onClick={() => loadMore?.()} />
      </div>
    </>
  );
};

export default ActiveSessionsTable;
