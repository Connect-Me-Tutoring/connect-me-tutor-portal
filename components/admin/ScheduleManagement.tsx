"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  parseISO,
  isAfter,
  isValid,
  previousDay,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
// Add these imports at the top of the file
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
import { getEnrollmentsWithMissingSEF } from "@/lib/actions/enrollment.server.actions";
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
  // changed to use useQueryCLient so cache invalidation actually propogates
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekEnd = endOfWeek(currentWeek).toISOString();
  const weekStart = startOfWeek(currentWeek).toISOString();
  // const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  // const [meetings, setMeetings] = useState<Meeting[]>([]);
  // const [students, setStudents] = useState<Profile[]>([]);
  // const [tutors, setTutors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  //-----Checking Meeting Availability-----

  const [isCheckingMeetingAvailability, setIsCheckingMeetingAvailability] =
    useState(false);
  const [meetingAvailabilityMap, setMeetingAvailabilityMap] = useState<
    Record<string, boolean>
  >({});
  const [allSessions, setAllSessions] = useState<Session[]>([]);

  //---------------------------------
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
        queryKey: ["sessions", weekStart, weekEnd],
        queryFn: () => getAllSessions(weekStart, weekEnd, "date", true),
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
        queryKey: ["enrollments", weekEnd],
        queryFn: () => getAllActiveEnrollments(weekEnd),
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
    enrollmentsResult,
    meetingsResult,
  ] = query;

  const sessions = sessionsResult.data || [];
  const students = studentsResult.data || [];
  const tutors = tutorsResult.data || [];
  const enrollments: Enrollment[] = useMemo(
    () => enrollmentsResult.data ?? [],
    [enrollmentsResult.data],
  );
  const meetings = meetingsResult.data || [];
  // added enrollment filtering,
  const activeEnrollmentIds = useMemo(
    () => new Set(enrollments.map((enrollment: Enrollment) => enrollment.id)),
    [enrollments],
  );

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
      queryClient.invalidateQueries({
        queryKey: ["sessions", weekStart, weekEnd],
      });
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
  // refetch all of it before Update Week so new sessions arent created for deleted enrollments
  const handleUpdateWeek = async () => {
    const freshEnrollments =
      (await queryClient.fetchQuery({
        queryKey: ["enrollments", weekEnd],
        queryFn: () => getAllActiveEnrollments(weekEnd),
      })) ?? [];

    updateWeekMutation.mutate({ enrollments: freshEnrollments });
  };

  // Filter sessions with valid dates for display
  const getValidSessionsForDay = (day: Date) => {
    return sessions.filter((session) => {
      if (!session?.date) return false;
      try {
        if (
          !enrollmentsResult.isLoading &&
          session.enrollmentId &&
          !activeEnrollmentIds.has(session.enrollmentId)
        ) {
          return false;
        }
        return (
          format(
            toZonedTime(parseISO(session.date), "America/New_York"),
            "yyyy-MM-dd",
          ) === format(day, "yyyy-MM-dd")
        );
      } catch (error) {
        console.error("Error filtering session:", error);
        return false;
      }
    });
  };

  const removeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => removeSession(sessionId),
    onMutate: async (sessionId: string) => {
      await queryClient.cancelQueries({
        queryKey: ["sessions", weekStart, weekEnd],
      });
      const prevSessions = queryClient.getQueryData<Session[]>([
        "sessions",
        weekStart,
        weekEnd,
      ]);

      queryClient.setQueryData(
        ["sessions", weekStart, weekEnd],
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
          ["sessions", weekStart, weekEnd],
          context.prevSessions,
        );
      }
      console.error("Failed to remove session", error);
      toast.error("Failed to remove session");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["sessions", weekStart, weekEnd],
      });
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
      fetchSessions(weekStart, weekEnd);
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

      // Create a copy of the previous state
      const updated = { ...prev };

      if (name.includes(".")) {
        const [parent, child] = name.split(".");

        // Type guard to ensure parent is a valid key of Session
        if (parent === "student" || parent === "tutor") {
          // Ensure parent object exists
          const parentObj = (updated[parent] || {}) as Profile;

          // Update the nested property
          updated[parent] = {
            ...parentObj,
            [child]: value,
          };
        }
      } else {
        // Type guard to ensure name is a valid key of Session
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

  const goToPreviousWeek = () =>
    setCurrentWeek((prevWeek) => subWeeks(prevWeek, 1));
  const goToNextWeek = () =>
    setCurrentWeek((prevWeek) => addWeeks(prevWeek, 1));

  const getEnrollmentProgress = () => {
    const totalStudents = students.length;
    const studentsThisWeek = new Set(
      sessions.map((session) => session?.student?.id),
    ).size;
    return { totalStudents, studentsThisWeek };
  };

  // calc total and unique sessions for the week
  const getSessionStatistics = () => {
    const totalSessions = sessions.length;
    const tutorsInvolved = new Set(
      sessions.map((session) => session?.tutor?.id),
    ).size;
    return { totalSessions, tutorsInvolved };
  };

  const handleGetMissingSEF = async () => {
    try {
      await getEnrollmentsWithMissingSEF();
      toast.success("Printed to console");
    } catch (error) {
      console.error(error);
      toast.error("Please view Dev Console for error");
    }
  };

  return (
    <>
      <Toaster />
      <div className="p-8 bg-gray-100 min-h-screen">
        <h1 className="text-3xl font-bold mb-6 text-left text-gray-800">
          Schedule
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <Button
              variant="outline"
              onClick={goToPreviousWeek}
              className="flex items-center"
            >
              <ChevronLeft className="w-5 h-5 mr-2" /> Previous Week
            </Button>
            <h2 className="text-xl font-semibold text-gray-700">
              {format(weekDays[0], "MMMM d, yyyy")} -{" "}
              {format(weekDays[6], "MMMM d, yyyy")}
            </h2>
            <Button
              variant="outline"
              onClick={goToNextWeek}
              className="flex items-center"
            >
              Next Week <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          <Button
            onClick={handleUpdateWeek}
            disabled={isLoading}
            className="mb-4 bg-connect-me-blue-2"
          >
            {isLoading ? (
              <>
                Loading Sessions{"  "}
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Update Week"
            )}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="mx-4 bg-connect-me-blue-3">Add Session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Session</DialogTitle>
              </DialogHeader>

              <ScrollArea className="pr-4">
                {" "}
                <div className="grid gap-4 py-4">
                  <ProfileSelector
                    label="Student"
                    profiles={students}
                    selectedId={selectedStudentId}
                    onSelect={(id) => {
                      setSelectedStudentId(id);
                      handleInputChange({
                        target: { name: "student.id", value: id },
                      });
                    }}
                    placeholder="Select a student"
                  />

                  <ProfileSelector
                    label="Tutor"
                    profiles={tutors}
                    selectedId={selectedTutorId}
                    onSelect={(id) => {
                      setSelectedTutorId(id);
                      handleInputChange({
                        target: { name: "tutor.id", value: id },
                      });
                    }}
                    placeholder="Select a tutor"
                  />
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="startDate" className="text-right">
                      Date
                    </Label>
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
                        await checkMeetingAvailabilites(
                          updatedSession as Session,
                        );
                        setNewSession(updatedSession);
                      }}
                      disabled={isCheckingMeetingAvailability}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="duration" className="text-right">
                      Duration
                    </Label>{" "}
                    <div className="col-span-3">
                      {" "}
                      <Select
                        onValueChange={(value) => {
                          const duration = parseFloat(value);
                          const updatedSession: Partial<Session> = {
                            ...newSession,
                            duration: duration,
                          };
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
                            {Array.from(
                              { length: 12 },
                              (_, i) => (i + 1) * 0.25,
                            ).map((duration) => {
                              const minutes = (duration % 1) * 60;
                              const hours = Math.floor(duration);

                              return (
                                <SelectItem
                                  key={duration}
                                  value={duration.toString()}
                                >
                                  {hours} {hours > 1 ? "hours" : "hour"}{" "}
                                  {minutes} minutes
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="" className="text-right">
                      Meeting Link
                    </Label>
                    <div className="col-span-3">
                      {" "}
                      <Select
                        value={newSession?.meeting?.id || ""}
                        onOpenChange={(open) => {
                          if (open && newSession) {
                          }
                        }}
                        onValueChange={async (value) => {
                          setNewSession({
                            ...newSession,
                            meeting: await getMeeting(value),
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {newSession?.meeting?.name || "Select a meeting"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {meetings.map((meeting) => (
                            <SelectItem
                              key={meeting.id}
                              value={meeting.id}
                              className="flex items-center justify-between"
                            >
                              <span>{meeting.name}</span>
                              <Circle
                                className={`w-2 h-2 ml-2 ${
                                  meetingAvailabilityMap[meeting.id]
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

                  {/* Other form fields */}
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
          <Button
            className="bg-connect-me-blue-4"
            onClick={() => handleGetMissingSEF()}
          >
            Function Tester
          </Button>

          {isLoading ? (
            <div className="text-center py-10">
              <Calendar className="w-10 h-10 animate-spin mx-auto text-blue-500" />
              <p className="mt-4 text-gray-600">Loading sessions...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className="border rounded-lg px-2 py-3 bg-gray-50"
                >
                  <h3 className="font-semibold mb-2 text-gray-700">
                    {format(day, "EEEE")}
                  </h3>
                  <p className="text-sm mb-4 text-gray-500">
                    {format(day, "MMM d")}
                  </p>
                  {getValidSessionsForDay(day).map((session) => (
                    <Card
                      onClick={() => {
                        setSelectedSession(session);
                        setIsModalOpen(true);
                      }}
                      key={session.id}
                      className={`hover:cursor-pointer hover:shadow-md mb-2 ${
                        session.status === "Complete"
                          ? "bg-green-500/10 border-2"
                          : session.status === "Cancelled"
                            ? "bg-red-500/10 border-2"
                            : "bg-white"
                      }`}
                    >
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold">
                          {session.tutor?.firstName} {session.tutor?.lastName}
                        </p>
                        <p className="text-xs font-normal">
                          {session?.student?.firstName}{" "}
                          {session?.student?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.summary}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getSessionTimespan(session.date, session.duration)}{" "}
                          EDT
                        </p>
                        <div
                          className={`text-xs font-medium px-2 py-1 rounded-lg mt-1 border ${
                            session.meeting != null
                              ? "border-green-300 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {session?.meeting != null &&
                          session?.meeting.name != null
                            ? session?.meeting.name
                            : "No Meeting Link"}
                        </div>

                        <Button
                          className="hidden mt-2 w-full text-xs h-6"
                          onClick={() => {
                            setSelectedSession(session);
                            setIsModalOpen(true);
                          }}
                          variant="outline"
                        >
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {sessions.filter(
                    (session) =>
                      session?.date &&
                      format(parseISO(session.date), "yyyy-MM-dd") ===
                        format(day, "yyyy-MM-dd"),
                  ).length === 0 && (
                    <p className="text-sm text-gray-400 text-center">
                      No sessions
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-3xl font-bold mb-6 text-left text-gray-800">
            Enrollment Progress
          </h3>
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="font-medium">Total Students:</p>
                  <p>{getEnrollmentProgress().totalStudents}</p>
                </div>
                <div>
                  <p className="font-medium"># Of Unique Students This Week:</p>
                  <p>{getEnrollmentProgress().studentsThisWeek}</p>
                </div>
                <div>
                  <p className="font-medium">Total Sessions This Week:</p>
                  <p>{getSessionStatistics().totalSessions}</p>
                </div>
                <div>
                  <p className="font-medium">Tutors Involved This Week:</p>
                  <p>{getSessionStatistics().tutorsInvolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                    onValueChange={(
                      value: "Active" | "Complete" | "Cancelled",
                    ) => {
                      if (value && selectedSession) {
                        const updatedSession = {
                          ...selectedSession,
                          status: value,
                        };
                        setSelectedSession(updatedSession);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {selectedSession?.status
                          ? selectedSession.status
                          : "Select status"}
                      </SelectValue>
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
                      const selectedTutor =
                        await getProfileWithProfileId(value);
                      if (selectedTutor) {
                        setSelectedSession({
                          ...selectedSession,
                          tutor: selectedTutor,
                        });
                      }
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
                      {tutors.map(
                        (tutor) =>
                          tutor.status !== "Inactive" && (
                            <SelectItem key={tutor.id} value={tutor.id}>
                              {tutor.firstName} {tutor.lastName}
                            </SelectItem>
                          ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Student</Label>
                  <Select
                    value={selectedSession.student?.id}
                    onValueChange={async (value) => {
                      const selectedStudent =
                        await getProfileWithProfileId(value);
                      if (selectedStudent) {
                        setSelectedSession({
                          ...selectedSession,
                          student: selectedStudent,
                        });
                      }
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
                      {students.map(
                        (student) =>
                          student.status !== "Inactive" && (
                            <SelectItem key={student.id} value={student.id}>
                              {student.firstName} {student.lastName}
                            </SelectItem>
                          ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="datetime-local"
                    defaultValue={format(
                      parseISO(selectedSession.date),
                      "yyyy-MM-dd'T'HH:mm",
                    )}
                    onBlur={(e) => {
                      const scheduledDate = new Date(e.target.value);
                      setSelectedSession({
                        ...selectedSession,
                        date: scheduledDate.toISOString(),
                      });
                      checkMeetingAvailabilites(
                        selectedSession as Session,
                        // scheduledDate
                      );
                    }}
                  />
                </div>
                <div>
                  <Label>Meeting</Label>
                  <Select
                    value={selectedSession?.meeting?.id || ""}
                    onOpenChange={(open) => {}}
                    onValueChange={async (value) =>
                      setSelectedSession({
                        ...selectedSession,
                        meeting: await getMeeting(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {selectedSession?.meeting?.name || "Select a meeting"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map((meeting) => (
                        <SelectItem
                          key={meeting.id}
                          value={meeting.id}
                          className="flex items-center justify-between"
                        >
                          {/* <span>
                          {meeting.name} - {meeting.id}
                        </span> */}
                          <span>{meeting.name}</span>
                          <Circle
                            className={`w-2 h-2 ml-2 ${
                              meetingAvailabilityMap[meeting.id]
                                ? "text-green-500"
                                : "text-red-500"
                            } fill-current`}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-right">Notes (Only viewable Admin Side)</Label> {/* admin only notes label */}
                  <Textarea
                    value={selectedSession?.summary}
                    onChange={(e) =>
                      setSelectedSession({
                        ...selectedSession,
                        summary: e.target.value,
                      })
                    }
                  ></Textarea>
                </div>

                {(() => {
                  const rawSef = (selectedSession as any)?.session_exit_form as
                    | string
                    | null
                    | undefined; // pull sef string w null safe

                  const sefFlags: string[] = []; // keep sef boxes tiny
                  if ((selectedSession as any)?.isQuestionOrConcern)
                    sefFlags.push("question/concern"); // show tutor box
                  if ((selectedSession as any)?.isFirstSession)
                    sefFlags.push("first session"); // show tutor box
                  if (selectedSession.status === "Cancelled")
                    sefFlags.push("cancelled"); // quick context

                  let sefReasonText = rawSef ?? ""; // default to raw text
                  if (rawSef && rawSef.trim().startsWith("{")) {
                    try {
                      const parsed = JSON.parse(rawSef) as any; // handle future sef json
                      sefReasonText =
                        parsed?.reason ??
                        parsed?.notes ??
                        parsed?.exitReason ??
                        rawSef; // prefer explicit reason field
                      const extraFlags =
                        parsed?.boxes ?? parsed?.flags ?? parsed?.options; // try grab checkbox list
                      if (Array.isArray(extraFlags)) {
                        extraFlags
                          .filter((x) => typeof x === "string")
                          .forEach((x) => sefFlags.push(x)); // merge extra boxes
                      }
                    } catch {
                      // ignore parse fail, raw text fine
                    }
                  }

                  return (
                    <div>
                      <Label>SEF Exit Reason</Label> {/* show sef reason */}
                      <Textarea
                        readOnly
                        value={sefReasonText || ""}
                        placeholder="no session exit form yet"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        SEF boxes: {sefFlags.length ? sefFlags.join(", ") : "none"}
                      </p>
                    </div>
                  );
                })()}
                <div className="flex flex-col gap-3">
                  <Link
                    href={`/dashboard/session/${selectedSession.id}/participation`}
                    className="w-full"
                  >
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
                    <Button
                      variant="destructive"
                      onClick={() => handleRemoveSession(selectedSession.id)}
                    >
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
