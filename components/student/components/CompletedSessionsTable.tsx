"use client";

import React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatSessionDate } from "@/lib/utils";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Circle,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  TableCellsMerge,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { MobileCard } from "@/components/ui/mobile-card";
import { LoadMoreButton } from "@/components/ui/load-more-button";

interface SessionsTableProps {
  paginatedSessions: Session[];
  filteredSessions: Session[];
  currentPage: number;
  totalPages: number;
  rowsPerPage: string;
  selectedSession: Session | null;
  setSelectedSession: (session: Session | null) => void;
  handlePageChange: (page: number) => void;
  handleRowsPerPageChange: (value: string) => void;
}

const CompletedSessionsTable = ({
  paginatedSessions,
  visibleSessions,
  hasMore,
  loadMore,
  // filteredSessions,
  // currentPage,
  totalPages,
  // rowsPerPage,
  // selectedSession,
  // setSelectedSession,
  handlePageChange,
  handleRowsPerPageChange,
}: any) => {
  const [isMeetingNotesOpen, setIsMeetingNotesOpen] = useState(false);
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
              <TableHead>{t("headers.meetingNotes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session: Session, index: number) => (
              <TableRow key={index}>
                <TableCell>
                  {session.status === "Complete" ? (
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
                  <Dialog open={isMeetingNotesOpen} onOpenChange={setIsMeetingNotesOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsMeetingNotesOpen(true);
                          SC.setSelectedSession(session);
                        }}
                      >
                        {t("viewSessionNotes")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("headers.meetingNotes")}</DialogTitle>
                      </DialogHeader>
                      <Textarea>{SC.selectedSession?.session_exit_form}</Textarea>
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 hidden md:flex justify-between items-center">
          <span>{t("rowsTotal", { count: SC.filteredPastSessions.length })}</span>
          <div className="flex items-center space-x-2">
            <span>{t("rowsPerPage")}</span>
            <Select
              value={SC.rowsPerPagePastSessions.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={SC.rowsPerPagePastSessions.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span>
              {t("pageOf", { page: SC.currentPagePastSessions, total: totalPages })}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={SC.currentPagePastSessions === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(SC.currentPagePastSessions - 1)}
                disabled={SC.currentPagePastSessions === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                onClick={() => handlePageChange(SC.currentPagePastSessions + 1)}
                disabled={SC.currentPagePastSessions === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={SC.currentPagePastSessions === totalPages}
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
                {t("sessionTitle", {
                  firstName: session.tutor?.firstName ?? "",
                  lastName: session.tutor?.lastName ?? "",
                })}
              </div>
              {session.status === "Complete" ? (
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
            <Dialog open={isMeetingNotesOpen} onOpenChange={setIsMeetingNotesOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsMeetingNotesOpen(true);
                    SC.setSelectedSession(session);
                  }}
                >
                  {t("viewSessionNotes")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("headers.meetingNotes")}</DialogTitle>
                </DialogHeader>
                <Textarea>{SC.selectedSession?.session_exit_form}</Textarea>
              </DialogContent>
            </Dialog>
          </MobileCard>
        ))}
        <LoadMoreButton hasMore={!!hasMore} onClick={() => loadMore?.()} />
      </div>
    </>
  );
};

export default CompletedSessionsTable;
