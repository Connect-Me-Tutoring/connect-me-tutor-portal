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
import { useDashboardContext } from "@/contexts/dashboardContext";

const CompletedSessionsTable = ({
  paginatedSessions,
  totalPages,
  handlePageChange,
  handleRowsPerPageChange,
  handleUndoSessionExitForm,
}: any) => {
  const TC = useDashboardContext();
  const [isMeetingNotesOpen, setIsMeetingNotesOpen] = useState(false);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mark Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Meeting Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedSessions.map((session: Session, index: number) => (
            <TableRow key={index}>
              <TableCell>
                {session.status === "Complete" ? (
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
                Tutoring Session with {session.student?.firstName}{" "}
                {session.student?.lastName}
              </TableCell>
              <TableCell>
                {session.student?.firstName} {session.student?.lastName}
              </TableCell>
              <TableCell>{formatSessionDuration(session.duration)}</TableCell>
              <TableCell>
                <div className="flex flex-col space-y-2">
                  <Dialog
                    open={isMeetingNotesOpen}
                    onOpenChange={setIsMeetingNotesOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setIsMeetingNotesOpen(true);
                          TC.setSelectedSession(session);
                        }}
                      >
                        View Session Notes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Meeting Notes</DialogTitle>
                      </DialogHeader>
                      <Textarea readOnly>
                        {TC.selectedSession?.session_exit_form}
                      </Textarea>
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
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
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
                        Undo
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4 flex justify-between items-center">
        <span>{TC.filteredSessions.length} row(s) total.</span>
        <div className="flex items-center space-x-2">
          <span>Rows per page</span>
          <Select
            value={TC.rowsPerPage.toString()}
            onValueChange={handleRowsPerPageChange}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={TC.rowsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
          <span>
            Page {TC.currentPage} of {totalPages}
          </span>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(1)}
              disabled={TC.currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(TC.currentPage - 1)}
              disabled={TC.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(TC.currentPage + 1)}
              disabled={TC.currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(totalPages)}
              disabled={TC.currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompletedSessionsTable;
