"use client";
import React, { use, useState, useEffect, useMemo } from "react";
import { AlarmClockMinus, MessageCircleIcon, Search, Timer, TimerOff } from "lucide-react";
import { formatDateAdmin, formatDateUTC, formatSessionDuration } from "@/lib/utils";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash,
  RefreshCw,
  ChevronsUpDown,
  Copy,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  getAllEnrollments,
  getAllProfiles,
  getMeetings,
  pauseEnrollmentOverSummer,
} from "@/lib/actions/admin.actions";
import { addEnrollment } from "@/lib/actions/enrollment/server.actions";
import { removeEnrollment, updateEnrollment } from "@/lib/actions/enrollment/server.actions";
import { Enrollment, Profile, Event, Meeting, Availability } from "@/types";
import toast from "react-hot-toast";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkAvailableMeetingForEnrollments } from "@/lib/actions/meeting/client.actions";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import { formatDateServer } from "@/lib/actions/utils.server.actions";
import { QueryClient } from "@tanstack/react-query";
import { getEnrollmentAvailability, getEnrollmentScheduleFields } from "@/lib/enrollment-schedule";
import EnrollmentFormDialog from "@/components/shared/enrollment/EnrollmentFormDialog";
import DeleteEnrollmentDialog from "@/components/shared/enrollment/DeleteEnrollmentDialog";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/hooks/useLoadMore";
import { ResponsiveList, ResponsiveListColumn } from "@/components/ui/responsive-list";
// import Availability from "@/components/student/AvailabilityFormat";

const durationSchema = z.object({
  duration: z.coerce
    .number()
    .int()
    .positive("Duration must be a positive number")
    .min(0, "Duration must be at least 0"),
});

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const timeToMinutes = (time?: string | null) => {
  if (!time) return null;

  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
};

const enrollmentMatchesTimeFilter = (
  enrollment: Enrollment,
  dayFilter: string,
  startFilter: string,
  endFilter: string,
) => {
  const hasDayFilter = dayFilter !== "all";
  const filterStart = timeToMinutes(startFilter);
  const filterEnd = timeToMinutes(endFilter);
  const hasTimeFilter = filterStart !== null || filterEnd !== null;

  if (!hasDayFilter && !hasTimeFilter) return true;

  const { day, startTime, endTime } = enrollment;

  if (hasDayFilter && day !== dayFilter) return false;
  if (!hasTimeFilter) return true;

  const enrollmentStart = timeToMinutes(startTime);
  const enrollmentEnd = timeToMinutes(endTime);
  if (enrollmentStart === null || enrollmentEnd === null) return false;

  const rangeStart = filterStart ?? 0;
  const rangeEnd = filterEnd ?? 24 * 60;
  if (rangeStart >= rangeEnd) return false;

  return enrollmentStart < rangeEnd && enrollmentEnd > rangeStart;
};

const EnrollmentList = ({
  enrollmentsPromise,
  meetingsPromise,
  studentsPromise,
  tutorsPromise,
  weeklySchedulesPromise,
}: any) => {
  const combinedPromise = useMemo(
    () =>
      Promise.all([
        enrollmentsPromise,
        meetingsPromise,
        studentsPromise,
        tutorsPromise,
        weeklySchedulesPromise,
      ]),
    [enrollmentsPromise, meetingsPromise, studentsPromise, tutorsPromise, weeklySchedulesPromise],
  );

  const [
    initialEnrollments,
    initialMeetings,
    initialStudents,
    initialTutors,
    initialWeeklySchedules,
  ] = use(combinedPromise);

  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [filteredEnrollments, setFilteredEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [students, setStudents] = useState<Profile[]>(initialStudents);
  const [tutors, setTutors] = useState<Profile[]>(initialTutors);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);

  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const [selectedTutorId, setSelectedTutorId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterValue, setFilterValue] = useState("");
  const [timeFilterDay, setTimeFilterDay] = useState("all");
  const [timeFilterStart, setTimeFilterStart] = useState("");
  const [timeFilterEnd, setTimeFilterEnd] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCheckingMeetingAvailability, setIsCheckingMeetingAvailability] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [newEnrollment, setNewEnrollment] = useState<Omit<Enrollment, "id" | "createdAt">>({
    student: {} as Profile, // Initialize as an empty Profile
    tutor: {} as Profile, // Initialize as an empty Profile
    summary: "",
    startDate: "",
    endDate: null,
    day: null,
    startTime: null,
    endTime: null,
    meetingId: "",
    paused: false,
    duration: 1,
    frequency: "weekly",
  });
  const [availabilityList, setAvailabilityList] = useState<Availability[]>([]);
  const [meetingAvailability, setMeetingAvailability] = useState<{
    [key: string]: boolean;
  }>({});
  const weeklySchedules: WeeklyMeetingSchedule[] = initialWeeklySchedules ?? [];

  const [hoursError, setHoursError] = useState<string | null>(null);
  const [editHoursError, setEditHoursError] = useState<string | null>(null);
  const [minutesError, setMinutesError] = useState<string | null>(null);
  const [editMinutesError, setEditMinutesError] = useState<string | null>();

  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const filtered = enrollments.filter((enrollment) => {
      const searchTerm = filterValue.toLowerCase().trim();

      const studentFirstName = enrollment.student?.firstName?.toLowerCase() || "";
      const studentLastName = enrollment.student?.lastName?.toLowerCase() || "";
      const studentEmail = enrollment.student?.email?.toLowerCase() || "";

      const tutorFirstName = enrollment.tutor?.firstName?.toLowerCase() || "";
      const tutorLastName = enrollment.tutor?.lastName?.toLowerCase() || "";
      const tutorEmail = enrollment.tutor?.email?.toLowerCase() || "";

      const matchesSearch =
        !searchTerm ||
        studentFirstName.includes(searchTerm) ||
        studentLastName.includes(searchTerm) ||
        studentEmail.includes(searchTerm) ||
        tutorFirstName.includes(searchTerm) ||
        tutorLastName.includes(searchTerm) ||
        tutorEmail.includes(searchTerm) ||
        (studentFirstName + " " + studentLastName).includes(searchTerm) ||
        (tutorFirstName + " " + tutorLastName).includes(searchTerm);

      return (
        matchesSearch &&
        enrollmentMatchesTimeFilter(enrollment, timeFilterDay, timeFilterStart, timeFilterEnd)
      );
    });
    setFilteredEnrollments(filtered);
    setCurrentPage(1);
  }, [filterValue, enrollments, timeFilterDay, timeFilterStart, timeFilterEnd]);

  const normalizeText = (text: string) => text.toLowerCase().trim();

  const checkMeetingAvailabilities = async (enroll: Omit<Enrollment, "id" | "createdAt">) => {
    setIsCheckingMeetingAvailability(true);

    const updatedMeetingAvailability = await checkAvailableMeetingForEnrollments(
      enroll,
      enrollments,
      meetings,
      weeklySchedules,
    );
    setIsCheckingMeetingAvailability(false);
    setMeetingAvailability(updatedMeetingAvailability);
  };

  const fetchMeetings = async () => {
    try {
      const fetchedMeetings = await getMeetings();
      if (fetchedMeetings) {
        setMeetings(fetchedMeetings);
      }
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
      toast.error("Failed to load meetings");
    }
  };

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      setError(null);

      const enrollmentsData = await getAllEnrollments();
      if (!enrollmentsData) throw new Error("No enrollments found");

      const sortedEnrollments = enrollmentsData.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );

      setEnrollments(sortedEnrollments);
      setFilteredEnrollments(sortedEnrollments);
    } catch (error) {
      console.error("Error fetching enrollment data:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      setIsCheckingMeetingAvailability(true); // Ensures that new enrollments are not accidentally added when unable to check for available meeting links
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const studentsData = await getAllProfiles("Student", null, null, "Active");
      const tutorsData = await getAllProfiles("Tutor", null, null, "Active");
      if (studentsData) setStudents(studentsData);
      if (tutorsData) setTutors(tutorsData);
    } catch (error) {
      console.error("Error fetching profiles in EnrollmentsMangement.tsx:", error);
    }
  };

  const totalPages = Math.ceil(filteredEnrollments.length / rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const paginatedEnrollments = filteredEnrollments.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const {
    visibleItems: visibleEnrollments,
    hasMore: hasMoreEnrollments,
    loadMore: loadMoreEnrollments,
  } = useLoadMore(filteredEnrollments);

  const calculateDuration = (hours: number, minutes: number) => {
    return parseFloat((hours + minutes / 60.0).toFixed(2));
  };

  const validateDuration = (value: string, isEdit: boolean = false, unit: "hours" | "minutes") => {
    try {
      durationSchema.parse({ duration: value });
      if (isEdit) {
        unit == "hours" ? setEditHoursError(null) : setEditMinutesError(null);
      } else {
        unit == "hours" ? setHoursError(null) : setMinutesError(null);
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors[0]?.message || "Invalid duration";
        if (isEdit) {
          unit == "hours" ? setEditHoursError(errorMessage) : setEditMinutesError(errorMessage);
        } else {
          unit == "hours" ? setHoursError(errorMessage) : setMinutesError(errorMessage);
        }
      }
    }
  };

  const handleInputChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

    if (name === "hours") {
      const numericValue = value.replace(/[^0-9]/g, "");
      const newHours = numericValue ? parseFloat(numericValue) : 0;

      const newDuration = calculateDuration(newHours, minutes);
      setHours(newHours);

      if (isEditModalOpen) {
        validateDuration(numericValue, true, "hours");
        setSelectedEnrollment((prev) => (prev ? { ...prev, duration: newDuration || 0 } : null));
      } else {
        validateDuration(numericValue, false, "hours");
        setNewEnrollment((prev) => ({
          ...prev,
          duration: newDuration || 0,
        }));
      }
      return;
    }

    if (name == "minutes") {
      const numericValue = value.replace(/[^0-9]/g, "");
      const newMinutes = numericValue ? parseFloat(numericValue) : 0;

      const newDuration = calculateDuration(hours, newMinutes);
      setMinutes(newMinutes);

      if (selectedEnrollment) {
        validateDuration(numericValue, true, "minutes");
        setSelectedEnrollment((prev) => (prev ? { ...prev, duration: newDuration || 0 } : null));
      } else {
        validateDuration(numericValue, false, "minutes");
        setNewEnrollment((prev) => ({
          ...prev,
          duration: newDuration || 0,
        }));
      }
      return;
    }

    // Helper function to handle nested updates
    const handleNestedChange = (obj: any, key: string, value: any) => {
      const keys = key.split("."); // Split key by dot notation (e.g., 'tutor.id')
      let temp = obj;

      keys.forEach((k, index) => {
        if (index === keys.length - 1) {
          // Final key, update its value
          temp[k] = value;
        } else {
          // Traverse nested objects
          temp[k] = temp[k] || {};
          temp = temp[k];
        }
      });

      return { ...obj };
    };

    if (selectedEnrollment) {
      setSelectedEnrollment((prevState) => handleNestedChange({ ...prevState }, name, value));
    } else {
      setNewEnrollment((prevState) => handleNestedChange({ ...prevState }, name, value));
    }
  };

  const handleInputSelectionChange = (value: string, type: "add" | "edit") => {
    const frequency = value as Enrollment["frequency"];
    {
      type === "add"
        ? setNewEnrollment((prev) => ({ ...prev, frequency }))
        : setSelectedEnrollment((prev) => (prev ? { ...prev, frequency } : null));
    }
  };

  const handleAvailabilityChange = (availability: Availability[], type: "add" | "edit") => {
    const scheduleFields = getEnrollmentScheduleFields(availability[0]);

    if (type === "add") {
      setAvailabilityList(availability);
      setNewEnrollment((prev) => ({
        ...prev,
        ...scheduleFields,
      }));
      return;
    }

    setSelectedEnrollment((prev) =>
      prev
        ? {
            ...prev,
            ...scheduleFields,
          }
        : null,
    );
  };

  const handleStudentSelect = (student: Profile) => {
    setSelectedStudentId(student.id);
    handleInputChange({ target: { name: "student.id", value: student.id } });
  };

  const handleTutorSelect = (tutor: Profile) => {
    setSelectedTutorId(tutor.id);
    handleInputChange({ target: { name: "tutor.id", value: tutor.id } });
  };

  const handleAddEnrollment = async () => {
    try {
      const addedEnrollment = await addEnrollment(newEnrollment);
      if (addedEnrollment) {
        setEnrollments([{ ...addedEnrollment, paused: false }, ...enrollments]);
        setIsAddModalOpen(false);
        resetNewEnrollment();
        setSelectedTutorId("");
        setSelectedStudentId("");
        setAvailabilityList([]);
        toast.success("Enrollment added successfully");
      }
    } catch (error) {
      console.error("Error adding enrollment:", error);
      toast.error(`${error}`);
    }
  };

  const handleUpdateEnrollment = async () => {
    if (selectedEnrollment) {
      try {
        const updatedEnrollment = await updateEnrollment(selectedEnrollment);
        if (updatedEnrollment) {
          setEnrollments(
            enrollments.map((e: Enrollment) =>
              e.id === updatedEnrollment.id ? updatedEnrollment : e,
            ) as Enrollment[],
          ); // Explicitly cast as Enrollment[]
        }
        setIsEditModalOpen(false);
        setSelectedEnrollment(null);
        toast.success("Enrollment updated successfully");
        fetchEnrollments(); // reload Enrollments
      } catch (error) {
        console.error("Error updating enrollment:", error);
        toast.error("Failed to update enrollment");
      }
    }
  };

  const handleDeleteEnrollment = async () => {
    if (selectedEnrollment) {
      try {
        await removeEnrollment(selectedEnrollment.id);
        setEnrollments(enrollments.filter((e) => e.id !== selectedEnrollment.id));
        setIsDeleteModalOpen(false);
        setSelectedEnrollment(null);
        toast.success("Enrollment deleted successfully");
      } catch (error) {
        console.error("Error deleting enrollment:", error);
        toast.error("Failed to delete enrollment");
      }
    }
  };

  const resetNewEnrollment = () => {
    setNewEnrollment({
      student: {} as Profile,
      tutor: {} as Profile,
      summary: "",
      startDate: "",
      endDate: null,
      day: null,
      startTime: null,
      endTime: null,
      meetingId: "",
      paused: false,
      duration: 1,
      frequency: "weekly",
    });
  };

  const handlePausePairingOverSummer = async (updatedEnrollment: Enrollment) => {
    try {
      setEnrollments((prev) =>
        prev.map((enrollment) =>
          enrollment.id === updatedEnrollment.id ? updatedEnrollment : enrollment,
        ),
      );

      await pauseEnrollmentOverSummer(updatedEnrollment);
      toast.success("Enrollment summer plan changed");
    } catch (error) {
      console.error("Unable to pause pairing over summer", error);
    }
  };
  const handleCopyMeetingLink = (meetingId: string) => {
    const meeting = meetings.find((m) => String(m.id) === String(meetingId));

    if (!meeting) {
      toast.error("Meeting not found");
      return;
    }

    const url = meeting.link;

    if (!url) {
      toast.error("No Zoom link available");
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Meeting link copied!"))
      .catch(() => toast.error("Failed to copy link"));
  };

  const renderStatusToggle = (enrollment: Enrollment, size?: "sm") => (
    <Button
      variant="ghost"
      size={size ?? "icon"}
      onClick={() => {
        const updatedEnrollment = { ...enrollment, summerPaused: !enrollment.paused };
        handlePausePairingOverSummer(updatedEnrollment);
      }}
    >
      {enrollment.paused ? (
        <span className="px-3 py-1 inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200">
          <TimerOff size={14} className="mr-1" />
          Paused
        </span>
      ) : (
        <span className="px-3 py-1 inline-flex items-center rounded-full bg-connect-me-blue-1 text-connect-me-black border border-connect-me-blue-3">
          <Timer size={14} className="mr-1" />
          Ongoing
        </span>
      )}
    </Button>
  );

  const renderActivityButton = (enrollment: Enrollment) => (
    <Button variant="outline" size="sm" className="gap-2" asChild>
      <Link href={`/dashboard/enrollments/${enrollment.id}/activity`}>
        <Activity className="h-4 w-4" />
        Activity
      </Link>
    </Button>
  );

  const columns: ResponsiveListColumn<Enrollment>[] = [
    {
      key: "student",
      header: "Student",
      cell: (enrollment) => `${enrollment.student?.firstName} ${enrollment.student?.lastName}`,
      mobileCell: null,
    },
    {
      key: "tutor",
      header: "Tutor",
      cell: (enrollment) => `${enrollment.tutor?.firstName} ${enrollment.tutor?.lastName}`,
      mobileCell: null,
    },
    {
      key: "availability",
      header: "Availability",
      cell: (enrollment) => (
        <AvailabilityFormat availability={getEnrollmentAvailability(enrollment)} card={false} />
      ),
      cellClassName: "colspan-[40px]",
    },
    {
      key: "summary",
      header: "Summary",
      cell: (enrollment) => enrollment.summary,
      mobileLabel: "Summary",
      mobileGroup: "details",
    },
    {
      key: "startDate",
      header: "Start Date",
      cell: (enrollment) =>
        formatDateUTC(enrollment.startDate, { includeTime: false, includeDate: true }),
      mobileLabel: "Start Date",
      mobileGroup: "details",
    },
    {
      key: "meetingLink",
      header: "Meeting Link",
      cell: (enrollment) => {
        const meeting = meetings.find((m) => String(m.id) === String(enrollment.meetingId));
        if (!meeting) return "No Meeting Link";
        return (
          <button
            type="button"
            onClick={() => handleCopyMeetingLink(meeting.id)}
            className="relative inline-flex items-center group cursor-pointer"
          >
            <span className="underline text-black-600 transition-opacity duration-150 group-hover:opacity-0">
              {meeting.name}
            </span>
            <Copy
              className="
                absolute
                left-1/2 -translate-x-1/2
                w-4 h-4
                text-gray-700
                opacity-0
                transition-opacity duration-150
                group-hover:opacity-100
                pointer-events-none
              "
            />
          </button>
        );
      },
      mobileLabel: "Meeting Link",
      mobileGroup: "details",
      mobileCell: (enrollment) => {
        const meeting = meetings.find((m) => String(m.id) === String(enrollment.meetingId));
        if (!meeting) return "No Meeting Link";
        return (
          <button
            type="button"
            onClick={() => handleCopyMeetingLink(meeting.id)}
            className="underline text-black-600"
          >
            {meeting.name}
          </button>
        );
      },
    },
    {
      key: "duration",
      header: "Duration",
      cell: (enrollment) => `${formatSessionDuration(enrollment.duration)} hr(s)`,
      mobileLabel: "Duration",
      mobileGroup: "details",
    },
    {
      key: "frequency",
      header: "Frequency",
      cell: (enrollment) => enrollment.frequency,
      mobileLabel: "Frequency",
      mobileGroup: "details",
    },
    {
      key: "actions",
      header: "Actions",
      cell: (enrollment) => (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedEnrollment(enrollment);
              setSelectedStudentId(enrollment.student?.id ?? "");
              setSelectedTutorId(enrollment.tutor?.id ?? "");
              setIsEditModalOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedEnrollment(enrollment);
              setIsDeleteModalOpen(true);
            }}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </>
      ),
      mobileCell: null,
    },
    {
      key: "status",
      header: "Status",
      cell: (enrollment) => renderStatusToggle(enrollment),
      mobileCell: null,
    },
    {
      key: "activity",
      header: "Activity",
      cell: (enrollment) => renderActivityButton(enrollment),
      mobileCell: null,
    },
    {
      key: "chat",
      header: "Chat",
      cell: (enrollment) => (
        <Button
          className="gap-2"
          onClick={() => router.push(`/dashboard/enrollment/${enrollment.id}/chat`)}
          variant="outline"
        >
          View Chat
          <MessageCircleIcon />
        </Button>
      ),
      mobileCell: null,
    },
  ];

  const renderMobileEnrollmentFooter = (enrollment: Enrollment) => (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {renderStatusToggle(enrollment, "sm")}
      {renderActivityButton(enrollment)}
      <Button
        className="gap-2"
        size="sm"
        onClick={() => router.push(`/dashboard/enrollment/${enrollment.id}/chat`)}
        variant="outline"
      >
        <MessageCircleIcon className="h-4 w-4" />
        View Chat
      </Button>
    </div>
  );

  return (
    <>
      {" "}
      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                placeholder="Filter enrollments..."
                className="w-64"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
              <Select value={timeFilterDay} onValueChange={setTimeFilterDay}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by day">
                  <SelectValue placeholder="Any day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any day</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                aria-label="Filter time from"
                title="From time"
                className="w-[120px]"
                value={timeFilterStart}
                onChange={(e) => setTimeFilterStart(e.target.value)}
              />
              <Input
                type="time"
                aria-label="Filter time to"
                title="To time"
                className="w-[120px]"
                value={timeFilterEnd}
                onChange={(e) => setTimeFilterEnd(e.target.value)}
              />
              {(filterValue || timeFilterDay !== "all" || timeFilterStart || timeFilterEnd) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterValue("");
                    setTimeFilterDay("all");
                    setTimeFilterStart("");
                    setTimeFilterEnd("");
                  }}
                >
                  Clear
                </Button>
              )}
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Enrollment
                  </Button>
                </DialogTrigger>
                <EnrollmentFormDialog
                  mode="add"
                  context="admin"
                  enrollment={newEnrollment}
                  onInputChange={handleInputChange}
                  onFrequencyChange={(value) => handleInputSelectionChange(value, "add")}
                  availabilityList={availabilityList}
                  onAvailabilityChange={(availability) =>
                    handleAvailabilityChange(availability, "add")
                  }
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onStudentSelect={handleStudentSelect}
                  tutors={tutors}
                  selectedTutorId={selectedTutorId}
                  onTutorSelect={handleTutorSelect}
                  meetings={meetings}
                  meetingAvailability={meetingAvailability}
                  isCheckingMeetingAvailability={isCheckingMeetingAvailability}
                  onMeetingDropdownOpen={() => checkMeetingAvailabilities(newEnrollment)}
                  onSubmit={handleAddEnrollment}
                />
              </Dialog>
            </div>
          </div>
          <ResponsiveList
            columns={columns}
            rows={paginatedEnrollments}
            mobileRows={visibleEnrollments}
            rowKey={(enrollment) => enrollment.id}
            mobileTitle={(enrollment) =>
              `${enrollment.student?.firstName} ${enrollment.student?.lastName}`
            }
            mobileSubtitle={(enrollment) =>
              `with ${enrollment.tutor?.firstName} ${enrollment.tutor?.lastName}`
            }
            mobileAction={(enrollment) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedEnrollment(enrollment);
                    setSelectedStudentId(enrollment.student?.id ?? "");
                    setSelectedTutorId(enrollment.tutor?.id ?? "");
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedEnrollment(enrollment);
                    setIsDeleteModalOpen(true);
                  }}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            )}
            mobileCardFooter={(enrollment) => renderMobileEnrollmentFooter(enrollment)}
            mobileFooter={
              <LoadMoreButton hasMore={hasMoreEnrollments} onClick={loadMoreEnrollments} />
            }
          />
          <div className="hidden md:flex justify-between mt-4">
            <span>{filteredEnrollments.length} row(s) total.</span>
            <div className="flex items-center space-x-2">
              <span>Rows per page</span>
              <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder={rowsPerPage.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((value) => (
                    <SelectItem key={value} value={value.toString()}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex space-x-1">
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
      </div>
      {/* Edit Enrollment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <EnrollmentFormDialog
          mode="edit"
          context="admin"
          enrollment={selectedEnrollment}
          onInputChange={handleInputChange}
          onFrequencyChange={(value) => handleInputSelectionChange(value, "edit")}
          availabilityList={selectedEnrollment ? getEnrollmentAvailability(selectedEnrollment) : []}
          onAvailabilityChange={(availability) => handleAvailabilityChange(availability, "edit")}
          students={students}
          selectedStudentId={selectedStudentId}
          onStudentSelect={handleStudentSelect}
          tutors={tutors}
          selectedTutorId={selectedTutorId}
          onTutorSelect={handleTutorSelect}
          meetings={meetings}
          meetingAvailability={meetingAvailability}
          isCheckingMeetingAvailability={isCheckingMeetingAvailability}
          onMeetingDropdownOpen={() =>
            selectedEnrollment && checkMeetingAvailabilities(selectedEnrollment)
          }
          onSubmit={handleUpdateEnrollment}
        />
      </Dialog>
      {/* Delete Enrollment Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DeleteEnrollmentDialog
          enrollment={selectedEnrollment}
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteEnrollment}
        />
      </Dialog>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
    </>
  );
};

export default EnrollmentList;
