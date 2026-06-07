"use client";

import React, { use, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
} from "date-fns";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WeeklyMeetingSchedule } from "@/types/meeting";
import { Meeting } from "@/types";
import { updateWeeklyMeetingSchedule } from "@/lib/actions/meeting-schedule.server.actions";
import { getWeeklyMeetingSchedules } from "@/lib/actions/meeting-schedule.client.actions";
import { checkAvailableMeetingForWeeklySchedules } from "@/lib/utils/meeting-schedule.utils";
import { toast, Toaster } from "react-hot-toast";

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7am–11pm

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

const WEEK_DAYS_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// 7:00 AM through 12:00 AM (midnight) in 30-minute increments
const TIME_OPTIONS = Array.from({ length: 35 }, (_, i) => {
  const totalMins = 7 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const label = `${h % 12 === 0 ? 12 : h % 12}:${m === 0 ? "00" : m} ${h % 24 < 12 ? "AM" : "PM"}`;
  return { value: `${String(h).padStart(2, "0")}:${m === 0 ? "00" : m}`, label };
});

const EMPTY_FORM = {
  title: "",
  description: "",
  day: "",
  startTime: "",
  endTime: "",
  meetingId: "",
};

function scheduleToForm(s: WeeklyMeetingSchedule) {
  return {
    title: s.title,
    description: s.description,
    day: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    meetingId: s.meetingId ?? "",
  };
}

interface Props {
  meetingsPromise: Promise<Meeting[] | null>;
  enrollmentsPromise: Promise<Enrollment[]>;
}

interface ZoomLinkSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  meetings: Meeting[];
  availability: Record<string, boolean>;
}

function ZoomLinkSelect({ value, onChange, disabled, placeholder, meetings, availability }: ZoomLinkSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {meetings.map((meeting) => {
          const available = availability[meeting.id] ?? true;
          return (
            <SelectItem key={meeting.id} value={meeting.id} disabled={!available}>
              <span className="flex items-center gap-2">
                <span className={cn(
                  "inline-block h-2 w-2 rounded-full flex-shrink-0",
                  available ? "bg-green-500" : "bg-red-500",
                )} />
                {meeting.name}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

interface EventFormFieldsProps {
  f: typeof EMPTY_FORM;
  setF: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  canCheck: boolean;
  availability: Record<string, boolean>;
  idPrefix: string;
  meetings: Meeting[];
}

function EventFormFields({ f, setF, canCheck, availability, idPrefix, meetings }: EventFormFieldsProps) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          placeholder="Event title"
          value={f.title}
          onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          placeholder="Optional description"
          rows={3}
          value={f.description}
          onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Day</Label>
        <Select value={f.day} onValueChange={(v) => setF((p) => ({ ...p, day: v, meetingId: "" }))}>
          <SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger>
          <SelectContent>
            {WEEK_DAYS_LABELS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Start time</Label>
          <Select value={f.startTime} onValueChange={(v) => setF((p) => ({ ...p, startTime: v, meetingId: "" }))}>
            <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>End time</Label>
          <Select value={f.endTime} onValueChange={(v) => setF((p) => ({ ...p, endTime: v, meetingId: "" }))}>
            <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Zoom Link</Label>
        <ZoomLinkSelect
          value={f.meetingId}
          onChange={(v) => setF((p) => ({ ...p, meetingId: v }))}
          disabled={!canCheck}
          placeholder={canCheck ? "Select a zoom link" : "Set day & times first"}
          meetings={meetings}
          availability={availability}
        />
      </div>
    </div>
  );
}

export default function HQSchedule({ meetingsPromise, enrollmentsPromise }: Props) {
  const rawMeetings = use(meetingsPromise) ?? [];
  // Surface the HQ link at the top of the meeting dropdowns
  const meetings = useMemo(
    () =>
      [...rawMeetings].sort((a, b) => {
        const aHq = a.name === "Zoom Link HQ";
        const bHq = b.name === "Zoom Link HQ";
        if (aHq === bHq) return 0;
        return aHq ? -1 : 1;
      }),
    [rawMeetings],
  );
  const allEnrollments = use(enrollmentsPromise);

  const { data: existingSchedules = [] } = useQuery({
    queryKey: ["weekly-meeting-schedules"],
    queryFn: getWeeklyMeetingSchedules,
    throwOnError: (error) => {
      toast.error(`Failed to load schedules: ${error.message}`);
      return false;
    },
  });

  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editOpen, setEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WeeklyMeetingSchedule | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [viewMeetingId, setViewMeetingId] = useState<string>("all");

  const addAvailability = useMemo<Record<string, boolean>>(() => {
    if (!form.day || !form.startTime || !form.endTime) return {};
    return checkAvailableMeetingForWeeklySchedules(
      { dayOfWeek: form.day as WeeklyMeetingSchedule["dayOfWeek"], startTime: form.startTime, endTime: form.endTime },
      existingSchedules,
      meetings,
    );
  }, [form.day, form.startTime, form.endTime, existingSchedules, meetings]);

  // Exclude the schedule being edited from the conflict check so it doesn't block itself
  const editAvailability = useMemo<Record<string, boolean>>(() => {
    if (!editForm.day || !editForm.startTime || !editForm.endTime) return {};
    const others = existingSchedules.filter((s) => s.id !== editingSchedule?.id);
    return checkAvailableMeetingForWeeklySchedules(
      { dayOfWeek: editForm.day as WeeklyMeetingSchedule["dayOfWeek"], startTime: editForm.startTime, endTime: editForm.endTime },
      others,
      meetings,
    );
  }, [editForm.day, editForm.startTime, editForm.endTime, existingSchedules, editingSchedule, meetings]);

  const invalidateSchedules = () =>
    queryClient.invalidateQueries({ queryKey: ["weekly-meeting-schedules"] });

  const handleAdd = async () => {
    const slot: WeeklyMeetingSchedule = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      meetingId: form.meetingId,
      title: form.title,
      description: form.description,
      dayOfWeek: form.day as WeeklyMeetingSchedule["dayOfWeek"],
      startTime: form.startTime,
      endTime: form.endTime,
    };
    try {
      await updateWeeklyMeetingSchedule(slot);
      toast.success("Event saved");
      invalidateSchedules();
      setForm(EMPTY_FORM);
      setAddOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save event");
    }
  };

  const handleEdit = async () => {
    if (!editingSchedule) return;
    const slot: WeeklyMeetingSchedule = {
      ...editingSchedule,
      meetingId: editForm.meetingId,
      title: editForm.title,
      description: editForm.description,
      dayOfWeek: editForm.day as WeeklyMeetingSchedule["dayOfWeek"],
      startTime: editForm.startTime,
      endTime: editForm.endTime,
    };
    try {
      await updateWeeklyMeetingSchedule(slot);
      toast.success("Event updated");
      invalidateSchedules();
      setEditOpen(false);
      setEditingSchedule(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update event");
    }
  };

  const openEdit = (s: WeeklyMeetingSchedule) => {
    setEditingSchedule(s);
    setEditForm(scheduleToForm(s));
    setEditOpen(true);
  };

  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const canCheckAdd = !!(form.day && form.startTime && form.endTime);
  const canCheckEdit = !!(editForm.day && editForm.startTime && editForm.endTime);

  const visibleSchedules = useMemo(
    () =>
      viewMeetingId === "all"
        ? existingSchedules
        : existingSchedules.filter((s) => s.meetingId === viewMeetingId),
    [existingSchedules, viewMeetingId],
  );

  const schedulesForDay = (dayName: string) =>
    visibleSchedules.filter((s) => s.dayOfWeek === dayName);

  const visibleEnrollments = useMemo(
    () =>
      allEnrollments.filter((e) =>
        viewMeetingId === "all" ? !!e.meetingId : e.meetingId === viewMeetingId,
      ),
    [allEnrollments, viewMeetingId],
  );

  const enrollmentsForDay = (dayName: string) =>
    visibleEnrollments.filter((e) => e.day === dayName);

  const selectedMeetingName = meetings.find((m) => m.id === viewMeetingId)?.name;

  return (
    <>
      <Toaster />
      <div className="flex flex-col h-full min-h-screen bg-gray-50 text-connect-me-gray-3">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <Select value={viewMeetingId} onValueChange={setViewMeetingId}>
              <SelectTrigger className="ml-3 w-44 text-sm">
                <SelectValue>
                  {viewMeetingId === "all" ? "All links" : selectedMeetingName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All links</SelectItem>
                {meetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4 text-white gap-1">
                <Plus className="h-4 w-4" />
                New event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
              <EventFormFields
                f={form}
                setF={setForm}
                canCheck={canCheckAdd}
                availability={addAvailability}
                idPrefix="add"
                meetings={meetings}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button
                  className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4 text-white"
                  disabled={!form.title || !form.day || !form.startTime || !form.endTime || !form.meetingId}
                  onClick={handleAdd}
                >
                  Save event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingSchedule(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
            <EventFormFields
              f={editForm}
              setF={setEditForm}
              canCheck={canCheckEdit}
              availability={editAvailability}
              idPrefix="edit"
              meetings={meetings}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                className="bg-connect-me-blue-3 hover:bg-connect-me-blue-4 text-white"
                disabled={!editForm.title || !editForm.day || !editForm.startTime || !editForm.endTime || !editForm.meetingId}
                onClick={handleEdit}
              >
                Update event
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-white sticky top-0 z-10">
              <div className="border-r" />
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "py-3 text-center border-r last:border-r-0",
                    isToday(day) && "bg-connect-me-blue-1/30",
                  )}
                >
                  <p className="text-xs uppercase text-connect-me-gray-1 font-medium tracking-wide">
                    {format(day, "EEE")}
                  </p>
                  <p className={cn(
                    "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold",
                    isToday(day) ? "bg-connect-me-blue-3 text-white" : "text-connect-me-gray-3",
                  )}>
                    {format(day, "d")}
                  </p>
                </div>
              ))}
            </div>

            {/* Hour rows */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-white">
              {HOURS.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="border-r border-b min-h-[56px] flex items-start justify-end pr-2 pt-1">
                    <span className="text-[11px] text-connect-me-gray-1">{formatHour(hour)}</span>
                  </div>
                  {weekDays.map((day) => {
                    const dayName = format(day, "EEEE");
                    const cellSchedules = schedulesForDay(dayName).filter((s) => {
                      const startHour = parseInt(s.startTime.split(":")[0], 10);
                      return startHour === hour;
                    });
                    const cellEnrollments = enrollmentsForDay(dayName).filter((e) => {
                      const startHour = parseInt((e.startTime ?? "").split(":")[0], 10);
                      return startHour === hour;
                    });
                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={cn(
                          "border-r border-b last:border-r-0 min-h-[56px] p-1 relative space-y-0.5",
                          isToday(day) && "bg-connect-me-blue-1/20",
                        )}
                      >
                        {cellSchedules.map((s) => {
                          const meeting = meetings.find((m) => m.id === s.meetingId);
                          return (
                            <div
                              key={s.id}
                              onClick={() => openEdit(s)}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-connect-me-blue-1 text-connect-me-blue-5 border border-connect-me-blue-2 truncate cursor-pointer hover:bg-connect-me-blue-2 transition-colors"
                            >
                              {s.title}
                              <span className="block opacity-75 text-[10px]">
                                {meeting?.name ?? "—"} · {s.startTime} – {s.endTime}
                              </span>
                            </div>
                          );
                        })}
                        {cellEnrollments.map((e) => (
                          <div
                            key={e.id}
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 truncate select-none"
                          >
                            <span className="inline-flex items-center gap-1">
                              <span className="text-[9px] font-semibold uppercase tracking-wide bg-amber-200 text-amber-900 rounded px-1 py-px">Enrollment</span>
                            </span>
                            <span className="block truncate">
                              {e.tutor?.firstName} / {e.student?.firstName}
                            </span>
                            <span className="block opacity-60 text-[10px]">
                              {e.startTime} – {e.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
