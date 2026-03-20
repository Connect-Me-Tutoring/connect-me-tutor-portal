"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMonths,
  subMonths,
  parseISO,
  isAfter,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  previousDay,
  getDay,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProfileSelector from "@/components/ui/profile-selector";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "../ui/command";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scrollarea";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Circle, Loader2, ChevronDown, Check } from "lucide-react";
import {
  getAllSessions,
  updateSession,
  getMeetings,
  getAllProfiles,
  removeSession,
  getMeeting,

  // checkMeetingsAvailability,
  // isMeetingAvailable,
} from "@/lib/actions/admin.actions";
import { addOneSession } from "@/lib/actions/session.server.actions";
import { addHours, areIntervalsOverlapping } from "date-fns";

import { fetchDaySessionsFromSchedule } from "@/lib/actions/session.actions";
import { addSessions } from "@/lib/actions/session.actions";
import { getProfileWithProfileId } from "@/lib/actions/user.actions";
import { toast, Toaster } from "react-hot-toast";
import { Session, Enrollment, Meeting, Profile } from "@/types";
import { getSessionTimespan } from "@/lib/utils";
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  GraduationCap,
  CircleUserRound,
  Users,
} from "lucide-react";
import { Textarea } from "../ui/textarea";
import { boolean } from "zod";
import { checkAvailableMeeting } from "@/lib/actions/meeting.actions";
import { getAllActiveEnrollments } from "@/lib/actions/enrollment.actions";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

const Schedule = ({
  initialCurrentWeek,
  initialCurrWeekStart,
  initialCurrWeekEnd,
  initialSessions,
  initialEnrollments,
  initialStudents,
  initialTutors,
  initialMeetings,
}: any) => {
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState(new Date());

  // keep currentWeek in sync when day view crosses week boundary
  useEffect(() => {
    if (calendarView === "day") setCurrentWeek(selectedDay);
  }, [selectedDay, calendarView]);

  const weekEnd = endOfWeek(currentWeek).toISOString();
  const weekStart = startOfWeek(currentWeek).toISOString();
  // adapts fetch range to whichever view is active
  const queryStart = calendarView === "month" ? startOfWeek(startOfMonth(currentWeek)).toISOString() : weekStart;
  const queryEnd = calendarView === "month" ? endOfWeek(endOfMonth(currentWeek)).toISOString() : weekEnd;
  // const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  // const [meetings, setMeetings] = useState<Meeting[]>([]);
  // const [students, setStudents] = useState<Profile[]>([]);
  // const [tutors, setTutors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isCheckingMeetingAvailability, setIsCheckingMeetingAvailability] =
    useState(false);
  const [meetingAvailabilityMap, setMeetingAvailabilityMap] = useState<
    Record<string, boolean>
  >({});
  const [allSessions, setAllSessions] = useState<Session[]>([]);

  const initialMount = useRef(true);
  const [openStudentOptions, setOpenStudentOptions] = useState(false);
  const [openTutorOptions, setOpentTutorOptions] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTutorId, setSelectedTutorId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");
  const [newSession, setNewSession] = useState<Partial<Session>>({
    student: {
      id: "",
      createdAt: "",
      role: "Student",
      userId: "",
      firstName: "",
      lastName: "",
      startDate: "",
      availability: [],
      email: "",
      phoneNumber: "",
      timeZone: "",
      subjects_of_interest: [],
      status: "Active",
      tutorIds: [],
      studentNumber: null,
      settingsId: "",
      languages_spoken: [],
    },
    tutor: {
      id: "",
      createdAt: "",
      role: "Student",
      userId: "",
      firstName: "",
      lastName: "",
      startDate: "",
      availability: [],
      email: "",
      phoneNumber: "",
      timeZone: "",
      subjects_of_interest: [],
      status: "Active",
      tutorIds: [],
      studentNumber: null,
      settingsId: "",
      languages_spoken: [],
    },
    date: new Date().toISOString(),
    summary: "",
  });

  const formatDateForInput = (isoDate: string | undefined): string => {
    if (!isoDate) return "";
    try {
      return format(parseISO(isoDate), "yyyy-MM-dd'T'HH:mm");
    } catch (e) {
      console.error("Invalid date:", e);
      return "";
    }
  };

  // useEffect(() => {
  //   const fetchData = () => {
  //     // setCurrentWeek(initialCurrentWeek)
  //     setWeekStart(initialCurrWeekStart)
  //     setWeekEnd(initialCurrWeekEnd)
  //     setSessions(initialSessions)
  //     setEnrollments(initialEnrollments)
  //     setMeetings(initialMeetings)
  //     setStudents(initialStudents)
  //     setTutors(initialTutors)
  //   };
  //   fetchData();
  //   setLoading(false)
  // }, []);

  // const currWeekStart = startOfWeek(currentWeek).toISOString();
  // const currWeekEnd = endOfWeek(currentWeek).toISOString();

  const query = useQueries({
    queries: [
      {
        queryKey: ["sessions", queryStart, queryEnd],
        queryFn: async () => {
          // weekly chunks to avoid supabase 1000 row cap
          const fetches: Promise<Session[]>[] = [];
          let cursor = startOfWeek(new Date(queryStart));
          const end = new Date(queryEnd);
          while (cursor <= end) {
            fetches.push(getAllSessions(cursor.toISOString(), endOfWeek(cursor).toISOString(), "date", true));
            cursor = addWeeks(cursor, 1);
          }
          return (await Promise.all(fetches)).flat();
        },
      },
      {
        queryKey: ["students"],
        queryFn: () => getAllProfiles("Student"),
      },
      {
        queryKey: ["tutors"],
        queryFn: () => getAllProfiles("Tutor"),
      },
      {
        queryKey: ["meetings"],
        queryFn: () => getMeetings(),
      },
    ],
  });

  const [
    sessionsResult,
    studentsResult,
    tutorsResult,
    meetingsResult,
  ] = query;

  const sessions = sessionsResult.data || [];
  const students = studentsResult.data || [];
  const tutors = tutorsResult.data || [];
  const meetings = meetingsResult.data || [];

  let isLoading = sessionsResult.isLoading;

  // const [sessions, setSessions] = useState<Session[]>([]);

  // useEffect(() => {
  //   const fetchData = async () => {
  //     setLoading(true)
  //     try {
  //       // const [
  //       //   fetchedSessions,
  //       //   fetchedEnrollments,
  //       //   fetchedMeetings,
  //       //   fetchedStudents,
  //       //   fetchedTutors,
  //       // ] = await Promise.all([
  //       //   fetchSessions(currWeekStart, currWeekEnd),
  //       //   fetchEnrollments(currWeekEnd),
  //       //   fetchMeetings(),
  //       //   fetchStudents(),
  //       //   fetchTutors(),
  //       // ]);

  //       fetchSessions(weekStart, weekEnd).then(
  //         (fetchedSessions) => fetchedSessions && setSessions(fetchedSessions)
  //       );
  //       // fetchEnrollments(currWeekEnd).then(
  //       //   (fetchedEnrollments) =>
  //       //     fetchedEnrollments && setEnrollments(fetchedEnrollments)
  //       // );
  //       // fetchMeetings().then(
  //       //   (fetchedMeetings) => fetchedMeetings && setMeetings(fetchedMeetings)
  //       // );
  //       // fetchStudents().then(
  //       //   (fetchedStudents) => fetchedStudents && setStudents(fetchedStudents)
  //       // );
  //       // fetchTutors().then(
  //       //   (fetchedTutors) => fetchedTutors && setTutors(fetchedTutors)
  //       // );

  //       // if (fetchedSessions) setSessions(fetchedSessions);
  //       // if (fetchedEnrollments) setEnrollments(fetchedEnrollments);
  //       // if (fetchedMeetings) setMeetings(fetchedMeetings);
  //       // if (fetchedStudents) setStudents(fetchedStudents);
  //       // if (fetchedTutors) setTutors(fetchedTutors);
  //     } catch (error) {
  //       console.error("Failed to fetch data:", error);
  //     } finally {
  //       setLoading(false)
  //     }

  //     // setWeekStart(currWeekStart);
  //     // setWeekEnd(currWeekEnd);
  //   };
  //   // fetchData();

  //   // setSessions()
  //   toast.success("Switched Week")
  // }, [currentWeek]);

  const fetchSessions = async (weekStart: string, weekEnd: string) => {
    try {
      // const fetchedSessions = await queryClient.fetchQuery({
      //   queryKey: [weekStart, weekEnd],
      //   queryFn: async () => {
      return getAllSessions(weekStart, weekEnd, "date", true);
      //   },
      // });
      // return fetchedSessions;
      // setSessions(fetchedSessions);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      toast.error("Failed to load sessions");
    }
  };

  const fetchStudents = async () => {
    try {
      return await queryClient.fetchQuery({
        queryKey: ["Student"],
        queryFn: async () => getAllProfiles("Student"),
      });
      // if (fetchedStudents) {
      //   setStudents(fetchedStudents);
      // }
      // return fetchedStudents;
    } catch (error) {
      console.error("Failed to fetch students:", error);
      toast.error("Failed to load students");
    }
  };

  const fetchEnrollments = async (endOfWeek: string) => {
    try {
      // const fetchedEnrollments = await getAllEnrollments();
      return await queryClient.fetchQuery({
        queryKey: [endOfWeek],
        queryFn: async () => getAllActiveEnrollments(endOfWeek),
      });
      // setEnrollments(fetchedEnrollments);
      // return fetchedEnrollments;
    } catch (error) {
      console.error("Failed to fetch enrollments:", error);
      toast.error("Failed to load enrollments");
    }
  };

  const fetchMeetings = async () => {
    try {
      return await queryClient.fetchQuery({
        queryKey: [],
        queryFn: async () => getMeetings(),
      });
      // if (fetchedMeetings) {
      //   setMeetings(fetchedMeetings);
      // }
      // return fetchedMeetings
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
      toast.error("Failed to load meetings");
    }
  };

  const fetchTutors = async () => {
    try {
      return await queryClient.fetchQuery({
        queryKey: ["Tutor"],
        queryFn: async () => getAllProfiles("Tutor"),
      });
      // if (fetchedTutors) {
      //   setTutors(fetchedTutors);
      // }
    } catch (error) {
      console.error("Failed to fetch students:", error);
      toast.error("Failed to load students");
    }
  };

  // const { data: studentsData } = useQuery({
  //   queryKey: ["students"],
  //   queryFn: fetchStudents,
  //   staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  // });

  // const { data: tutorsData } = useQuery({
  //   queryKey: ["tutors"],
  //   queryFn: fetchTutors,
  //   staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  // });

  // const { data: sessionsData, isLoading: isLoadingSessions } = useQuery({
  //   queryKey: ["sessions", currWeekStart, currWeekEnd],
  //   queryFn: () => fetchSessions(currWeekStart, currWeekEnd),
  // });

  // const { data: enrollmentsData } = useQuery({
  //   queryKey: ["enrollments", currWeekEnd],
  //   queryFn: () => fetchEnrollments(currWeekEnd),
  // });

  // const { data: meetingsData } = useQuery({
  //   queryKey: ["meetings"],
  //   queryFn: () => fetchMeetings(),
  // });

  // useEffect(() => {
  //   if (studentsData) setStudents(studentsData);
  // }, [studentsData]);

  // useEffect(() => {
  //   if (tutorsData) setTutors(tutorsData);
  // }, [tutorsData]);

  // useEffect(() => {
  //   if (sessionsData) setSessions(sessionsData)
  // }, [sessionsData])

  // useEffect(() => {
  //   if (enrollmentsData) setEnrollments(enrollmentsData)
  // }, [enrollmentsData])

  // useEffect(() => {
  //   if (meetingsData) setMeetings(meetingsData)
  // }, [meetingsData])

  const fetchAllSessionsFromSchedule = async () => {
    try {
      const data = await getAllSessions();
      if (!data) throw new Error("Unable to retrieve all sessions");
      setAllSessions(data);
    } catch (error) {
      console.error("Failed to fetch all sessions", error);
      throw error;
    }
  };

  const checkMeetingAvailabilites = async (session: Session) => {
    try {
      setIsCheckingMeetingAvailability(true);
      const updatedMeetingAvailability = await checkAvailableMeeting(
        session,
        meetings,
      );
      setMeetingAvailabilityMap(updatedMeetingAvailability);
    } catch (error) {
      toast.error("Unable to find available meeting links");
      console.error("Unable to find available meeting links", error);
    } finally {
      setIsCheckingMeetingAvailability(false);
    }
  };

  const updateWeekMutation = useMutation({
    mutationFn: ({ enrollments }: { enrollments: Enrollment[] }) =>
      addSessions(weekStart, weekEnd, enrollments, sessions),
    onMutate: async () => {
      // await queryClient.cancelQueries({ queryKey: ["sessions"] });
      // const prevSessions: Session[] | undefined = queryClient.getQueryData([
      //   "sessions",
      //   weekStart,
      //   weekEnd,
      // ]);
      // await queryClient.setQueryData(
      //   ["sessions", weekStart, weekEnd],
      //   (sessions: Session[] | undefined) =>
      //     sessions && prevSessions ? [...sessions, ...prevSessions] : []
      // );
      // return { prevSessions };
    },
    onSuccess: (newSessions: Session[]) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] }); // broad invalidation catches any date range
      toast.success(`${newSessions.length} new sessions added successfully`);
    },
    onError: (error: any, _, context) => {
      // if (context) {
      //   queryClient.setQueryData(
      //     ["sessions", weekStart, weekEnd],
      //     context.prevSessions
      //   );
      // }
      // console.error("Failed to add sessions:", error);
      error.digest === "4161161223"
        ? toast.error("Please wait until adding new sessions")
        : toast.error(`Failed to add sessions. ${error.message}`);
    },
    onSettled: () => {},
  });
  // refetch enrollments first so deleted ones dont spawn sessions
  const handleUpdateWeek = async () => {
    const freshEnrollments =
      (await queryClient.fetchQuery({
        queryKey: ["enrollments", weekEnd],
        queryFn: () => getAllActiveEnrollments(weekEnd),
      })) ?? [];

    updateWeekMutation.mutate({ enrollments: freshEnrollments });
  };

  // groups sessions by day key so cells just do a map lookup
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      if (!session?.date) continue;
      try {
        const dayKey = format(toZonedTime(parseISO(session.date), "America/New_York"), "yyyy-MM-dd");
        if (!map.has(dayKey)) map.set(dayKey, []);
        map.get(dayKey)!.push(session);
      } catch {}
    }
    return map;
  }, [sessions]);

  const getValidSessionsForDay = (day: Date) => sessionsByDay.get(format(day, "yyyy-MM-dd")) || [];

  const removeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => removeSession(sessionId),
    onMutate: async (sessionId: string) => {
      await queryClient.cancelQueries({ queryKey: ["sessions"] });
      const prevSessions = queryClient.getQueryData<Session[]>([
        "sessions",
        queryStart,
        queryEnd,
      ]);

      queryClient.setQueryData(
        ["sessions", queryStart, queryEnd],
        (sessions: Session[] | undefined) =>
          sessions
            ? sessions.filter((session) => session.id !== sessionId)
            : [],
      );

      return { prevSessions };
    },
    onSuccess: () => {
      setIsModalOpen(false);
      toast.success("Session removed successfully");
    },
    onError: (error: any, sessionId, context) => {
      if (context) {
        queryClient.setQueryData(
          ["sessions", queryStart, queryEnd],
          context.prevSessions,
        );
      }
      console.error("Failed to remove session", error);
      toast.error("Failed to remove session");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const handleRemoveSession = async (sessionId: string) => {
    removeSessionMutation.mutate(sessionId);
  };

  const handleUpdateSession = async (updatedSession: Session) => {
    try {
      await updateSession(updatedSession);
      toast.success("Session updated successfully");
      setIsModalOpen(false);
      fetchSessions(queryStart, queryEnd);
    } catch (error) {
      console.error("Failed to update session:", error);
      toast.error("Failed to update session");
    }
  };

  const handleAddSession = async () => {
    try {
      if (newSession) {
        await addOneSession(newSession as Session);
      }
      fetchSessions(weekStart, weekEnd);
      toast.success("Added Session");
    } catch (error) {
      toast.error("Unable to add session");
    }
  };

  const handleInputChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;

    setNewSession((prev) => {
      if (!prev) return {} as Session;

      const updated = { ...prev };

      if (name.includes(".")) {
        const [parent, child] = name.split(".");
        if (parent === "student" || parent === "tutor") {
          const parentObj = (updated[parent] || {}) as Profile;
          updated[parent] = {
            ...parentObj,
            [child]: value,
          };
        }
      } else {
        if (name in updated) {
          (updated as any)[name] = value;
        }
      }

      return updated;
    });
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek),
    end: endOfWeek(currentWeek),
  });

  const goToPrevious = () => {
    if (calendarView === "day") setSelectedDay((d) => subDays(d, 1));
    else if (calendarView === "week") setCurrentWeek((w) => subWeeks(w, 1));
    else setCurrentWeek((w) => subMonths(w, 1));
  };
  const goToNext = () => {
    if (calendarView === "day") setSelectedDay((d) => addDays(d, 1));
    else if (calendarView === "week") setCurrentWeek((w) => addWeeks(w, 1));
    else setCurrentWeek((w) => addMonths(w, 1));
  };
  // jumps to a specific date, view aware
  const goToDate = (date: Date) => {
    setCurrentWeek(date);
    setSelectedDay(date);
  };

  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

  const getSessionHour = (dateStr: string) => {
    const d = toZonedTime(parseISO(dateStr), "America/New_York");
    return d.getHours();
  };
  const getSessionMinutes = (dateStr: string) => {
    const d = toZonedTime(parseISO(dateStr), "America/New_York");
    return d.getMinutes();
  };

  const monthStart = startOfMonth(currentWeek);
  const monthEnd = endOfMonth(currentWeek);
  const monthCalendarStart = startOfWeek(monthStart);
  const monthCalendarEnd = endOfWeek(monthEnd);
  const monthDays = eachDayOfInterval({ start: monthCalendarStart, end: monthCalendarEnd });

  const sessionStats = useMemo(() => ({
    totalSessions: sessions.length,
    tutorsInvolved: new Set(sessions.map((s) => s?.tutor?.id)).size,
    studentsThisWeek: new Set(sessions.map((s) => s?.student?.id)).size,
    totalStudents: students.length,
  }), [sessions, students]);

  const SessionCard = ({ session }: { session: Session }) => (
    <div
      onClick={() => {
        setSelectedSession(session);
        setIsModalOpen(true);
      }}
      className={cn(
        "rounded-md px-2 py-1 text-xs cursor-pointer border-l-2 truncate hover:shadow-md transition-shadow",
        session.status === "Complete"
          ? "bg-green-50 border-l-green-500 text-green-900"
          : session.status === "Cancelled"
            ? "bg-red-50 border-l-red-500 text-red-900"
            : "bg-blue-50 border-l-blue-500 text-blue-900"
      )}
    >
      <p className="font-medium truncate">
        {session.tutor?.firstName} {session.tutor?.lastName}
      </p>
      <p className="truncate text-[11px] opacity-80">
        {session.student?.firstName} {session.student?.lastName}
      </p>
      <p className="text-[10px] opacity-60">
        {getSessionTimespan(session.date, session.duration)}
      </p>
    </div>
  );

  const getHeaderText = () => {
    if (calendarView === "day") return format(selectedDay, "EEEE, MMMM d, yyyy");
    if (calendarView === "month") return format(currentWeek, "MMMM yyyy");
    return `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d, yyyy")}`;
  };

  return (
    <>
      <Toaster />
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Today
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" size="sm" onClick={() => goToDate(new Date())}>Go to today</Button>
                    <Input
                      type="date"
                      onChange={(e) => {
                        const d = new Date(e.target.value + "T12:00:00");
                        if (isValid(d)) goToDate(d);
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-gray-800 ml-2">
                {getHeaderText()}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {(["day", "week", "month"] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                      calendarView === view
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>

              <Button
                onClick={handleUpdateWeek}
                disabled={isLoading}
                size="sm"
                className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Loading
                  </>
                ) : (
                  "Update Week"
                )}
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-connect-me-blue-4 hover:bg-connect-me-blue-5">
                    Add Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Session</DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="pr-4">
                    <div className="grid gap-4 py-4">
                      <ProfileSelector
                        label="Student"
                        profiles={students}
                        selectedId={selectedStudentId}
                        onSelect={(id) => {
                          setSelectedStudentId(id);
                          handleInputChange({ target: { name: "student.id", value: id } });
                        }}
                        placeholder="Select a student"
                      />
                      <ProfileSelector
                        label="Tutor"
                        profiles={tutors}
                        selectedId={selectedTutorId}
                        onSelect={(id) => {
                          setSelectedTutorId(id);
                          handleInputChange({ target: { name: "tutor.id", value: id } });
                        }}
                        placeholder="Select a tutor"
                      />
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="startDate" className="text-right">Date</Label>
                        <Input
                          id="startDate"
                          name="startDate"
                          type="datetime-local"
                          defaultValue={formatDateForInput(newSession.date)}
                          onBlur={async (e) => {
                            const scheduledDate = new Date(e.target.value);
                            const updatedSession: Partial<Session> = {
                              ...newSession,
                              date: scheduledDate.toISOString(),
                            };
                            await checkMeetingAvailabilites(updatedSession as Session);
                            setNewSession(updatedSession);
                          }}
                          disabled={isCheckingMeetingAvailability}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="duration" className="text-right">Duration</Label>
                        <div className="col-span-3">
                          <Select
                            onValueChange={(value) => {
                              const duration = parseFloat(value);
                              const updatedSession: Partial<Session> = { ...newSession, duration };
                              checkMeetingAvailabilites(updatedSession as Session);
                              setNewSession(updatedSession);
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a time duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Duration</SelectLabel>
                                {Array.from({ length: 12 }, (_, i) => (i + 1) * 0.25).map((duration) => {
                                  const minutes = (duration % 1) * 60;
                                  const hours = Math.floor(duration);
                                  return (
                                    <SelectItem key={duration} value={duration.toString()}>
                                      {hours} {hours > 1 ? "hours" : "hour"} {minutes} minutes
                                    </SelectItem>
                                  );
                                })}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Meeting Link</Label>
                        <div className="col-span-3">
                          <Select
                            value={newSession?.meeting?.id || ""}
                            onValueChange={async (value) => {
                              setNewSession({ ...newSession, meeting: await getMeeting(value) });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {newSession?.meeting?.name || "Select a meeting"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {meetings.map((meeting) => (
                                <SelectItem key={meeting.id} value={meeting.id} className="flex items-center justify-between">
                                  <span>{meeting.name}</span>
                                  <Circle
                                    className={`w-2 h-2 ml-2 ${
                                      meetingAvailabilityMap[meeting.id] ? "text-green-500" : "text-red-500"
                                    } fill-current`}
                                  />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddSession}
                        disabled={isCheckingMeetingAvailability}
                        className="bg-connect-me-blue-3"
                      >
                        {isCheckingMeetingAvailability ? (
                          <>
                            Checking Meeting Availability
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          </>
                        ) : (
                          "Add Session"
                        )}
                      </Button>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3 pt-3 border-t text-sm text-gray-500">
            <span>
              <span className="font-medium text-gray-700">{sessionStats.totalSessions}</span> sessions
            </span>
            <span>
              <span className="font-medium text-gray-700">{sessionStats.tutorsInvolved}</span> tutors
            </span>
            <span>
              <span className="font-medium text-gray-700">{sessionStats.studentsThisWeek}</span> / {sessionStats.totalStudents} students
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm p-10">
            <div className="text-center">
              <Calendar className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="mt-3 text-gray-500 text-sm">Loading sessions...</p>
            </div>
          </div>
        ) : (
          <>
            {calendarView === "week" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
                  <div className="border-r" />
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "text-center py-3 border-r last:border-r-0",
                        isToday(day) && "bg-blue-50"
                      )}
                    >
                      <p className="text-xs text-gray-500 uppercase">{format(day, "EEE")}</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        isToday(day)
                          ? "bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                          : "text-gray-800"
                      )}>
                        {format(day, "d")}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[60px_repeat(7,1fr)]">
                  {HOURS.map((hour) => (
                    <React.Fragment key={hour}>
                      <div className="border-r border-b min-h-[36px] flex items-start justify-end pr-2 pt-1">
                        <span className="text-[11px] text-gray-400">
                          {hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`}
                        </span>
                      </div>
                      {weekDays.map((day) => {
                        const daySessions = getValidSessionsForDay(day).filter(
                          (s) => getSessionHour(s.date) === hour
                        );
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className={cn(
                              "border-r border-b last:border-r-0 min-h-[36px] p-[2px] space-y-0.5",
                              isToday(day) && "bg-blue-50/30"
                            )}
                          >
                            {daySessions.map((session) => (
                              <SessionCard key={session.id} session={session} />
                            ))}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {calendarView === "day" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-[60px_1fr]">
                  <div className="border-r border-b" />
                  <div className={cn("py-3 px-4 border-b", isToday(selectedDay) && "bg-blue-50")}>
                    <p className="text-xs text-gray-500 uppercase">{format(selectedDay, "EEEE")}</p>
                    <p className={cn(
                      "text-2xl font-semibold",
                      isToday(selectedDay) ? "text-blue-600" : "text-gray-800"
                    )}>
                      {format(selectedDay, "d")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[60px_1fr]">
                  {HOURS.map((hour) => {
                    const daySessions = getValidSessionsForDay(selectedDay).filter(
                      (s) => getSessionHour(s.date) === hour
                    );
                    return (
                      <React.Fragment key={hour}>
                        <div className="border-r border-b min-h-[36px] flex items-start justify-end pr-2 pt-1">
                          <span className="text-[11px] text-gray-400">
                            {hour === 0 ? "12:00 AM" : hour < 12 ? `${hour}:00 AM` : hour === 12 ? "12:00 PM" : `${hour - 12}:00 PM`}
                          </span>
                        </div>
                        <div className={cn("border-b min-h-[36px] p-[2px] space-y-0.5", isToday(selectedDay) && "bg-blue-50/30")}>
                          {daySessions.map((session) => (
                            <SessionCard key={session.id} session={session} />
                          ))}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {calendarView === "month" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center py-2 text-xs font-medium text-gray-500 uppercase border-r last:border-r-0">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day) => {
                    const daySessions = getValidSessionsForDay(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "border-r border-b last:border-r-0 min-h-[100px] p-1",
                          !isSameMonth(day, currentWeek) && "bg-gray-50 opacity-50",
                          isToday(day) && "bg-blue-50"
                        )}
                      >
                        <p className={cn(
                          "text-xs font-medium mb-1",
                          isToday(day)
                            ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                            : "text-gray-600"
                        )}>
                          {format(day, "d")}
                        </p>
                        <div className="space-y-0.5">
                          {daySessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => {
                                setSelectedSession(session);
                                setIsModalOpen(true);
                              }}
                              className={cn(
                                "text-[10px] px-1 py-0.5 rounded truncate cursor-pointer",
                                session.status === "Complete"
                                  ? "bg-green-100 text-green-800"
                                  : session.status === "Cancelled"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                              )}
                            >
                              {session.tutor?.firstName} / {session.student?.firstName}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Session Details</DialogTitle>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedSession?.status}
                    onValueChange={(value: "Active" | "Complete" | "Cancelled") => {
                      if (value && selectedSession) {
                        setSelectedSession({ ...selectedSession, status: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>{selectedSession?.status || "Select status"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Complete">Complete</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tutor</Label>
                  <Select
                    value={selectedSession.tutor?.id}
                    onValueChange={async (value) => {
                      const selectedTutor = await getProfileWithProfileId(value);
                      if (selectedTutor) setSelectedSession({ ...selectedSession, tutor: selectedTutor });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {selectedSession.tutor
                          ? `${selectedSession.tutor.firstName} ${selectedSession.tutor.lastName}`
                          : "Select a tutor"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tutors.map((tutor) =>
                        tutor.status !== "Inactive" && (
                          <SelectItem key={tutor.id} value={tutor.id}>
                            {tutor.firstName} {tutor.lastName}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Student</Label>
                  <Select
                    value={selectedSession.student?.id}
                    onValueChange={async (value) => {
                      const selectedStudent = await getProfileWithProfileId(value);
                      if (selectedStudent) setSelectedSession({ ...selectedSession, student: selectedStudent });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {selectedSession.student
                          ? `${selectedSession.student.firstName} ${selectedSession.student.lastName}`
                          : "Select a student"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) =>
                        student.status !== "Inactive" && (
                          <SelectItem key={student.id} value={student.id}>
                            {student.firstName} {student.lastName}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="datetime-local"
                    defaultValue={format(parseISO(selectedSession.date), "yyyy-MM-dd'T'HH:mm")}
                    onBlur={(e) => {
                      const scheduledDate = new Date(e.target.value);
                      setSelectedSession({ ...selectedSession, date: scheduledDate.toISOString() });
                      checkMeetingAvailabilites(selectedSession as Session);
                    }}
                  />
                </div>
                <div>
                  <Label>Meeting</Label>
                  <Select
                    value={selectedSession?.meeting?.id || ""}
                    onValueChange={async (value) =>
                      setSelectedSession({ ...selectedSession, meeting: await getMeeting(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>{selectedSession?.meeting?.name || "Select a meeting"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map((meeting) => (
                        <SelectItem key={meeting.id} value={meeting.id} className="flex items-center justify-between">
                          <span>{meeting.name}</span>
                          <Circle
                            className={`w-2 h-2 ml-2 ${
                              meetingAvailabilityMap[meeting.id] ? "text-green-500" : "text-red-500"
                            } fill-current`}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-right">Notes (Only viewable Admin Side)</Label>
                  <Textarea
                    value={selectedSession?.summary}
                    onChange={(e) => setSelectedSession({ ...selectedSession, summary: e.target.value })}
                  />
                </div>
                {(() => {
                  const rawSef = (selectedSession as any)?.session_exit_form as string | null | undefined;
                  const sefFlags: string[] = [];
                  if ((selectedSession as any)?.isQuestionOrConcern) sefFlags.push("question/concern");
                  if ((selectedSession as any)?.isFirstSession) sefFlags.push("first session");
                  if (selectedSession.status === "Cancelled") sefFlags.push("cancelled");
                  let sefReasonText = rawSef ?? "";
                  if (rawSef && rawSef.trim().startsWith("{")) {
                    try {
                      const parsed = JSON.parse(rawSef) as any;
                      sefReasonText = parsed?.reason ?? parsed?.notes ?? parsed?.exitReason ?? rawSef;
                      const extraFlags = parsed?.boxes ?? parsed?.flags ?? parsed?.options;
                      if (Array.isArray(extraFlags)) {
                        extraFlags.filter((x) => typeof x === "string").forEach((x) => sefFlags.push(x));
                      }
                    } catch {
                      // raw text fine
                    }
                  }
                  return (
                    <div>
                      <Label>SEF Exit Reason</Label>
                      <Textarea readOnly value={sefReasonText || ""} placeholder="no session exit form yet" />
                      <p className="text-xs text-gray-500 mt-1">
                        SEF boxes: {sefFlags.length ? sefFlags.join(", ") : "none"}
                      </p>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-3">
                  <Link href={`/dashboard/session/${selectedSession.id}/participation`} className="w-full">
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 h-4 w-4" />
                      View Session Participation
                    </Button>
                  </Link>
                  <div className="flex flex-row justify-between">
                    <Button
                      disabled={isCheckingMeetingAvailability}
                      onClick={() => handleUpdateSession(selectedSession)}
                    >
                      {isCheckingMeetingAvailability ? (
                        <>
                          Checking Available Meeting Links
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        </>
                      ) : (
                        "Update Session"
                      )}
                    </Button>
                    <Button variant="destructive" onClick={() => handleRemoveSession(selectedSession.id)}>
                      Delete Session
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Schedule;
