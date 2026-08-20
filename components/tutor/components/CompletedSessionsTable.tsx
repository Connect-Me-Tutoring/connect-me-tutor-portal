import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { formatSessionDate, formatSessionDuration } from "@/lib/utils";
import { Session } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Ellipsis,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardContext } from "@/lib/contexts/dashboardContext";
import { MobileCard } from "@/components/ui/mobile-card";
import { LoadMoreButton } from "@/components/ui/load-more-button";

const CompletedSessionsTable = ({
  paginatedSessions,
  visibleSessions,
  hasMore,
  loadMore,
  totalPages,
  handlePageChange,
  handleRowsPerPageChange,
  handleUndoSessionExitForm,
}: any) => {
  const TC = useDashboardContext();
  const t = useTranslations("tutorSessions.tables");
  const [isMeetingNotesOpen, setIsMeetingNotesOpen] = useState(false);

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
              <TableHead>{t("common.columns.meetingNotes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session: Session, index: number) => (
              <TableRow key={index}>
                <TableCell>
                  {session.status === "Complete" ? (
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
                  <div className="flex flex-col space-y-2">
                    <Dialog open={isMeetingNotesOpen} onOpenChange={setIsMeetingNotesOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setIsMeetingNotesOpen(true);
                            TC.setSelectedSession(session);
                          }}
                        >
                          {t("completed.viewSessionNotes")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("completed.meetingNotesDialogTitle")}</DialogTitle>
                        </DialogHeader>
                        <Textarea readOnly>{TC.selectedSession?.session_exit_form}</Textarea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>{t("common.columns.actions")}</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            if (session.status === "Complete") {
                              handleUndoSessionExitForm(session.id);
                            } else {
                              TC.setSelectedSession(session);
                              TC.setIsSessionExitFormOpen(true);
                            }
                          }}
                        >
                          {t("completed.undo")}
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 hidden md:flex justify-between items-center">
          <span>{t("common.pagination.rowsTotal", { count: TC.filteredPastSessions.length })}</span>
          <div className="flex items-center space-x-2">
            <span>{t("common.pagination.rowsPerPage")}</span>
            <Select
              value={TC.rowsPerPagePastSessions.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={TC.rowsPerPagePastSessions.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span>
              {t("common.pagination.page", {
                current: TC.currentPagePastSessions,
                total: totalPages,
              })}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={TC.currentPagePastSessions === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(TC.currentPagePastSessions - 1)}
                disabled={TC.currentPagePastSessions === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(TC.currentPagePastSessions + 1)}
                disabled={TC.currentPagePastSessions === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={TC.currentPagePastSessions === totalPages}
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
              {session.status === "Complete" ? (
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
            <div className="text-sm">
              {t("common.columns.duration")}: {formatSessionDuration(session.duration)}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Dialog open={isMeetingNotesOpen} onOpenChange={setIsMeetingNotesOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsMeetingNotesOpen(true);
                      TC.setSelectedSession(session);
                    }}
                  >
                    {t("completed.viewSessionNotes")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("completed.meetingNotesDialogTitle")}</DialogTitle>
                  </DialogHeader>
                  <Textarea readOnly>{TC.selectedSession?.session_exit_form}</Textarea>
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("common.columns.actions")}</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        if (session.status === "Complete") {
                          handleUndoSessionExitForm(session.id);
                        } else {
                          TC.setSelectedSession(session);
                          TC.setIsSessionExitFormOpen(true);
                        }
                      }}
                    >
                      {t("completed.undo")}
                    </DropdownMenuItem>
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

export default CompletedSessionsTable;
