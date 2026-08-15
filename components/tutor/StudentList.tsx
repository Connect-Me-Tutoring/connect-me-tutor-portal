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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import { StudentAnnouncementsRoomId } from "@/constants/chat";
import { UserAvailabilities } from "../ui/UserAvailabilities";
import DeletePairingForm from "./components/DeletePairingForm";
import { useProfile } from "@/lib/contexts/profileContext";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/hooks/useLoadMore";
import { ResponsiveList, ResponsiveListColumn } from "@/components/ui/responsive-list";

const StudentList = ({ initialStudents }: any) => {
  const supabase = createClient();
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

  const {
    visibleItems: visibleStudents,
    hasMore: hasMoreStudents,
    loadMore: loadMoreStudents,
  } = useLoadMore(filteredStudents);

  const columns: ResponsiveListColumn<Profile>[] = [
    {
      key: "startDate",
      header: "Start Date",
      cell: (student) => student.startDate,
      mobileLabel: "Start Date",
      mobileClassName: "text-sm text-muted-foreground",
    },
    {
      key: "name",
      header: "Student Name",
      cell: (student) => `${student.firstName} ${student.lastName}`,
      mobileCell: null,
    },
    {
      key: "availability",
      header: "Availability",
      cell: (student) => <UserAvailabilities user={student} />,
    },
    {
      key: "subjects",
      header: "Subjects",
      cell: (student) => (
        <div className="flex flex-col">
          {student.subjects_of_interest?.map((subject, i) => (
            <span key={i}>{subject}</span>
          ))}
        </div>
      ),
      mobileCell: (student) =>
        student.subjects_of_interest?.length > 0 && (
          <>
            <div className="font-medium">Subjects:</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {student.subjects_of_interest.map((subject, i) => (
                <span key={i} className="px-2 py-1 text-xs bg-muted rounded-md">
                  {subject}
                </span>
              ))}
            </div>
          </>
        ),
    },
    {
      key: "email",
      header: "Student Email",
      cell: (student) => student.email,
      mobileLabel: "Email",
      mobileGroup: "contact",
    },
    {
      key: "parentEmail",
      header: "Parent Email",
      cell: (student) => student.parentEmail,
      mobileLabel: "Parent Email",
      mobileGroup: "contact",
    },
    {
      key: "parentPhone",
      header: "Parent Phone",
      cell: (student) => student.parentPhone,
      mobileLabel: "Parent Phone",
      mobileGroup: "contact",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (student) => <DeletePairingForm student={student} tutor={profile} />,
      mobileCell: null,
    },
  ];

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

      <ResponsiveList
        columns={columns}
        rows={paginatedStudents}
        mobileRows={visibleStudents}
        rowKey={(student, index) => index}
        tableClassName="min-w-[1100px]"
        desktopWrapperClassName="overflow-x-auto rounded-lg border"
        mobileTitle={(student) => `${student.firstName} ${student.lastName}`}
        mobileAction={(student) => <DeletePairingForm student={student} tutor={profile} />}
        mobileFooter={<LoadMoreButton hasMore={hasMoreStudents} onClick={loadMoreStudents} />}
      />
      <div className="hidden md:flex justify-between mt-4">
        <span>{filteredStudents.length} row(s) total.</span>

        <div className="flex items-center space-x-2">
          <span>Rows per page</span>
          <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
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
