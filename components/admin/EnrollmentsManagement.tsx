"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  AlarmClockMinus,
  MessageCircleIcon,
  Search,
  Timer,
  TimerOff,
} from "lucide-react";
import {
  cn,
  formatDateAdmin,
  formatDateUTC,
  formatSessionDuration,
} from "@/lib/utils";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit,
  Trash,
  RefreshCw,
  ChevronsUpDown,
  Check,
  Circle,
  Loader2,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scrollarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  getAllEnrollments,
  getAllProfiles,
  getMeetings,
  pauseEnrollmentOverSummer,
} from "@/lib/actions/admin.actions";
import { addEnrollment } from "@/lib/actions/enrollment.server.actions";
import {
  removeEnrollment,
  updateEnrollment,
} from "@/lib/actions/enrollment.server.actions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Enrollment, Profile, Event, Meeting, Availability } from "@/types";
import toast from "react-hot-toast";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
import AvailabilityForm from "@/components/ui/availability-form";
import { formatDate } from "@/lib/utils";
import { normalize } from "path";
import { areIntervalsOverlapping, previousDay, set } from "date-fns";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkAvailableMeetingForEnrollments } from "@/lib/actions/meeting.actions";
import { formatDateServer } from "@/lib/actions/utils.server.actions";
import { QueryClient } from "@tanstack/react-query";
// import Availability from "@/components/student/AvailabilityFormat";

const durationSchema = z.object({
  duration: z.coerce
    .number()
    .int()
    .positive("Duration must be a positive number")
    .min(0, "Duration must be at least 0"),
});

const EnrollmentList = ({
  initialEnrollments,
  initialMeetings,
  initialStudents,
  initialTutors,
}: any) => {
  // data is awaited in server component now, no use() needed
  const [enrollments, setEnrollments] =
    useState<Enrollment[]>(initialEnrollments);
  const [filteredEnrollments, setFilteredEnrollments] =
    useState<Enrollment[]>(initialEnrollments);
  const [students, setStudents] = useState<Profile[]>(initialStudents);
  const [tutors, setTutors] = useState<Profile[]>(initialTutors);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);

  const supabase = createClientComponentClient();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  const [openStudentOptions, setOpenStudentOptions] = useState(false);
  const [openTutorOptions, setOpentTutorOptions] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterValue, setFilterValue] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCheckingMeetingAvailability, setIsCheckingMeetingAvailability] =
    useState(false);
  const [selectedEnrollment, setSelectedEnrollment] =
    useState<Enrollment | null>(null);
  const [newEnrollment, setNewEnrollment] = useState<
    Omit<Enrollment, "id" | "createdAt">
  >({
    student: {} as Profile, // Initialize as an empty Profile
    tutor: {} as Profile, // Initialize as an empty Profile
    summary: "",
    startDate: "",
    endDate: null,
    availability: [{ day: "", startTime: "", endTime: "" }],
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

      if (!searchTerm) return true;

      const studentFirstName =
        enrollment.student?.firstName?.toLowerCase() || "";
      const studentLastName = enrollment.student?.lastName?.toLowerCase() || "";
      const studentEmail = enrollment.student?.email?.toLowerCase() || "";

      const tutorFirstName = enrollment.tutor?.firstName?.toLowerCase() || "";
      const tutorLastName = enrollment.tutor?.lastName?.toLowerCase() || "";
      const tutorEmail = enrollment.tutor?.email?.toLowerCase() || "";

      return (
        studentFirstName.includes(searchTerm) ||
        studentLastName.includes(searchTerm) ||
        studentEmail.includes(searchTerm) ||
        tutorFirstName.includes(searchTerm) ||
        tutorLastName.includes(searchTerm) ||
        tutorEmail.includes(searchTerm) ||
        (studentFirstName + " " + studentLastName).includes(searchTerm) ||
        (tutorFirstName + " " + tutorLastName).includes(searchTerm)
      );
    });
    setFilteredEnrollments(filtered);
    setCurrentPage(1);
  }, [filterValue, enrollments]);

  const studentsMap = useMemo(() => {
    return students.reduce(
      (map, student) => {
        map[student.id] = student;
        return map;
      },
      {} as Record<string, Profile>,
    );
  }, [students]);

  const normalizeText = (text: string) => text.toLowerCase().trim();

  const toDateTime = (time: string, day: Number) => {
    if (!time) {
      return new Date(NaN);
    }
    const [hourStr, minuteStr] = time.split(":");
    const parsedDate = new Date();
    while (parsedDate.getDay() !== day) {
      parsedDate.setDate(parsedDate.getDate() + 1);
    }
    parsedDate.setHours(parseInt(hourStr), parseInt(minuteStr), 0, 0);
    return parsedDate;
  };

  const formatAvailabilityAsDate = (date: Availability): Date[] => {
    try {
      type DayName =
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday";
      const dayMap: { [key in DayName]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };

      const dayIndex = dayMap[date.day as DayName];
      if (dayIndex === undefined) {
        throw new Error("Invalid Day of the Week");
      }
      return [
        toDateTime(date.startTime, dayIndex),
        toDateTime(date.endTime, dayIndex),
      ];
    } catch (error) {
      console.error("Failed to Format Date", error);

      const date5am = new Date(2024, 1, 23, 5, 0, 0, 0);
      return [date5am, date5am];
    }
  };

  const checkMeetingAvailabilities = async (
    enroll: Omit<Enrollment, "id" | "createdAt">,
  ) => {
    setIsCheckingMeetingAvailability(true);

    const updatedMeetingAvailability =
      await checkAvailableMeetingForEnrollments(enroll, enrollments, meetings);
    setIsCheckingMeetingAvailability(false);
    setMeetingAvailability(updatedMeetingAvailability);
  };

  const isMeetingAvailable = (
    meetingId: string,
    enroll: Omit<Enrollment, "id" | "createdAt">,
  ) => {
    try {
      const now = new Date();
      const new_enrollment_date = new Date(
        `${enroll.availability[0].day} ${enroll.availability[0].endTime}`,
      );
      return !enrollments.some((enrollment) => {
        // Skip sessions without dates or meeting IDs
        if (!enrollment?.endDate || !enrollment?.meetingId) return false;

        try {
          const sessionEndTime = new Date(
            `${enrollment.availability[0].day}, ${enrollment.availability[0].endTime}`,
          );
          sessionEndTime.setHours(sessionEndTime.getHours() + 1.5);
          return (
            sessionEndTime < new_enrollment_date &&
            enrollment.meetingId === meetingId
          );
        } catch (error) {
          console.error("Error processing session date:", error);
          return false;
        }
      });
    } catch (error) {
      console.error("Error checking meeting availability:", error);
      return true; // Default to available if there's an error
    }
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
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );

      setEnrollments(sortedEnrollments);
      setFilteredEnrollments(sortedEnrollments);
    } catch (error) {
      console.error("Error fetching enrollment data:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      setIsCheckingMeetingAvailability(true); // Ensures that new enrollments are not accidentally added when unable to check for available meeting links
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const studentsData = await getAllProfiles(
        "Student",
        null,
        null,
        "Active",
      );
      const tutorsData = await getAllProfiles("Tutor", null, null, "Active");
      if (studentsData) setStudents(studentsData);
      if (tutorsData) setTutors(tutorsData);
    } catch (error) {
      console.error(
        "Error fetching profiles in EnrollmentsMangement.tsx:",
        error,
      );
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

  const calculateDuration = (hours: number, minutes: number) => {
    return parseFloat((hours + minutes / 60.0).toFixed(2));
  };

  const validateDuration = (
    value: string,
    isEdit: boolean = false,
    unit: "hours" | "minutes",
  ) => {
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
          unit == "hours"
            ? setEditHoursError(errorMessage)
            : setEditMinutesError(errorMessage);
        } else {
          unit == "hours"
            ? setHoursError(errorMessage)
            : setMinutesError(errorMessage);
        }
      }
    }
  };

  const handleInputChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;

    if (name === "hours") {
      const numericValue = value.replace(/[^0-9]/g, "");
      const newHours = numericValue ? parseFloat(numericValue) : 0;

      const newDuration = calculateDuration(newHours, minutes);
      setHours(newHours);

      if (isEditModalOpen) {
        validateDuration(numericValue, true, "hours");
        setSelectedEnrollment((prev) =>
          prev ? { ...prev, duration: newDuration || 0 } : null,
        );
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
        setSelectedEnrollment((prev) =>
          prev ? { ...prev, duration: newDuration || 0 } : null,
        );
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
      setSelectedEnrollment((prevState) =>
        handleNestedChange({ ...prevState }, name, value),
      );
    } else {
      setNewEnrollment((prevState) =>
        handleNestedChange({ ...prevState }, name, value),
      );
    }
  };

  const handleInputSelectionChange = (value: string, type: "add" | "edit") => {
    {
      type === "add"
        ? setNewEnrollment((prev) => ({ ...prev, frequency: value }))
        : setSelectedEnrollment((prev) =>
            prev ? { ...prev, frequency: value } : null,
          );
    }
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
        setEnrollments(
          enrollments.filter((e) => e.id !== selectedEnrollment.id),
        );
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
      availability: [{ day: "", startTime: "", endTime: "" }],
      meetingId: "",
      paused: false,
      duration: 1,
      frequency: "weekly",
    });
  };

  const handlePausePairingOverSummer = async (
    updatedEnrollment: Enrollment,
  ) => {
    try {
      setEnrollments((prev) =>
        prev.map((enrollment) =>
          enrollment.id === updatedEnrollment.id
            ? updatedEnrollment
            : enrollment,
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

  return (
    <>
      {" "}
      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Filter enrollments..."
                className="w-64"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Enrollment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add New Enrollment</DialogTitle>
                    <DialogDescription className="sr-only">
                      add a new enrollment
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
                    {" "}
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        {" "}
                        <Label htmlFor="tutor" className="text-right">
                          Student
                        </Label>
                        <Popover
                          open={openStudentOptions}
                          onOpenChange={setOpenStudentOptions}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openStudentOptions}
                              className="col-span-3"
                            >
                              {selectedStudentId &&
                              studentsMap[selectedStudentId]
                                ? `${studentsMap[selectedStudentId].firstName} ${studentsMap[selectedStudentId].lastName}`
                                : "Select a student"}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="">
                            <Command>
                              <CommandInput
                                placeholder="Search student..."
                                value={studentSearch}
                                onValueChange={setStudentSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No student found.</CommandEmpty>
                                <CommandGroup>
                                  {students.map((student) => (
                                    <CommandItem
                                      key={student.id}
                                      value={student.id}
                                      keywords={[
                                        student.firstName,
                                        student.lastName,
                                        student.email,
                                      ].filter(Boolean)}
                                      onSelect={() => {
                                        setSelectedStudentId(student.id);
                                        handleInputChange({
                                          target: {
                                            name: "student.id",
                                            value: student.id,
                                          },
                                        });
                                        setOpenStudentOptions(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedStudentId === student.id
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {student.firstName} {student.lastName} -{" "}
                                      {student.email}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        {" "}
                        <Label htmlFor="tutor" className="text-right">
                          Tutor
                        </Label>
                        <Popover
                          open={openTutorOptions}
                          onOpenChange={setOpentTutorOptions}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openTutorOptions}
                              className="col-span-3"
                            >
                              {selectedTutorId ? (
                                <>
                                  {
                                    tutors.find(
                                      (tutor) => tutor.id === selectedTutorId,
                                    )?.firstName
                                  }{" "}
                                  {
                                    tutors.find(
                                      (tutor) => tutor.id === selectedTutorId,
                                    )?.lastName
                                  }
                                </>
                              ) : (
                                "Select a tutor"
                              )}
                              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="">
                            <Command>
                              <CommandInput
                                placeholder="Search Tutor..."
                                value={tutorSearch}
                                onValueChange={setTutorSearch}
                              />
                              <CommandList>
                                <CommandEmpty>No Tutor found.</CommandEmpty>
                                <CommandGroup>
                                  {tutors.map((tutor) => (
                                    <CommandItem
                                      key={tutor.id}
                                      value={tutor.id}
                                      keywords={[
                                        tutor.firstName,
                                        tutor.lastName,
                                        tutor.email,
                                      ].filter(Boolean)}
                                      onSelect={() => {
                                        setSelectedTutorId(tutor.id);
                                        handleInputChange({
                                          target: {
                                            name: "tutor.id",
                                            value: tutor.id,
                                          },
                                        });
                                        setOpentTutorOptions(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedTutorId === tutor.id
                                            ? "opacity-100"
                                            : "opacity-0",
                                        )}
                                      />
                                      {tutor.firstName} {tutor.lastName} -{" "}
                                      {tutor.email}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <AvailabilityForm
                        // availabilityList={newEnrollment.availability}
                        availabilityList={availabilityList} // new enrollment by default will not have an availability
                        setAvailabilityList={(availability) => {
                          setAvailabilityList(availability);
                          setNewEnrollment({
                            ...newEnrollment,
                            availability,
                          });
                        }}
                      />
                      <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                        {/* <Label htmlFor="duration" className="text-right">
                          Duration
                        </Label> */}
                        {/* <div className="flex items-center gap-2">
                          <Input
                            id="hours"
                            name="hours"
                            type="text"
                            inputMode="numeric"
                            value={hours.toString()}
                            onChange={handleInputChange}
                            placeholder="1"
                            className={`w-16 ${hoursError ? "border-red-500" : ""}`}
                          />
                          <span className="text-sm">hrs</span>
                          <Input
                            id="minutes"
                            name="minutes"
                            type="text"
                            inputMode="numeric"
                            value={minutes.toString()}
                            onChange={handleInputChange}
                            placeholder="0"
                            className={`w-16 ${minutesError ? "border-red-500" : ""}`}
                          />
                          <span className="text-sm">min</span>
                          {/* <Label>{newEnrollment.duration}</Label> */}
                        {/* </div> */}

                        <Label htmlFor="frequency" className="text-right">
                          Frequency
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            name="timeZone"
                            value={newEnrollment.frequency}
                            onValueChange={(value) =>
                              handleInputSelectionChange(value, "add")
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="weekly" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Add time zone options here */}
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="biweekly">Biweekly</SelectItem>
                              {/* <SelectItem value="MT">Monthy</SelectItem> */}
                            </SelectContent>
                          </Select>
                        </div>

                        <Label htmlFor="summary" className="text-right">
                          Summary
                        </Label>
                        <Input
                          id="summary"
                          name="summary"
                          value={newEnrollment.summary}
                          onChange={handleInputChange}
                        />
                        <Label htmlFor="startDate" className="text-right">
                          Start Date
                        </Label>
                        <Input
                          id="startDate"
                          name="startDate"
                          type="date"
                          value={newEnrollment.startDate}
                          onChange={handleInputChange}
                          // className="col-span-3"
                        />
                      </div>
                      <div>
                        <Label>Meeting Link</Label>
                        <Select
                          name="meetingId"
                          value={newEnrollment.meetingId}
                          onOpenChange={(open) => {
                            if (open && newEnrollment) {
                              checkMeetingAvailabilities(newEnrollment);
                            }
                          }}
                          onValueChange={(value) =>
                            handleInputChange({
                              target: { name: "meetingId", value },
                            } as any)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a meeting link">
                              {isCheckingMeetingAvailability ? (
                                <>
                                  Checking meeting availabilites
                                  <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                                </>
                              ) : newEnrollment.meetingId ? (
                                meetings.find(
                                  (meeting) =>
                                    meeting.id === newEnrollment.meetingId,
                                )?.name
                              ) : (
                                "Select a meeting"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {meetings.map((meeting) => (
                              <SelectItem
                                key={meeting.id}
                                value={meeting.id}
                                className="flex items-center justify-between"
                                disabled={
                                  isCheckingMeetingAvailability ||
                                  (!meetingAvailability[meeting.id] &&
                                    meeting.name !== "Zoom Link HQ")
                                }
                              >
                                <span>
                                  {meeting.name} - {meeting.id}
                                </span>
                                <Circle
                                  className={`w-2 h-2 ml-2 ${
                                    meetingAvailability[meeting.id]
                                      ? "text-green-500"
                                      : "text-red-500"
                                  } fill-current`}
                                />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </ScrollArea>

                  <Button onClick={handleAddEnrollment}>Add Enrollment</Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Student",
                  "Tutor",
                  "Availability",
                  "Summary",
                  "Start Date",
                  "Meeting Link",
                  "Duration",
                  "Frequency",
                  "Actions",
                  "Status",
                  "Chat",
                ].map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    {enrollment.student?.firstName}{" "}
                    {enrollment.student?.lastName}
                  </TableCell>
                  <TableCell>
                    {enrollment.tutor?.firstName} {enrollment.tutor?.lastName}
                  </TableCell>
                  <TableCell className="colspan-[40px]">
                    <AvailabilityFormat
                      availability={enrollment.availability}
                      card={false}
                    />{" "}
                  </TableCell>
                  <TableCell>{enrollment.summary}</TableCell>
                  <TableCell>
                    {formatDateUTC(enrollment.startDate, {
                      includeTime: false,
                      includeDate: true,
                    })}
                    {/* {formatDateServer(enrollment.startDate, { includeTime: false, includeDate: true})} */}
                  </TableCell>
                  {/* <TableCell>
                    {formatDateAdmin(enrollment.endDate, false, true)}
                  </TableCell> */}
                  <TableCell>
                    {(() => {
                      const meeting = meetings.find(
                        (m) => String(m.id) === String(enrollment.meetingId),
                      );

                      if (!meeting) return "No Meeting Link";

                      return (
                        <button
                          type="button"
                          onClick={() => handleCopyMeetingLink(meeting.id)}
                          className="relative inline-flex items-center group cursor-pointer"
                        >
                          {/* Text – left aligned, normal state */}
                          <span className="underline text-black-600 transition-opacity duration-150 group-hover:opacity-0">
                            {meeting.name}
                          </span>

                          {/* Icon – centered over the text, only visible on hover */}
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
                    })()}
                  </TableCell>
                  <TableCell>
                    {formatSessionDuration(enrollment.duration)} hr(s)
                  </TableCell>
                  <TableCell>{enrollment.frequency}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedEnrollment(enrollment);
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
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const updatedEnrollment = {
                          ...enrollment,
                          summerPaused: !enrollment.paused,
                        };
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
                  </TableCell>
                  <TableCell>
                    <Button
                      className="gap-2"
                      onClick={() =>
                        router.push(
                          `/dashboard/enrollment/${enrollment.id}/chat`,
                        )
                      }
                      variant="outline"
                    >
                      View Chat
                      <MessageCircleIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between mt-4">
            <span>{filteredEnrollments.length} row(s) total.</span>
            <div className="flex items-center space-x-2">
              <span>Rows per page</span>
              <Select
                value={rowsPerPage.toString()}
                onValueChange={handleRowsPerPageChange}
              >
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Enrollment</DialogTitle>
            <DialogDescription className="sr-only">
              edit enrollment details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
            {" "}
            {selectedEnrollment && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="studentId" className="text-right">
                    Student
                  </Label>

                  <Popover
                    open={openStudentOptions}
                    onOpenChange={setOpenStudentOptions}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openStudentOptions}
                        className="col-span-3"
                      >
                        {selectedEnrollment.student?.id ? (
                          <>
                            {
                              students.find(
                                (student) =>
                                  student.id === selectedEnrollment.student?.id,
                              )?.firstName
                            }{" "}
                            {
                              students.find(
                                (student) =>
                                  student.id === selectedEnrollment.student?.id,
                              )?.lastName
                            }
                          </>
                        ) : (
                          "Select a student"
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="">
                      <Command>
                        <CommandInput
                          placeholder="Search Student..."
                          value={studentSearch}
                          onValueChange={setStudentSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No student found.</CommandEmpty>
                          <CommandGroup>
                            {students.map((student) => (
                              <CommandItem
                                key={student.id}
                                value={student.id}
                                keywords={[
                                  student.firstName,
                                  student.lastName,
                                  student.email,
                                ].filter(Boolean)}
                                onSelect={() => {
                                  setSelectedStudentId(student.id);
                                  handleInputChange({
                                    target: {
                                      name: "student.id",
                                      value: student.id,
                                    },
                                  });
                                  setOpenStudentOptions(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedStudentId === student.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {student.firstName} {student.lastName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tutorId" className="text-right">
                    Tutor
                  </Label>

                  <Popover
                    open={openTutorOptions}
                    onOpenChange={setOpentTutorOptions}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openTutorOptions}
                        className="col-span-3"
                      >
                        {selectedEnrollment.tutor?.id ? (
                          <>
                            {
                              tutors.find(
                                (tutor) =>
                                  tutor.id === selectedEnrollment.tutor?.id,
                              )?.firstName
                            }{" "}
                            {
                              tutors.find(
                                (tutor) =>
                                  tutor.id === selectedEnrollment.tutor?.id,
                              )?.lastName
                            }
                          </>
                        ) : (
                          "Select a tutor"
                        )}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="">
                      <Command>
                        <CommandInput
                          placeholder="Search Tutor..."
                          value={tutorSearch}
                          onValueChange={setTutorSearch}
                        />
                        <CommandList>
                          <CommandEmpty>No Tutor found.</CommandEmpty>
                          <CommandGroup>
                            {tutors.map((tutor) => (
                              <CommandItem
                                key={tutor.id}
                                value={tutor.id}
                                keywords={[
                                  tutor.firstName,
                                  tutor.lastName,
                                  tutor.email,
                                ].filter(Boolean)}
                                onSelect={() => {
                                  setSelectedTutorId(tutor.id);
                                  handleInputChange({
                                    target: {
                                      name: "tutor.id",
                                      value: tutor.id,
                                    },
                                  });
                                  setOpentTutorOptions(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTutorId === tutor.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {tutor.firstName} {tutor.lastName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <AvailabilityForm
                  availabilityList={selectedEnrollment?.availability || []} // Default to empty array if undefined
                  setAvailabilityList={(availability) =>
                    handleInputChange({
                      target: { name: "availability", value: availability },
                    } as any)
                  }
                />
                <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                  {/* <Label htmlFor="duration" className="text-right">
                    Duration
                  </Label> */}
                  {/* <div className="flex items-center gap-2">
                    <Input
                      id="hours"
                      name="hours"
                      type="text"
                      inputMode="numeric"
                      value={hours.toString()}
                      onChange={handleInputChange}
                      placeholder="1"
                      className={`w-16 ${hoursError ? "border-red-500" : ""}`}
                    />
                    <span className="text-sm">hrs</span>
                    <Input
                      id="minutes"
                      name="minutes"
                      type="text"
                      inputMode="numeric"
                      value={minutes.toString()}
                      onChange={handleInputChange}
                      placeholder="0"
                      className={`w-16 ${minutesError ? "border-red-500" : ""}`}
                    />
                    <span className="text-sm">min</span>
                    <Label>{newEnrollment.duration}</Label>
                  </div> */}

                  <Label htmlFor="frequency" className="text-right">
                    Frequency
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      name="timeZone"
                      value={selectedEnrollment.frequency}
                      onValueChange={(value) =>
                        handleInputSelectionChange(value, "edit")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="weekly" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Add time zone options here */}
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly" disabled={true}>
                          Biweekly
                        </SelectItem>
                        {/* <SelectItem value="MT">Monthy</SelectItem> */}
                      </SelectContent>
                    </Select>
                  </div>

                  <Label htmlFor="summary" className="text-right">
                    Summary
                  </Label>
                  <Input
                    id="summary"
                    name="summary"
                    value={selectedEnrollment.summary}
                    onChange={handleInputChange}
                    // className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startDate" className="text-right">
                    Start Date
                  </Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={selectedEnrollment.startDate}
                    onChange={handleInputChange}
                    className="col-span-3"
                  />
                </div>
                <div>
                  <Label>Meeting Link</Label>
                  <Select
                    name="meetingId"
                    value={selectedEnrollment.meetingId}
                    onOpenChange={(open) => {
                      if (open && selectedEnrollment) {
                        checkMeetingAvailabilities(selectedEnrollment);
                      }
                    }}
                    onValueChange={(value) =>
                      handleInputChange({
                        target: { name: "meetingId", value },
                      } as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a meeting link">
                        {selectedEnrollment.meetingId
                          ? meetings.find(
                              (meeting) =>
                                meeting.id === selectedEnrollment.meetingId,
                            )?.name
                          : "Select a meeting"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map((meeting) => (
                        <SelectItem
                          key={meeting.id}
                          value={meeting.id}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {meeting.name} - {meeting.id}
                          </span>
                          <Circle
                            className={`w-2 h-2 ml-2 ${
                              meetingAvailability[meeting.id]
                                ? "text-green-500"
                                : "text-red-500"
                            } fill-current`}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </ScrollArea>

          <Button onClick={handleUpdateEnrollment}>Update Enrollment</Button>
        </DialogContent>
      </Dialog>
      {/* Delete Enrollment Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Enrollment</DialogTitle>
            <DialogDescription className="sr-only">
              confirm enrollment deletion
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>
              Are you sure you want to delete this enrollment? This action
              cannot be undone.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEnrollment}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
    </>
  );
};

export default EnrollmentList;
