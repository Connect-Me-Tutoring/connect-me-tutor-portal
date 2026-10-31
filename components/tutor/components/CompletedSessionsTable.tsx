import React, { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import { SessionStatusBadge } from "@/components/sessions/SessionStatusBadge";
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
  const [notesSession, setNotesSession] = useState<Session | null>(null);

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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSessions.map((session: Session, index: number) => (
              <TableRow key={index}>
                <TableCell>
                  <SessionStatusBadge status={session.status} />
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
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => setNotesSession(session)}>
                          View Session Notes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (
                              session.status === "Complete" ||
                              session.status === "Student Did Not Attend"
                            ) {
                              handleUndoSessionExitForm(session.id);
                            } else {
                              TC.setSelectedSession(session);
                              TC.setIsSessionExitFormOpen(true);
                            }
                          }}
                        >
                          {session.status === "Unconfirmed" ? "Submit overdue SEF" : "Undo"}
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
          <span>{TC.filteredPastSessions.length} row(s) total.</span>
          <div className="flex items-center space-x-2">
            <span>Rows per page</span>
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
              Page {TC.currentPagePastSessions} of {totalPages}
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
                Tutoring Session with {session.student?.firstName} {session.student?.lastName}
              </div>
              <SessionStatusBadge status={session.status} className="whitespace-nowrap" />
            </div>
            <div className="text-sm text-muted-foreground">{formatSessionDate(session.date)}</div>
            <div className="text-sm">Duration: {formatSessionDuration(session.duration)}</div>
            <div className="flex flex-wrap items-center gap-1">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => setNotesSession(session)}>
                      View Session Notes
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (
                          session.status === "Complete" ||
                          session.status === "Student Did Not Attend"
                        ) {
                          handleUndoSessionExitForm(session.id);
                        } else {
                          TC.setSelectedSession(session);
                          TC.setIsSessionExitFormOpen(true);
                        }
                      }}
                    >
                      {session.status === "Unconfirmed" ? "Submit overdue SEF" : "Undo"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </MobileCard>
        ))}
        <LoadMoreButton hasMore={!!hasMore} onClick={() => loadMore?.()} />
      </div>

      {/* One dialog shared by every row, opened from the row's Actions menu */}
      <Dialog open={!!notesSession} onOpenChange={(open) => !open && setNotesSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meeting Notes</DialogTitle>
          </DialogHeader>
          <Textarea readOnly value={notesSession?.session_exit_form ?? ""} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CompletedSessionsTable;
