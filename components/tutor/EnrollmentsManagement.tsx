"use client";
import { useState, useEffect, useMemo, use } from "react";
import { useTranslations } from "next-intl";
import { AlarmClockMinus, Copy, MessageCircleIcon, Search, Timer, TimerOff } from "lucide-react";
import { formatDateAdmin, formatDateUTC, formatSessionDuration, timeStrToHours } from "@/lib/utils";
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
  getMeetings,
  pauseEnrollmentOverSummer,
} from "@/lib/actions/admin.actions";
import {
  removeEnrollment,
  updateEnrollment,
  addEnrollment,
} from "@/lib/actions/enrollment/server.actions";
import { getEnrollments } from "@/lib/actions/enrollment/client.actions";
import { getEnrollmentAvailability, getEnrollmentScheduleFields } from "@/lib/enrollment-schedule";
import { Enrollment, Profile, Event, Meeting, Availability } from "@/types";
import toast from "react-hot-toast";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
import { useRouter } from "next/navigation";
import { checkAvailableMeetingForEnrollments } from "@/lib/actions/meeting/client.actions";
import EnrollmentFormDialog from "@/components/shared/enrollment/EnrollmentFormDialog";
import DeleteEnrollmentDialog from "@/components/shared/enrollment/DeleteEnrollmentDialog";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/hooks/useLoadMore";
import { ResponsiveList, ResponsiveListColumn } from "@/components/ui/responsive-list";
// import Availability from "@/components/student/AvailabilityFormat";

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
  profile,
  enrollmentsPromise,
  meetingsPromise,
  studentsPromise,
}: {
  profile: Profile;
  enrollmentsPromise: Promise<Enrollment[]>;
  meetingsPromise: Promise<Meeting[] | null>;
  studentsPromise: Promise<Profile[] | null>;
}) => {
  const t = useTranslations("tutorSessions.enrollments");
  const combinedPromise = useMemo(
    () => Promise.all([enrollmentsPromise, meetingsPromise, studentsPromise]),
    [enrollmentsPromise, meetingsPromise, studentsPromise],
  );

  const [initialEnrollments, initialMeetings, initialStudents] = use(combinedPromise);

  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [filteredEnrollments, setFilteredEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings || []);
  const [students, setStudents] = useState<Profile[]>(initialStudents || []);
  const [tutors, setTutors] = useState<Profile[]>([profile]);

  const [allEnrollments, setAllEnrollments] = useState<Enrollment[]>([]);

  const [selectedTutorId, setSelectedTutorId] = useState(profile.id);
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
    tutor: profile,
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

  const checkAvailableMeetings = async (enrollment: Omit<Enrollment, "id" | "createdAt">) => {
    setIsCheckingMeetingAvailability(true);
    const otherEnrollments: Enrollment[] | null =
      allEnrollments.length > 0 ? allEnrollments : await getAllEnrollments();
    if (otherEnrollments) {
      const updatedMeetingAvailability = await checkAvailableMeetingForEnrollments(
        enrollment,
        otherEnrollments,
        meetings,
      );
      setMeetingAvailability(updatedMeetingAvailability);
      setAllEnrollments(otherEnrollments);
      setIsCheckingMeetingAvailability(false);
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
      toast.error(t("toasts.loadMeetingsError"));
    }
  };

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!profile) return;

      const enrollmentsData = await getEnrollments(profile.id);
      if (!enrollmentsData) throw new Error(t("toasts.noEnrollmentsFound"));

      const sortedEnrollments = enrollmentsData.sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      );

      setEnrollments(sortedEnrollments);
      setFilteredEnrollments(sortedEnrollments);
    } catch (error) {
      console.error("Error fetching enrollment data:", error);
      setError(error instanceof Error ? error.message : t("toasts.unknownError"));
      setIsCheckingMeetingAvailability(true); // Ensures that new enrollments are not accidentally added when unable to check for available meeting links
    } finally {
      setLoading(false);
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

  const handleInputChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;

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

  const handleStudentSelect = (student: Profile) => {
    setSelectedStudentId(student.id);
    handleInputChange({
      target: {
        name: "student.id",
        value: student.id,
      },
    });
  };

  const handleTutorSelect = (tutor: Profile) => {
    setSelectedTutorId(tutor.id);
    handleInputChange({ target: { name: "tutor.id", value: tutor.id } });
  };

  const handleAddEnrollment = async () => {
    try {
      const addedEnrollment = await addEnrollment(newEnrollment);
      if (addedEnrollment) {
        setEnrollments([{ ...addedEnrollment, paused: false, duration: 1 }, ...enrollments]);
        setIsAddModalOpen(false);
        resetNewEnrollment();
        setSelectedTutorId(profile.id);
        setSelectedStudentId("");
        setAvailabilityList([]);
        toast.success(t("toasts.addSuccess"));
      }
    } catch (error) {
      console.error("Error adding enrollment:", error);
      toast.error(t("toasts.addError"));
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
        toast.success(t("toasts.updateSuccess"));
        fetchEnrollments(); // reload Enrollments
      } catch (error) {
        console.error("Error updating enrollment:", error);
        toast.error(t("toasts.updateError"));
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
        toast.success(t("toasts.deleteSuccess"));
      } catch (error) {
        console.error("Error deleting enrollment:", error);
        toast.error(t("toasts.deleteError"));
      }
    }
  };

  const resetNewEnrollment = () => {
    setNewEnrollment({
      student: {} as Profile,
      tutor: profile,
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
      toast.success(t("toasts.summerPlanChanged"));
    } catch (error) {
      console.error("Unable to pause pairing over summer", error);
    }
  };

  const handleCopyMeetingLink = (meetingId: string) => {
    const meeting = meetings.find((m) => String(m.id) === String(meetingId));

    if (!meeting) {
      toast.error(t("toasts.meetingNotFound"));
      return;
    }

    const url = meeting.link;

    if (!url) {
      toast.error(t("toasts.noZoomLink"));
      return;
    }

    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(t("toasts.meetingLinkCopied")))
      .catch(() => toast.error(t("toasts.copyLinkError")));
  };

  const renderCopyLinkButton = (enrollment: Enrollment, mobile?: boolean) => (
    <button
      type="button"
      onClick={() => handleCopyMeetingLink(enrollment.meetingId)}
      className={
        mobile
          ? "relative inline-flex items-center group cursor-pointer px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          : "relative inline-flex items-center group cursor-pointer"
      }
    >
      <span className="underline text-black transition-opacity duration-150 group-hover:opacity-0">
        {t("copyLink")}
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

  const columns: ResponsiveListColumn<Enrollment>[] = [
    {
      key: "student",
      header: t("table.columns.student"),
      cell: (enrollment) => `${enrollment.student?.firstName} ${enrollment.student?.lastName}`,
      cellClassName: "whitespace-nowrap",
      mobileCell: null,
    },
    {
      key: "tutor",
      header: t("table.columns.tutor"),
      cell: (enrollment) => `${enrollment.tutor?.firstName} ${enrollment.tutor?.lastName}`,
      cellClassName: "whitespace-nowrap",
      mobileCell: null,
    },
    {
      key: "availability",
      header: t("table.columns.availability"),
      cell: (enrollment) => (
        <AvailabilityFormat availability={getEnrollmentAvailability(enrollment)} card={false} />
      ),
      cellClassName: "min-w-[180px]",
      mobileCell: (enrollment) => (
        <AvailabilityFormat availability={getEnrollmentAvailability(enrollment)} card />
      ),
    },
    {
      key: "summary",
      header: t("table.columns.summary"),
      cell: () => null,
      showInTable: false,
      mobileLabel: t("table.columns.summary"),
    },
    {
      key: "startDate",
      header: t("table.columns.startDate"),
      cell: (enrollment) =>
        formatDateUTC(enrollment.startDate, { includeTime: false, includeDate: true }),
      cellClassName: "whitespace-nowrap",
      mobileLabel: t("table.columns.startDate"),
    },
    {
      key: "status",
      header: t("table.columns.status"),
      cell: (enrollment) => (enrollment.paused ? t("table.statusPaused") : t("table.statusOngoing")),
      cellClassName: "whitespace-nowrap",
      mobileLabel: t("table.columns.status"),
    },
    {
      key: "meetingLink",
      header: t("table.columns.meetingLink"),
      cell: (enrollment) => renderCopyLinkButton(enrollment),
      cellClassName: "whitespace-nowrap",
      mobileCell: null,
    },
    {
      key: "actions",
      header: t("table.columns.actions"),
      cell: (enrollment) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedEnrollment(enrollment);
              setSelectedStudentId(enrollment.student?.id ?? "");
              setSelectedTutorId(enrollment.tutor?.id ?? profile.id);
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
      ),
      mobileCell: null,
    },
    {
      key: "chat",
      header: t("table.columns.chat"),
      cell: (enrollment) => (
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/enrollment/${enrollment.id}/chat`)}
        >
          {t("table.chat")}
        </Button>
      ),
      mobileCell: null,
    },
  ];

  const renderMobileEnrollmentFooter = (enrollment: Enrollment) => (
    <div className="flex gap-2 flex-wrap">
      {renderCopyLinkButton(enrollment, true)}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setSelectedEnrollment(enrollment);
          setSelectedStudentId(enrollment.student?.id ?? "");
          setSelectedTutorId(enrollment.tutor?.id ?? profile.id);
          setIsEditModalOpen(true);
        }}
      >
        {t("table.edit")}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          setSelectedEnrollment(enrollment);
          setIsDeleteModalOpen(true);
        }}
      >
        {t("table.delete")}
      </Button>
      <Button size="sm" onClick={() => router.push(`/dashboard/enrollment/${enrollment.id}/chat`)}>
        {t("table.chat")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 space-y-2 md:space-y-0">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                placeholder={t("filters.placeholder")}
                className="w-full md:w-64"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
              <Select value={timeFilterDay} onValueChange={setTimeFilterDay}>
                <SelectTrigger className="w-[140px]" aria-label={t("filters.dayAriaLabel")}>
                  <SelectValue placeholder={t("filters.anyDay")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filters.anyDay")}</SelectItem>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>
                      {t(`filters.days.${day.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                aria-label={t("filters.fromTimeAriaLabel")}
                title={t("filters.fromTimeTitle")}
                className="w-[120px]"
                value={timeFilterStart}
                onChange={(e) => setTimeFilterStart(e.target.value)}
              />
              <Input
                type="time"
                aria-label={t("filters.toTimeAriaLabel")}
                title={t("filters.toTimeTitle")}
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
                  {t("filters.clear")}
                </Button>
              )}
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button className="whitespace-nowrap">
                    <Plus className="mr-2 h-4 w-4" /> {t("addButton")}
                  </Button>
                </DialogTrigger>
                <EnrollmentFormDialog
                  mode="add"
                  context="tutor"
                  enrollment={newEnrollment}
                  onInputChange={handleInputChange}
                  onFrequencyChange={(value) =>
                    setNewEnrollment((prev) => ({
                      ...prev,
                      frequency: value as Enrollment["frequency"],
                    }))
                  }
                  availabilityList={availabilityList}
                  onAvailabilityChange={(availability) => {
                    setAvailabilityList(availability);
                    setNewEnrollment({
                      ...newEnrollment,
                      ...getEnrollmentScheduleFields(availability[0]),
                    });
                  }}
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onStudentSelect={handleStudentSelect}
                  tutors={tutors}
                  selectedTutorId={selectedTutorId}
                  onTutorSelect={handleTutorSelect}
                  meetings={meetings}
                  meetingAvailability={meetingAvailability}
                  isCheckingMeetingAvailability={isCheckingMeetingAvailability}
                  onMeetingDropdownOpen={() => checkAvailableMeetings(newEnrollment)}
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
            tableClassName="min-w-[1100px]"
            desktopWrapperClassName="overflow-x-auto rounded-lg border"
            mobileTitle={(enrollment) =>
              `${enrollment.student?.firstName} ${enrollment.student?.lastName}`
            }
            mobileSubtitle={(enrollment) =>
              t("mobileTutorPrefix", {
                firstName: enrollment.tutor?.firstName ?? "",
                lastName: enrollment.tutor?.lastName ?? "",
              })
            }
            mobileCardFooter={(enrollment) => renderMobileEnrollmentFooter(enrollment)}
            mobileFooter={
              <LoadMoreButton hasMore={hasMoreEnrollments} onClick={loadMoreEnrollments} />
            }
          />

          {/* Pagination */}
          <div className="hidden md:flex justify-between mt-4">
            <span>{t("pagination.rowsTotal", { count: filteredEnrollments.length })}</span>

            <div className="flex items-center space-x-2">
              <span>{t("pagination.rowsPerPage")}</span>

              <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50].map((value) => (
                    <SelectItem key={value} value={value.toString()}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {t("pagination.page", { current: currentPage, total: totalPages || 1 })}
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
        </div>
      </div>

      {/* Edit Enrollment Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <EnrollmentFormDialog
          mode="edit"
          context="tutor"
          enrollment={selectedEnrollment}
          onInputChange={handleInputChange}
          onFrequencyChange={(value) =>
            setSelectedEnrollment((prev) =>
              prev ? { ...prev, frequency: value as Enrollment["frequency"] } : prev,
            )
          }
          availabilityList={selectedEnrollment ? getEnrollmentAvailability(selectedEnrollment) : []}
          onAvailabilityChange={(availability) =>
            setSelectedEnrollment((prev) =>
              prev ? { ...prev, ...getEnrollmentScheduleFields(availability[0]) } : prev,
            )
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
          onMeetingDropdownOpen={() =>
            selectedEnrollment && checkAvailableMeetings(selectedEnrollment)
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

      {loading && <p>{t("loading")}</p>}
      {error && (
        <p className="text-red-500">
          {t("errorPrefix")}
          {error}
        </p>
      )}
    </>
  );
};

export default EnrollmentList;
