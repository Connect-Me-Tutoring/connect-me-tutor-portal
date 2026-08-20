import React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatSessionDate, formatSessionDuration } from "@/lib/utils";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Circle,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CalendarX,
  UserRoundPlus,
  Clock,
  CircleCheckBig,
  CircleX,
  Copy,
  Ellipsis,
  Video,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import SessionExitForm from "./SessionExitForm";
import CancellationForm from "./CancellationForm";
import EditSessionForm from "./EditSessionForm";
import { boolean } from "zod";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    category?: string,
  ) => void;
  handlePageChange: (page: number) => void;
  handleRowsPerPageChange: (value: string) => void;
  handleInputChange: (e: { target: { name: string; value: string } }) => void;
}

const ActiveSessionsTable = ({
  paginatedSessions,
  visibleSessions,
  hasMore,
  loadMore,
  meetings,
  totalPages,
  setNextClassConfirmed,
  handleStatusChange,
  handleSessionComplete,
  handlePageChange,
  handleRowsPerPageChange,
}: any) => {
  const TC = useDashboardContext();
  const t = useTranslations("tutorSessions.tables");
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
  return (
    <>
      <div className="hidden md:block w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.columns.markStatus")}</TableHead>
              <TableHead>{t("common.columns.date")}</TableHead>
              <TableHead>{t("common.columns.title")}</TableHead>
              <TableHead>{t("common.columns.student")}</TableHead>
              <TableHead>{t("common.columns.duration")}</TableHead>
              <TableHead>{t("common.columns.meeting")}</TableHead>
              <TableHead>{t("common.columns.sessionExitForm")}</TableHead>
              <TableHead>{t("common.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session: Session, index: number) => (
              <TableRow key={index}>
                <TableCell>
                  {session.status === "Active" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      <Clock size={14} className="mr-1" />
                      {t("common.status.active")}
                    </span>
                  ) : session.status === "Complete" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200">
                      <CircleCheckBig size={14} className="mr-1" />
                      {t("common.status.complete")}
                    </span>
                  ) : session.status === "Cancelled" ? (
                    <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200">
                      <CircleX size={14} className="mr-1" />
                      {t("common.status.cancelled")}
                    </span>
                  ) : (
                    ""
                  )}
                </TableCell>
                <TableCell>{formatSessionDate(session.date)}</TableCell>
                <TableCell className="font-medium">
                  {t("common.sessionTitle", {
                    firstName: session.student?.firstName ?? "",
                    lastName: session.student?.lastName ?? "",
                  })}
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
                      {t("common.meetingLinkLabel")}
                    </button>
                  ) : (
                    <span className="text-sm text-muted-foreground/50">{t("common.noMeetingLink")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <SessionExitForm
                    currSession={session}
                    setNextClassConfirmed={setNextClassConfirmed}
                    handleSessionComplete={markSessionComplete}
                    handleStatusChange={handleStatusChange}
                  />
                </TableCell>
                <TableCell className="flex content-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{t("common.columns.actions")}</DropdownMenuLabel>
                        <EditSessionForm
                          session={session}
                          meetings={meetings}
                          handleStatusChange={handleStatusChange}
                          isDropdownItem
                        />
                        <DropdownMenuItem
                          onClick={() =>
                            (window.location.href = "https://forms.gle/AC4an7K6NSNumDwKA")
                          }
                        >
                          <UserRoundPlus className="h-4 w-4 mr-2" />
                          {t("common.requestSubstitute")}
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                              }}
                            >
                              <CalendarX className="h-4 w-4 mr-2" />
                              {t("active.cancelDialog.trigger")}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("active.cancelDialog.title")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("active.cancelDialog.description", {
                                  name: `${session.student?.firstName} ${session.student?.lastName}`,
                                  date: formatSessionDate(session.date),
                                })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("active.cancelDialog.cancelButton")}
                              </AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleStatusChange(session)}>
                                {t("active.cancelDialog.confirmButton")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 hidden md:flex justify-between items-center">
          <span>{t("common.pagination.rowsTotal", { count: TC.filteredSessions.length })}</span>
          <div className="flex items-center space-x-2">
            <span>{t("common.pagination.rowsPerPage")}</span>
            <Select
              value={TC.rowsPerPageActiveSessions.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={TC.rowsPerPageActiveSessions.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span>
              {t("common.pagination.page", {
                current: TC.currentPageActiveSessions,
                total: totalPages,
              })}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={TC.currentPageActiveSessions === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(TC.currentPageActiveSessions - 1)}
                disabled={TC.currentPageActiveSessions === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(TC.currentPageActiveSessions + 1)}
                disabled={TC.currentPageActiveSessions === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={TC.currentPageActiveSessions === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {(visibleSessions ?? []).map((session: Session, index: number) => (
          <MobileCard key={index}>
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium text-sm">
                {t("common.sessionTitle", {
                  firstName: session.student?.firstName ?? "",
                  lastName: session.student?.lastName ?? "",
                })}
              </div>
              {session.status === "Active" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
                  <Clock size={14} className="mr-1" />
                  {t("common.status.active")}
                </span>
              ) : session.status === "Complete" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                  <CircleCheckBig size={14} className="mr-1" />
                  {t("common.status.complete")}
                </span>
              ) : session.status === "Cancelled" ? (
                <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
                  <CircleX size={14} className="mr-1" />
                  {t("common.status.cancelled")}
                </span>
              ) : (
                ""
              )}
            </div>
            <div className="text-sm text-muted-foreground">{formatSessionDate(session.date)}</div>
            <div className="text-sm space-y-1">
              <div>
                {t("common.columns.duration")}: {formatSessionDuration(session.duration)}
              </div>
              <div>
                {session?.meeting?.meetingId ? (
                  <button
                    onClick={() => (window.location.href = `/meeting/${session?.meeting?.id}`)}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-connect-me-blue-2 transition-colors"
                  >
                    <Video className="h-4 w-4" />
                    {t("common.meetingLinkLabel")}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground/50">
                    {t("common.noMeetingLinkMobile")}
                  </span>
                )}
              </div>
            </div>
            <div>
              <SessionExitForm
                currSession={session}
                setNextClassConfirmed={setNextClassConfirmed}
                handleSessionComplete={markSessionComplete}
                handleStatusChange={handleStatusChange}
              />
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("common.columns.actions")}</DropdownMenuLabel>
                    <EditSessionForm
                      session={session}
                      meetings={meetings}
                      handleStatusChange={handleStatusChange}
                      isDropdownItem
                    />
                    <DropdownMenuItem
                      onClick={() => (window.location.href = "https://forms.gle/AC4an7K6NSNumDwKA")}
                    >
                      <UserRoundPlus className="h-4 w-4 mr-2" />
                      {t("common.requestSubstitute")}
                    </DropdownMenuItem>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                          }}
                        >
                          <CalendarX className="h-4 w-4 mr-2" />
                          {t("active.cancelDialog.trigger")}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("active.cancelDialog.title")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("active.cancelDialog.description", {
                              name: `${session.student?.firstName} ${session.student?.lastName}`,
                              date: formatSessionDate(session.date),
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("active.cancelDialog.cancelButton")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleStatusChange(session)}>
                            {t("active.cancelDialog.confirmButton")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </MobileCard>
        ))}
        <LoadMoreButton hasMore={!!hasMore} onClick={() => loadMore?.()} />
      </div>
    </>
  );
};

export default ActiveSessionsTable;
