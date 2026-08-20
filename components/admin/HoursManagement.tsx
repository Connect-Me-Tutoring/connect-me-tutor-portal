"use client";
import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  format,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  eachWeekOfInterval,
  parseISO,
  startOfWeek,
  addDays,
  getMonth,
  subDays,
} from "date-fns";
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
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllProfiles,
  getEventsWithTutorMonth,
  createEvent,
  createEventsBatch,
  removeEvent,
} from "@/lib/actions/admin.actions";
import { getEvents } from "@/lib/actions/event/client.actions";
import { getTutorSessions } from "@/lib/actions/tutor/actions";
import { Profile, Session, Event } from "@/types";
import { toast, Toaster } from "react-hot-toast";
import { Combobox } from "../ui/combobox";
import { Combobox2 } from "../ui/combobox2";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getAllEventHoursBatch,
  getAllEventHoursBatchWithType,
  getAllHours,
  getAllHoursBatch,
  getAllSessionHoursBatch,
  getEventHoursRangeBatch,
  getHoursRangeBatch,
  getSessionHoursRange,
  getSessionHoursRangeBatch,
  getTotalEventHoursRange,
  getTotalHours,
  getTotalHoursRange,
  getTotalSessionHoursRange,
} from "@/lib/actions/hours/actions";
import { resourceLimits } from "worker_threads";
import { number } from "zod";
import { Loader2, ChevronDown } from "lucide-react";
import { useEvents } from "@/hooks/events";
import { MobileCard } from "@/components/ui/mobile-card";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useLoadMore } from "@/hooks/useLoadMore";

const HoursManager = () => {
  const t = useTranslations("adminSchedule");
  const [tutors, setTutors] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessionsData, setSessionsData] = useState<{
    [key: string]: Session[];
  }>({});
  const [eventsData, setEventsData] = useState<{ [key: string]: Event[] }>({});
  const [allTimeHours, setAllTimeHours] = useState<{ [key: string]: number }>({});
  const [allTimeSessionHours, setAllTimeSessionHours] = useState<{
    [key: string]: number;
  }>({});

  const [eventHoursData, setEventHoursData] = useState<{
    [key: string]: { [key: string]: number };
  }>({});

  const [weeklySessionHours, setWeeklySessionHours] = useState<{
    [key: string]: { [key: string]: number };
  }>({});

  const [monthlyHours, setMonthlyHours] = useState<{ [key: string]: number }>({});
  const [totalSessionHours, setTotalSessionHours] = useState<{
    [key: string]: number;
  }>({});

  const [totalEventHours, setTotalEventHours] = useState<{
    [key: string]: number;
  }>({});

  const [totalMonthlyHours, setTotalMonthlyHours] = useState(0);
  const [totalHours, setTotalHours] = useState(0);

  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isRemoveEventModalOpen, setIsRemoveEventModalOpen] = useState(false);
  const [selectedTutorForEvent, setSelectedTutorForEvent] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({});
  const [eventsToRemove, setEventsToRemove] = useState<Event[]>([]);
  const [selectedEventToRemove, setSelectedEventToRemove] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState<string>("");
  const [filteredTutors, setFilteredTutors] = useState<Profile[]>([]);
  const [eventType, setEventType] = useState("");
  const [allTimeView, setAllTimeView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // sub hours multi-select state
  const [isSubHoursModalOpen, setIsSubHoursModalOpen] = useState(false);
  const [selectedSubTutors, setSelectedSubTutors] = useState<string[]>([]);
  const [subHoursDate, setSubHoursDate] = useState(format(subDays(new Date(), 1), "yyyy-MM-dd")); // defaults yesterday
  const [subHoursAmount, setSubHoursAmount] = useState<number>(1);
  const [subHoursSummary, setSubHoursSummary] = useState("");
  const [subHoursFilter, setSubHoursFilter] = useState("");
  const [showSelectedList, setShowSelectedList] = useState(false); // toggle selected tutors dropdown

  useEffect(() => {
    fetchTutors();
  }, []);

  useEffect(() => {
    if (tutors.length > 0) {
      if (allTimeView) {
        fetchAllTimeHours();
      } else {
        fetchHours();
      }
    }
  }, [tutors, selectedDate, allTimeView]);

  const fetchHours = async () => {
    setLoading(true);
    try {
      await Promise.all([
        calculateAllTimeHoursBatch(),
        calculateEventHours(),
        calculateWeeklyHoursForMonth(),
        calculateMonthHours(),
        calculateTotalMonthlyHours(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTimeHours = async () => {
    await Promise.all([
      calculateAllTimeHoursBatch(),
      calculateAllTimeEventHours(),
      calculateAllTimeSessionHours(),
      calculateTotalMonthlyHours(),
    ]);
  };

  useEffect(() => {
    const filtered = tutors.filter((tutor) => {
      const searchTerm = filterValue.toLowerCase().trim();

      if (!searchTerm) return true;

      const tutorFirstName = tutor.firstName?.toLowerCase() || "";
      const tutorLastName = tutor.lastName?.toLowerCase() || "";
      const tutorEmail = tutor.email?.toLowerCase() || "";

      return (
        tutorFirstName.includes(searchTerm) ||
        tutorLastName.includes(searchTerm) ||
        tutorEmail.includes(searchTerm) ||
        (tutorFirstName + " " + tutorLastName).includes(searchTerm)
      );
    });
    setFilteredTutors(filtered);

    //TODO Finish
  }, [filterValue, tutors]);

  const fetchTutors = async () => {
    try {
      const fetchedTutors = await getAllProfiles("Tutor");
      if (fetchedTutors) {
        setTutors(fetchedTutors);
        setFilteredTutors(fetchedTutors);
      }
    } catch (error) {
      console.error("Failed to fetch tutors:", error);
    }
  };

  const fetchSessionsAndEvents = async () => {
    const sessionsPromises = tutors.map((tutor) =>
      getTutorSessions(
        tutor.id,
        startOfMonth(selectedDate).toISOString(),
        endOfMonth(selectedDate).toISOString(),
      ),
    );
    const eventsPromises = tutors.map((tutor) =>
      getEventsWithTutorMonth(tutor?.id, startOfMonth(selectedDate).toISOString()),
    );

    try {
      const sessionsResults = await Promise.all(sessionsPromises);
      const eventsResults = await Promise.all(eventsPromises);

      const newSessionsData: { [key: string]: Session[] } = {};
      const newEventsData: { [key: string]: Event[] } = {};

      tutors.forEach((tutor, index) => {
        newSessionsData[tutor.id] = sessionsResults[index];
        if (eventsResults[index]) {
          newEventsData[tutor.id] = eventsResults[index];
        }
      });

      setSessionsData(newSessionsData);
      setEventsData(newEventsData);
    } catch (error) {
      console.error("Failed to fetch sessions or events:", error);
    }
  };

  const calculateAllTimeHours = async () => {
    const allTimeHoursPromises = tutors.map(async (tutor) => {
      // const allSessions = await getTutorSessions(tutor.id);
      // const allEvents = await getEvents(tutor.id);

      // const sessionHours = allSessions
      //   .filter((session) => session.status === "Complete")
      //   .reduce(
      //     (total, session) => total + calculateSessionDuration(session),
      //     0
      //   );
      // // .reduce((total, session) => total + 1.0)

      // const eventHours =
      //   allEvents?.reduce((total, event) => total + event?.hours, 0) || 0;

      const totalHours = await getAllHours(tutor.id);

      return { tutorId: tutor.id, hours: totalHours };
    });

    try {
      const results = await Promise.all(allTimeHoursPromises);
      const newAllTimeHours: { [key: string]: number } = {};
      results.forEach((result) => {
        newAllTimeHours[result.tutorId] = result.hours;
      });
      setAllTimeHours(newAllTimeHours);
    } catch (error) {
      console.error("Failed to calculate all-time hours:", error);
    }
  };

  const calculateAllTimeHoursBatch = async () => {
    try {
      const data = (await getAllHoursBatch()) as unknown as { [key: string]: number };
      setAllTimeHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.allTimeHoursError"));
    }
  };

  // const calculateWeeklySessionhours = async () => {
  //   try {
  //     weeksInMonth.map((week) => {
  //       const weekHours = getSessionHoursRange();
  //     });
  //   } catch (error) {}
  // };

  const calculateEventHours = async () => {
    try {
      const firstDay = startOfWeek(startOfMonth(selectedDate));
      const lastDay = endOfWeek(endOfMonth(selectedDate));

      const data = (await getEventHoursRangeBatch(
        firstDay.toISOString(),
        lastDay.toISOString(),
      )) as unknown as { [key: string]: { [key: string]: number } };
      setEventHoursData(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.eventHoursError"));
    }
  };

  const calculateSessionDuration = (session: Session) => {
    const start = new Date(session.date);
    const end = new Date(session.date);
    let sessionDuration = 60; // ! Subject to change
    end.setMinutes(end.getMinutes() + sessionDuration);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // Convert to hours
  };

  const calculateWeeklyHoursForMonth = async () => {
    const monthlySessionHours: { [key: string]: { [key: string]: number } } = {};

    const weekPromises = weeksInMonth.map(async (week) => {
      const nextWeek = addDays(week, 7);
      const data = (await getSessionHoursRangeBatch(
        week.toISOString(),
        nextWeek.toISOString(),
      )) as unknown as { [key: string]: number };
      return {
        weekKey: week.getTime().toString(),
        data: data,
      };
    });

    const results = await Promise.all(weekPromises);
    results.forEach(({ weekKey, data }) => {
      Object.entries(data).forEach(([tutorId, hours]) => {
        if (!monthlySessionHours[tutorId]) {
          monthlySessionHours[tutorId] = {};
        }
        monthlySessionHours[tutorId][weekKey] = hours;
      });
    });
    setWeeklySessionHours(monthlySessionHours);
  };

  const calculateMonthHours = async () => {
    try {
      const firstDay = startOfWeek(startOfMonth(selectedDate));
      const lastDay = endOfWeek(endOfMonth(selectedDate));

      const data = (await getHoursRangeBatch(
        firstDay.toISOString(),
        lastDay.toISOString(),
      )) as unknown as { [key: string]: number };
      setMonthlyHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.monthlyHoursError"));
    }
  };

  const calculateAllTimeEventHours = async () => {
    try {
      const data = (await getAllEventHoursBatch()) as unknown as {
        [key: string]: { [key: string]: number };
      };
      setEventHoursData(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.allTimeEventHoursError"));
    }
  };

  const calculateTotalMonthHours = async () => {
    try {
      const firstDay = startOfWeek(startOfMonth(selectedDate));
      const lastDay = endOfWeek(endOfMonth(selectedDate));

      const data: number = await getTotalHoursRange(firstDay.toISOString(), lastDay.toISOString());
      setTotalMonthlyHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.totalMonthlyHoursError"));
    }
  };

  const calculateTotalHours = async () => {
    try {
      const data: number = await getTotalHours();
      setTotalHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.totalHoursError"));
    }
  };

  const calculateAllTimeSessionHours = async () => {
    try {
      const data = (await getAllSessionHoursBatch()) as unknown as { [key: string]: number };
      setAllTimeSessionHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.allTimeSessionHoursError"));
    }
  };

  // const calculate = async () => {
  //   try {
  //     const data: number = await getTotalSessionHoursRange(
  //       firstDay.toISOString(),
  //       lastDay.toISOString()
  //     );
  //     return data;
  //   } catch (error) {
  //     toast.error("Error calculating total month hours");
  //   }
  // };

  const calculateTotalWeeklySessionHours = async () => {
    try {
      const weeklyTotalSessionHours: { [key: string]: number } = {};

      const weekPromises = weeksInMonth.map(async (week) => {
        const nextWeek = addDays(week, 7);

        const data: number = await getTotalSessionHoursRange(
          week.toISOString(),
          nextWeek.toISOString(),
        );
        return {
          weekKey: week.getTime().toString(),
          data: data,
        };
      });

      const results = await Promise.all(weekPromises);
      results.forEach(({ weekKey, data }) => {
        weeklyTotalSessionHours[weekKey] = data;
      });

      //--all montly hours
      const monthlyHours = await calculateMonthHours();

      setTotalSessionHours(weeklyTotalSessionHours);
    } catch (error) {
      toast.error(t("hoursManager.toasts.totalWeeklySessionHoursError"));
    }
  };

  const calculateTotalEventHours = async () => {
    try {
      const firstDay = startOfWeek(startOfMonth(selectedDate));
      const lastDay = endOfWeek(endOfMonth(selectedDate));
      const data = (await getTotalEventHoursRange(
        firstDay.toISOString(),
        lastDay.toISOString(),
      )) as unknown as { [key: string]: number };

      setTotalEventHours(data);
    } catch (error) {
      toast.error(t("hoursManager.toasts.totalEventHoursError"));
    }
  };

  const calculateTotalMonthlyHours = async () => {
    try {
      await Promise.all([
        calculateTotalWeeklySessionHours(),
        calculateTotalEventHours(),
        calculateTotalMonthHours(),
        calculateTotalHours(),
      ]);
    } catch (error) {
      toast.error(t("hoursManager.toasts.totalSessionHoursError"));
    }
  };

  const calculateExtraHours = (tutorId: string) => {
    return eventsData[tutorId]?.reduce((total, event) => total + event.hours, 0) || 0;
  };

  // const calculateMonthHours = (tutorId: string) => {
  //   const sessionHours =
  //     sessionsData[tutorId]
  //       ?.filter((session) => session.status === "Complete")
  //       .reduce((total, session) => total + 1, 0) || 0;
  //   const extraHours = calculateExtraHours(tutorId);
  //   return sessionHours + extraHours;
  // };

  const weeksInMonth = eachWeekOfInterval({
    start: startOfMonth(selectedDate),
    end: endOfMonth(selectedDate),
  });

  const monthYearOptions = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return date;
  });

  const handleAddEvent = async () => {
    if (newEvent.tutorId && newEvent.date && newEvent.hours && newEvent.summary && newEvent.type) {
      try {
        await createEvent(newEvent as Event);
        toast.success(t("hoursManager.toasts.eventAdded"));
        setIsAddEventModalOpen(false);
        setNewEvent({});
        setEventType("");
        fetchSessionsAndEvents();
      } catch (error) {
        console.error("Failed to add event:", error);
        toast.error(t("hoursManager.toasts.eventAddError"));
      }
    } else {
      toast.error(t("hoursManager.toasts.fillAllFields"));
    }
  };

  const handleRemoveEvent = async () => {
    if (selectedEventToRemove) {
      try {
        const res = await removeEvent(selectedEventToRemove);
        if (res) toast.success(t("hoursManager.toasts.eventRemoved"));
        else toast.error(t("hoursManager.toasts.eventRemoveUnable"));
        setIsRemoveEventModalOpen(false);
        setSelectedEventToRemove(null);
        fetchSessionsAndEvents();
      } catch (error) {
        console.error("Failed to remove event:", error);
        toast.error(t("hoursManager.toasts.eventRemoveError"));
      }
    } else {
      toast.error(t("hoursManager.toasts.selectEventToRemove"));
    }
  };

  const handleEditEvent = async () => {
    try {
    } catch (error) {}
  };

  // bulk add sub hotline hours to selected tutors
  const handleAddSubHours = async () => {
    if (selectedSubTutors.length === 0) {
      toast.error(t("hoursManager.toasts.selectAtLeastOneTutor"));
      return;
    }
    if (!subHoursDate || !subHoursAmount) {
      toast.error(t("hoursManager.toasts.fillDateAndHours"));
      return;
    }
    try {
      const events: Event[] = selectedSubTutors.map((tutorId) => ({
        id: "",
        createdAt: "",
        tutorId,
        date: subHoursDate,
        hours: subHoursAmount,
        type: "Sub Hotline",
        summary: subHoursSummary || "sub hours",
      }));
      await createEventsBatch(events);
      toast.success(t("hoursManager.toasts.subHoursAdded", { count: selectedSubTutors.length }));
      setIsSubHoursModalOpen(false);
      setSelectedSubTutors([]);
      setSubHoursSummary("");
      setSubHoursAmount(1);
      setSubHoursDate(format(subDays(new Date(), 1), "yyyy-MM-dd")); // reset to yesterday
      fetchSessionsAndEvents();
    } catch (error) {
      console.error("Failed to add sub hours:", error);
      toast.error(t("hoursManager.toasts.subHoursAddError"));
    }
  };

  // toggle tutor in multi-select list
  const toggleSubTutor = (tutorId: string) => {
    setSelectedSubTutors((prev) =>
      prev.includes(tutorId) ? prev.filter((id) => id !== tutorId) : [...prev, tutorId],
    );
  };

  const handleFetchEvents = async (value: string) => {
    try {
      // Show loading state
      toast.loading(t("hoursManager.toasts.loadingEvents"));
      const events = await getEvents(value, {
        field: "date",
        ascending: false,
      });
      setEventsToRemove(events || []);
      toast.dismiss();
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast.error(t("hoursManager.toasts.eventsLoadError"));
    }
  };

  // Translated copy for the PDF report. HoursReport.tsx is rendered outside the
  // Next.js request/render tree (invoked from an API route via @react-pdf/renderer),
  // so it can't call useTranslations/getTranslations itself — the already-resolved
  // strings are passed through as part of the request payload instead. Template
  // strings use %TOKEN% placeholders (not ICU {}) that HoursReport.tsx fills in with
  // values only known once the PDF is being assembled (name, hours, percentages, etc).
  const hoursReportLabels = {
    table: {
      tutorName: t("hoursReport.table.tutorName"),
      allSessions: t("hoursReport.table.allSessions"),
      biweeklyMeetings: t("hoursReport.table.biweeklyMeetings"),
      tutorReferral: t("hoursReport.table.tutorReferral"),
      subHotline: t("hoursReport.table.subHotline"),
      other: t("hoursReport.table.other"),
      allTimeTotal: t("hoursReport.table.allTimeTotal"),
      thisMonth: t("hoursReport.table.thisMonth"),
      totals: t("hoursReport.table.totals"),
    },
    header: {
      allTimeTitle: t("hoursReport.header.allTimeTitle"),
      monthlyTitle: t("hoursReport.header.monthlyTitle"),
      allTimeSubtitle: t("hoursReport.header.allTimeSubtitle"),
      monthlySubtitleTemplate: t("hoursReport.header.monthlySubtitleTemplate"),
      generatedOnTemplate: t("hoursReport.header.generatedOnTemplate"),
    },
    stats: {
      title: t("hoursReport.stats.title"),
      activeTutors: t("hoursReport.stats.activeTutors"),
      totalHours: t("hoursReport.stats.totalHours"),
      avgHoursPerTutor: t("hoursReport.stats.avgHoursPerTutor"),
      eventHours: t("hoursReport.stats.eventHours"),
    },
    insights: {
      title: t("hoursReport.insights.title"),
      topPerformerTemplate: t("hoursReport.insights.topPerformerTemplate"),
      activePercentageTemplate: t("hoursReport.insights.activePercentageTemplate"),
      eventPercentageTemplate: t("hoursReport.insights.eventPercentageTemplate"),
    },
    footer: {
      title: t("hoursReport.footer.title"),
      reportPeriodTemplate: t("hoursReport.footer.reportPeriodTemplate"),
      reportPeriodAllTime: t("hoursReport.footer.reportPeriodAllTime"),
      pageOfTemplate: t("hoursReport.footer.pageOfTemplate"),
    },
    monthAbbreviations: t.raw("hoursReport.monthAbbreviations") as string[],
  };

  // Sample data to test the basic PDF
  const reportData = {
    selectedDate: selectedDate,
    tutors: tutors,
    allTimeView: allTimeView,
    totalSessionHours: totalSessionHours,
    totalEventHours: totalEventHours,
    totalMonthlyHours: totalMonthlyHours,
    totalHours: totalHours,
    allTimeSessionHours: allTimeSessionHours,
    eventHoursData: eventHoursData,
    allTimeHours: allTimeHours,
    weeklySessionHours: weeklySessionHours,
    monthlyHours: monthlyHours,
    filteredTutors: filteredTutors,
    logoUrl: "/logo.png",
    month: getMonth(selectedDate).toString(),
    labels: hoursReportLabels,
  };

  // Example of how to call the API from the frontend
  const handleDownloadHoursReport = async () => {
    try {
      setReportLoading(true);
      const response = await fetch("/api/admin/create-hours-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.pdf";
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Failed to generate PDF");
      }
      setReportLoading(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error(t("hoursManager.toasts.downloadReportError"));
    }
  };

  const {
    visibleItems: visibleTutors,
    hasMore: hasMoreTutors,
    loadMore: loadMoreTutors,
  } = useLoadMore(filteredTutors);

  return (
    <main className="p-8">
      <div>
        <h1 className="text-3xl font-bold mb-6">{t("hoursManager.title")}</h1>
      </div>
      <div>
        <div className="overflow-x-auto flex-grow bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-4">
              <Input
                type="text"
                placeholder={t("hoursManager.filterPlaceholder")}
                className="w64"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
              <div className="flex space-x-4">
                <Select
                  value={allTimeView ? "All Time" : selectedDate?.toISOString() || "placeholder"}
                  onValueChange={(value) => {
                    if (value === "All Time") {
                      setAllTimeView(true);
                    } else {
                      setAllTimeView(false);
                      setSelectedDate(new Date(value));
                      // fetchHours();
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t("hoursManager.monthSelectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem disabled={loading} value="All Time">
                      {t("hoursManager.allTime")}
                    </SelectItem>
                    {monthYearOptions.map((date) => (
                      <SelectItem key={date.toISOString()} value={date.toISOString()}>
                        {format(date, "MMMM yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isAddEventModalOpen} onOpenChange={setIsAddEventModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-connect-me-blue-2"
                      onClick={() => setIsAddEventModalOpen(true)}
                    >
                      {t("hoursManager.buttons.addEvent")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("hoursManager.addEventDialog.title")}</DialogTitle>
                    </DialogHeader>
                    <Combobox
                      list={tutors
                        // .filter((student) => student.status === "Active")
                        .map((tutor) => ({
                          value: tutor.id,
                          label: `${tutor.firstName} ${tutor.lastName} - ${tutor.email}`,
                        }))}
                      category="tutor"
                      onValueChange={(value) => setNewEvent({ ...newEvent, tutorId: value })}
                    />
                    <Select
                      value={eventType}
                      onValueChange={(value) => {
                        setEventType(value);
                        setNewEvent({ ...newEvent, type: value as Event["type"] });
                      }}
                    >
                      <SelectTrigger className="">
                        <SelectValue placeholder={t("hoursManager.addEventDialog.typePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tutor Referral">
                          {t("hoursManager.addEventDialog.types.tutorReferral")}
                        </SelectItem>
                        <SelectItem value="Sub Hotline">
                          {t("hoursManager.addEventDialog.types.subHotline")}
                        </SelectItem>
                        <SelectItem value="Additional Tutoring Hours">
                          {t("hoursManager.addEventDialog.types.additionalTutoringHours")}
                        </SelectItem>
                        <SelectItem value="School Tutoring">
                          {t("hoursManager.addEventDialog.types.schoolTutoring")}
                        </SelectItem>
                        <SelectItem value="Biweekly Meeting">
                          {t("hoursManager.addEventDialog.types.biweeklyMeeting")}
                        </SelectItem>
                        <SelectItem value="Other">
                          {t("hoursManager.addEventDialog.types.other")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      placeholder={t("hoursManager.addEventDialog.datePlaceholder")}
                    />
                    <Input
                      type="number"
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          hours: parseFloat(e.target.value),
                        })
                      }
                      placeholder={t("hoursManager.addEventDialog.hoursPlaceholder")}
                    />

                    <Input
                      type="text"
                      onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                      placeholder={t("hoursManager.addEventDialog.summaryPlaceholder")}
                    />
                    <Button className="bg-connect-me-blue-2" onClick={handleAddEvent}>
                      {t("hoursManager.buttons.addEvent")}
                    </Button>
                  </DialogContent>
                </Dialog>
                <Dialog open={isRemoveEventModalOpen} onOpenChange={setIsRemoveEventModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-connect-me-blue-3"
                      onClick={() => setIsRemoveEventModalOpen(true)}
                    >
                      {t("hoursManager.buttons.removeEvent")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("hoursManager.removeEventDialog.title")}</DialogTitle>
                    </DialogHeader>
                    <Combobox
                      list={tutors
                        // .filter((student) => student.status === "Active")
                        .map((tutor) => ({
                          value: tutor.id,
                          label: `${tutor.firstName} ${tutor.lastName} - ${tutor.email}`,
                        }))}
                      category="tutor"
                      onValueChange={(value) => handleFetchEvents(value)}
                    />
                    {eventsToRemove && (
                      <Select onValueChange={(value) => setSelectedEventToRemove(value)}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("hoursManager.removeEventDialog.eventPlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {eventsToRemove.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              <div className="flex justify-between w-full">
                                <span>
                                  {format(parseISO(event.date), "yyyy-MM-dd")} - {event.summary}
                                </span>
                                <span className="font-semibold ml-2">
                                  {event.hours} {t("hoursManager.removeEventDialog.hoursSuffix")}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button className="bg-connect-me-3" onClick={handleRemoveEvent}>
                      {t("hoursManager.buttons.removeEvent")}
                    </Button>
                  </DialogContent>
                </Dialog>

                <Dialog open={isSubHoursModalOpen} onOpenChange={setIsSubHoursModalOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-connect-me-blue-2"
                      onClick={() => setIsSubHoursModalOpen(true)}
                    >
                      {t("hoursManager.buttons.addSubHours")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>{t("hoursManager.subHoursDialog.title")}</DialogTitle>
                    </DialogHeader>
                    {/* date defaults to yesterday, still editable */}
                    <Input
                      type="date"
                      value={subHoursDate}
                      onChange={(e) => setSubHoursDate(e.target.value)}
                    />
                    <Input
                      type="number"
                      value={subHoursAmount}
                      onChange={(e) => setSubHoursAmount(parseFloat(e.target.value))}
                      placeholder={t("hoursManager.subHoursDialog.hoursPlaceholder")}
                    />
                    <Input
                      type="text"
                      value={subHoursSummary}
                      onChange={(e) => setSubHoursSummary(e.target.value)}
                      placeholder={t("hoursManager.subHoursDialog.summaryPlaceholder")}
                    />
                    {/* multi-select tutor list w/ filter */}
                    <Input
                      type="text"
                      placeholder={t("hoursManager.subHoursDialog.filterPlaceholder")}
                      value={subHoursFilter}
                      onChange={(e) => setSubHoursFilter(e.target.value)}
                    />
                    <div className="overflow-y-auto max-h-[300px] border rounded-md p-2 space-y-1">
                      {tutors
                        .filter((tutor) => {
                          const q = subHoursFilter.toLowerCase();
                          if (!q) return true;
                          return (
                            (tutor.firstName?.toLowerCase() || "").includes(q) ||
                            (tutor.lastName?.toLowerCase() || "").includes(q) ||
                            (tutor.email?.toLowerCase() || "").includes(q)
                          );
                        })
                        .map((tutor) => (
                          <label
                            key={tutor.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={selectedSubTutors.includes(tutor.id)}
                              onCheckedChange={() => toggleSubTutor(tutor.id)}
                            />
                            {tutor.firstName} {tutor.lastName}
                            <span className="text-gray-400 ml-auto text-xs">{tutor.email}</span>
                          </label>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                      {/* selected count w/ expandable list */}
                      <button
                        type="button"
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        onClick={() => setShowSelectedList((v) => !v)}
                      >
                        {t("hoursManager.subHoursDialog.selectedCount", {
                          count: selectedSubTutors.length,
                        })}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${showSelectedList ? "rotate-180" : ""}`}
                        />
                      </button>
                      <Button className="bg-connect-me-blue-2" onClick={handleAddSubHours}>
                        {t("hoursManager.subHoursDialog.submit")}
                      </Button>
                    </div>
                    {/* dropdown showing who's selected */}
                    {showSelectedList && selectedSubTutors.length > 0 && (
                      <div className="border rounded-md p-2 space-y-1 max-h-[150px] overflow-y-auto bg-gray-50 text-sm">
                        {tutors
                          .filter((tutor) => selectedSubTutors.includes(tutor.id))
                          .map((tutor) => (
                            <div
                              key={tutor.id}
                              className="flex items-center justify-between px-2 py-0.5"
                            >
                              <span>
                                {tutor.firstName} {tutor.lastName}
                              </span>
                              <button
                                type="button"
                                className="text-xs text-red-400 hover:text-red-600"
                                onClick={() => toggleSubTutor(tutor.id)}
                              >
                                {t("hoursManager.subHoursDialog.remove")}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  disabled={reportLoading}
                  onClick={handleDownloadHoursReport}
                  className="bg-connect-me-blue-4"
                >
                  {t("hoursManager.buttons.downloadReport")}
                  {reportLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : ""}
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-white">
                    {t("hoursManager.table.tutorName")}
                  </TableHead>
                  {allTimeView ? (
                    <>
                      <TableHead>{t("hoursManager.table.allSessions")}</TableHead>
                      <TableHead>{t("hoursManager.table.biweeklyMeetings")}</TableHead>
                      <TableHead>{t("hoursManager.table.tutorReferral")}</TableHead>
                      <TableHead>{t("hoursManager.table.subHotline")}</TableHead>
                      <TableHead>{t("hoursManager.table.other")}</TableHead>
                      <TableHead>{t("hoursManager.table.allTime")}</TableHead>
                    </>
                  ) : (
                    <>
                      {weeksInMonth.map((week) => (
                        <TableHead key={week.toISOString()}>
                          {format(week, "MMM d")} - {format(addDays(week, 6), "MMM d")}
                        </TableHead>
                      ))}
                      <TableHead>{t("hoursManager.table.biweeklyMeetings")}</TableHead>
                      <TableHead>{t("hoursManager.table.tutorReferral")}</TableHead>
                      <TableHead>{t("hoursManager.table.subHotline")}</TableHead>
                      <TableHead>{t("hoursManager.table.other")}</TableHead>
                      <TableHead>{t("hoursManager.table.thisMonth")}</TableHead>
                      <TableHead>{t("hoursManager.table.allTime")}</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTimeView ? (
                  ""
                ) : (
                  <TableRow key={"total hours"}>
                    <TableCell>{t("hoursManager.table.total")}</TableCell>
                    {weeksInMonth.map((week) => {
                      const hours = totalSessionHours[week.getTime().toString()]
                        ? totalSessionHours[week.getTime().toString()] || ""
                        : "";

                      return <TableCell key={week.toString()}>{hours}</TableCell>;
                    })}
                    <TableCell>{totalEventHours["Biweekly Meeting"]}</TableCell>
                    <TableCell>{totalEventHours["Tutor Referral"]}</TableCell>
                    <TableCell>{totalEventHours["Sub Hotline"]}</TableCell>
                    <TableCell>{totalEventHours["Other"]}</TableCell>
                    <TableCell>{totalMonthlyHours}</TableCell>
                    <TableCell>{totalHours}</TableCell>
                  </TableRow>
                )}
                {filteredTutors.map((tutor) => (
                  <TableRow key={tutor.id}>
                    <TableCell className="sticky left-0 z-10 bg-white">
                      {tutor.firstName} {tutor.lastName}
                    </TableCell>
                    {allTimeView ? (
                      <>
                        {" "}
                        <TableCell>{allTimeSessionHours[tutor.id] || ""}</TableCell>
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Biweekly Meeting"] || ""
                            : ""}
                        </TableCell>
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Tutor Referral"] || ""
                            : ""}
                        </TableCell>
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Sub Hotline"] || ""
                            : ""}
                        </TableCell>
                        <TableCell>
                          {/* {calculateExtraHours(tutor.id).toFixed(2)}
                           */}
                          {eventHoursData[tutor.id] ? eventHoursData[tutor.id]["Other"] || "" : ""}
                        </TableCell>
                        <TableCell>{allTimeHours[tutor.id] || ""}</TableCell>
                      </>
                    ) : (
                      <>
                        {weeksInMonth.map((week) => {
                          const hours = weeklySessionHours[tutor.id]
                            ? weeklySessionHours[tutor.id][week.getTime().toString()] || ""
                            : "";

                          return <TableCell key={week.toString()}>{hours}</TableCell>;
                        })}
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Biweekly Meetings"]
                            : ""}
                        </TableCell>
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Tutor Referral"] || ""
                            : ""}
                        </TableCell>
                        <TableCell>
                          {eventHoursData[tutor.id]
                            ? eventHoursData[tutor.id]["Sub Hotline"] || ""
                            : ""}
                        </TableCell>

                        <TableCell>
                          {/* {calculateExtraHours(tutor.id).toFixed(2)}
                           */}
                          {eventHoursData[tutor.id] ? eventHoursData[tutor.id]["Other"] || "" : ""}
                        </TableCell>
                        <TableCell>{monthlyHours[tutor.id] || ""}</TableCell>
                        <TableCell>{allTimeHours[tutor.id] || ""}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {!allTimeView && (
              <MobileCard className="bg-muted/50">
                <div className="font-semibold text-base">{t("hoursManager.mobile.totals")}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>{t("hoursManager.table.biweeklyMeetings")}</div>
                  <div>{totalEventHours["Biweekly Meeting"] || ""}</div>
                  <div>{t("hoursManager.table.tutorReferral")}</div>
                  <div>{totalEventHours["Tutor Referral"] || ""}</div>
                  <div>{t("hoursManager.table.subHotline")}</div>
                  <div>{totalEventHours["Sub Hotline"] || ""}</div>
                  <div>{t("hoursManager.table.other")}</div>
                  <div>{totalEventHours["Other"] || ""}</div>
                  <div>{t("hoursManager.table.thisMonth")}</div>
                  <div>{totalMonthlyHours}</div>
                  <div>{t("hoursManager.table.allTime")}</div>
                  <div>{totalHours}</div>
                </div>
                <div className="flex gap-2 overflow-x-auto pt-1">
                  {weeksInMonth.map((week) => (
                    <span
                      key={week.toISOString()}
                      className="shrink-0 text-xs bg-white border rounded-md px-2 py-1 whitespace-nowrap"
                    >
                      {format(week, "MMM d")}-{format(addDays(week, 6), "MMM d")}:{" "}
                      {totalSessionHours[week.getTime().toString()] || 0}h
                    </span>
                  ))}
                </div>
              </MobileCard>
            )}

            {visibleTutors.map((tutor) => (
              <MobileCard key={tutor.id}>
                <div className="font-semibold text-base">
                  {tutor.firstName} {tutor.lastName}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {allTimeView ? (
                    <>
                      <div>{t("hoursManager.table.allSessions")}</div>
                      <div>{allTimeSessionHours[tutor.id] || ""}</div>
                      <div>{t("hoursManager.table.biweeklyMeetings")}</div>
                      <div>{eventHoursData[tutor.id]?.["Biweekly Meeting"] || ""}</div>
                      <div>{t("hoursManager.table.tutorReferral")}</div>
                      <div>{eventHoursData[tutor.id]?.["Tutor Referral"] || ""}</div>
                      <div>{t("hoursManager.table.subHotline")}</div>
                      <div>{eventHoursData[tutor.id]?.["Sub Hotline"] || ""}</div>
                      <div>{t("hoursManager.table.other")}</div>
                      <div>{eventHoursData[tutor.id]?.["Other"] || ""}</div>
                      <div>{t("hoursManager.table.allTime")}</div>
                      <div>{allTimeHours[tutor.id] || ""}</div>
                    </>
                  ) : (
                    <>
                      <div>{t("hoursManager.table.biweeklyMeetings")}</div>
                      <div>{eventHoursData[tutor.id]?.["Biweekly Meetings"] || ""}</div>
                      <div>{t("hoursManager.table.tutorReferral")}</div>
                      <div>{eventHoursData[tutor.id]?.["Tutor Referral"] || ""}</div>
                      <div>{t("hoursManager.table.subHotline")}</div>
                      <div>{eventHoursData[tutor.id]?.["Sub Hotline"] || ""}</div>
                      <div>{t("hoursManager.table.other")}</div>
                      <div>{eventHoursData[tutor.id]?.["Other"] || ""}</div>
                      <div>{t("hoursManager.table.thisMonth")}</div>
                      <div>{monthlyHours[tutor.id] || ""}</div>
                      <div>{t("hoursManager.table.allTime")}</div>
                      <div>{allTimeHours[tutor.id] || ""}</div>
                    </>
                  )}
                </div>
                {!allTimeView && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {weeksInMonth.map((week) => (
                      <span
                        key={week.toISOString()}
                        className="shrink-0 text-xs bg-muted rounded-md px-2 py-1 whitespace-nowrap"
                      >
                        {format(week, "MMM d")}-{format(addDays(week, 6), "MMM d")}:{" "}
                        {weeklySessionHours[tutor.id]?.[week.getTime().toString()] || 0}h
                      </span>
                    ))}
                  </div>
                )}
              </MobileCard>
            ))}
            <LoadMoreButton hasMore={hasMoreTutors} onClick={loadMoreTutors} />
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  );
};

export default HoursManager;
