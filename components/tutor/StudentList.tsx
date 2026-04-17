"use client";
import React, { useState, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  Plus,
  Link as LinkIcon,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
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
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile } from "@/types";
import { StudentAnnouncementsRoomId } from "@/constants/chat";
import { UserAvailabilities } from "../ui/UserAvailabilities";
import DeletePairingForm from "./components/DeletePairingForm";
import { useProfile } from "@/lib/contexts/profileContext";

const StudentList = ({ initialStudents }: any) => {
  const supabase = createClientComponentClient();
  const { profile, setProfile } = useProfile();
  const [students, setStudents] = useState<Profile[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Profile[]>([]); // New state for filtered students
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterValue, setFilterValue] = useState("");

  useEffect(() => {
    setStudents(initialStudents);
    setFilteredStudents(initialStudents);
  }, [supabase.auth]);

  useEffect(() => {
    const filtered = students.filter(
      (student) =>
        student.firstName.toLowerCase().includes(filterValue.toLowerCase()) ||
        student.lastName.toLowerCase().includes(filterValue.toLowerCase()),
    );
    setFilteredStudents(filtered); // Update filteredStudents instead of students
    setCurrentPage(1);
  }, [filterValue, students]);

  const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <Input
          type="text"
          placeholder="Filter students..."
          className="w-full sm:w-64"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
      </div>

      <div className="hidden md:block w-full">
        <div className="w-full overflow-x-auto rounded-lg border">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead>Start Date</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Student Email</TableHead>
                <TableHead>Parent Email</TableHead>
                <TableHead>Parent Phone</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.map((student, index) => (
                <TableRow key={index}>
                  <TableCell>{student.startDate}</TableCell>
                  <TableCell>
                    {student.firstName} {student.lastName}
                  </TableCell>
                  <TableCell>
                    <UserAvailabilities user={student} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      {student.subjects_of_interest?.map((subject, i) => (
                        <span key={i}>{subject}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{student.email}</TableCell>
                  <TableCell>{student.parentEmail}</TableCell>
                  <TableCell>{student.parentPhone}</TableCell>
                  <TableCell>
                    <DeletePairingForm student={student} tutor={profile} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="md:hidden space-y-4">
        {paginatedStudents.map((student, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow p-4 space-y-3 border"
          >
            <div className="flex justify-between items-start">
              <div className="font-semibold text-base">
                {student.firstName} {student.lastName}
              </div>
              <DeletePairingForm student={student} tutor={profile} />
            </div>
            <div className="text-sm text-muted-foreground">
              Start Date: {student.startDate}
            </div>
            <div>
              <UserAvailabilities user={student} />
            </div>
            <div className="text-sm">
              <div>Email: {student.email}</div>
              <div>Parent Email: {student.parentEmail}</div>
              <div>Parent Phone: {student.parentPhone}</div>
            </div>
            {student.subjects_of_interest?.length > 0 && (
              <div className="text-sm">
                <div className="font-medium">Subjects:</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {student.subjects_of_interest.map((subject, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-muted rounded-md"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <span>{filteredStudents.length} row(s) total.</span>

        <div className="flex items-center space-x-2">
          <span>Rows per page</span>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={handleRowsPerPageChange}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm">
            Page {currentPage} of {totalPages || 1}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentList;
