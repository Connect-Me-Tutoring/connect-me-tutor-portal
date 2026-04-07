"use client";
import React from "react";
import { useState } from "react";
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
  Trash,
  CalendarDays,
  UserRoundPlus,
  Clock,
  CircleCheckBig,
  CircleX,
  Copy,
  Ellipsis,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import SessionExitForm from "./SessionExitForm";
import RescheduleForm from "./RescheduleDialog";
import CancellationForm from "./CancellationForm";
import { boolean } from "zod";
import { useDashboardContext } from "@/contexts/dashboardContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ActiveSessionsTable = ({
  paginatedSessions,
  meetings,
  totalPages,
  setNextClassConfirmed,
  handleStatusChange,
  handleReschedule,
  handleSessionComplete,
  handlePageChange,
  handleRowsPerPageChange,
  handleInputChange,
}: any) => {
  const TC = useDashboardContext();

  return (
    <>
<div className="md:hidden flex-col space-y-4 mb-4 items-center">
  {paginatedSessions.map((session: Session, index: number) => (
    <div
      key={index}
      className="bg-white border rounded-xl shadow px-4] px-3 py-4 w-full max-w-[300px] space-y-2"
    >
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-base">
          {session.student?.firstName} {session.student?.lastName}
        </h2>

        <span className="text-xs px-1 py-1 rounded bg-gray-100">
          {session.status}
        </span>
      </div>

      <p className="text-sm text-gray-500">
        {formatSessionDate(session.date)}
      </p>

      <p className="text-sm">
        {formatSessionDuration(session.duration)}
      </p>

      {session.environment !== "In-Person" && (
        <>
          {session?.meeting?.meetingId ? (
            <button
              onClick={() =>
                (window.location.href = `/meeting/${session?.meeting?.id}`)
              }
              className="bg-blue-500 text-white px-2 py-1 rounded text-sm w-full"
            >
              View Meeting
            </button>
          ) : (
            <span className="text-sm text-gray-400">No Meeting</span>
          )}
        </>
      )}

      <SessionExitForm
        currSession={session}
        setNextClassConfirmed={setNextClassConfirmed}
        handleSessionComplete={handleSessionComplete}
        handleStatusChange={handleStatusChange}
      />
    </div>
  ))}
</div>

      <div className="hidden md:block">
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
            {paginatedSessions.map((session: Session, index: number) => (
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

                <TableCell>
                  {formatSessionDate(session.date)}
                </TableCell>

                <TableCell className="font-medium">
                  Tutoring Session with {session.student?.firstName}{" "}
                  {session.student?.lastName}
                </TableCell>

                <TableCell>
                  {session.student?.firstName}{" "}
                  {session.student?.lastName}
                </TableCell>

                <TableCell>
                  {formatSessionDuration(session.duration)}
                </TableCell>

                <TableCell>
                  {session.environment !== "In-Person" && (
                    <>
                      {session?.meeting?.meetingId ? (
                        <button
                          onClick={() =>
                            (window.location.href = `/meeting/${session?.meeting?.id}`)
                          }
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          View
                        </button>
                      ) : (
                        <button className="border px-3 py-1 rounded">
                          N/A
                        </button>
                      )}
                    </>
                  )}
                </TableCell>

                <TableCell>
                  <SessionExitForm
                    currSession={session}
                    setNextClassConfirmed={setNextClassConfirmed}
                    handleSessionComplete={handleSessionComplete}
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
                        <DropdownMenuLabel>
                          Actions
                        </DropdownMenuLabel>

                        <DropdownMenuItem
                          onClick={() => {
                            TC.setSelectedSession(session);
                            TC.setIsDialogOpen(true);
                            TC.setSelectedSessionDate(session.date);
                          }}
                        >
                          <Dialog
                            open={TC.isDialogOpen}
                            onOpenChange={TC.setIsDialogOpen}
                          >
                            <RescheduleForm
                              selectedSession={TC.selectedSession}
                              selectedSessionDate={
                                TC.selectedSessionDate
                              }
                              meetings={meetings}
                              setSelectedSessionDate={
                                TC.setSelectedSessionDate
                              }
                              handleInputChange={handleInputChange}
                              handleReschedule={handleReschedule}
                            />
                          </Dialog>
                          <CalendarDays className="h-4 w-4 mr-2" />
                          Reschedule
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() =>
                            (window.location.href =
                              "https://forms.gle/AC4an7K6NSNumDwKA")
                          }
                        >
                          <UserRoundPlus className="h-4 w-4 mr-2" />
                          Request Substitute
                        </DropdownMenuItem>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) =>
                                e.preventDefault()
                              }
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Trash
                            </DropdownMenuItem>
                          </AlertDialogTrigger>

                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Cancel Session?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this session?
                              </AlertDialogDescription>
                            </AlertDialogHeader>

                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleStatusChange(session)
                                }
                              >
                                Confirm
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
      </div>

      <div className="mt-4 flex justify-between items-center">
        <span>{TC.filteredSessions.length} row(s) total.</span>

        <div className="flex items-center space-x-2">
          <span>Rows per page</span>

          <Select
            value={TC.rowsPerPage.toString()}
            onValueChange={handleRowsPerPageChange}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue
                placeholder={TC.rowsPerPage.toString()}
              />
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
            <Button onClick={() => handlePageChange(1)}>
              <ChevronsLeft />
            </Button>
            <Button
              onClick={() =>
                handlePageChange(TC.currentPage - 1)
              }
            >
              <ChevronLeft />
            </Button>
            <Button
              onClick={() =>
                handlePageChange(TC.currentPage + 1)
              }
            >
              <ChevronRight />
            </Button>
            <Button
              onClick={() => handlePageChange(totalPages)}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ActiveSessionsTable;