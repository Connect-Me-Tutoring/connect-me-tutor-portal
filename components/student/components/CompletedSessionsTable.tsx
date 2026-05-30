import React from "react";
import { useState } from "react";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mark Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Tutor</TableHead>
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
                Tutoring Session with {session.tutor?.firstName}{" "}
                {session.tutor?.lastName}
              </TableCell>
              <TableCell>
                {session.tutor?.firstName} {session.tutor?.lastName}
              </TableCell>

              <TableCell>
                <Dialog
                  open={isMeetingNotesOpen}
                  onOpenChange={setIsMeetingNotesOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsMeetingNotesOpen(true);
                        SC.setSelectedSession(session);
                      }}
                    >
                      View Session Notes
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Meeting Notes</DialogTitle>
                    </DialogHeader>
                    <Textarea>{SC.selectedSession?.session_exit_form}</Textarea>
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 flex justify-between items-center">
        <span>{SC.filteredSessions.length} row(s) total.</span>
        <div className="flex items-center space-x-2">
          <span>Rows per page</span>
          <Select
            value={SC.rowsPerPage.toString()}
            onValueChange={handleRowsPerPageChange}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={SC.rowsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
            </SelectContent>
          </Select>
          <span>
            Page {SC.currentPage} of {totalPages}
          </span>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(1)}
              disabled={SC.currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(SC.currentPage - 1)}
              disabled={SC.currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              onClick={() => handlePageChange(SC.currentPage + 1)}
              disabled={SC.currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(totalPages)}
              disabled={SC.currentPage === totalPages}
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
