import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Session, Meeting } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Loader2, Circle, Edit } from "lucide-react";
import { addHours, areIntervalsOverlapping, format, isValid, parseISO } from "date-fns";
import { checkAvailableMeeting } from "@/lib/actions/meeting/client.actions";
import { toast } from "react-hot-toast";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { fetchDaySessionsFromSchedule } from "@/lib/actions/session/client.actions";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface EditSessionFormProps {
  session: Session;
  meetings: Meeting[];
  handleStatusChange: (session: Session) => Promise<void>;
  isDropdownItem?: boolean;
}

export default function EditSessionForm({
  session,
  meetings,
  handleStatusChange,
  isDropdownItem = false,
}: EditSessionFormProps) {
  const t = useTranslations("tutorSessions.forms.editSession");
  const [open, setOpen] = useState(false);
  const [editedSession, setEditedSession] = useState<Session>(session);
  const [isChecking, setIsChecking] = useState(false);
  const [meetingAvailability, setMeetingAvailability] = useState<{
    [key: string]: boolean;
  }>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const areMeetingsAvailable = async (s: Session) => {
    try {
      setIsChecking(true);
      const requestedDate = new Date(s.date);
      const sessionsToSearch = await fetchDaySessionsFromSchedule(requestedDate);
      const updatedAvail: { [key: string]: boolean } = {};
      meetings.forEach((m) => (updatedAvail[m.id] = true));

      const startTime = requestedDate;
      const endTime = addHours(startTime, s.duration);

      meetings.forEach((meeting) => {
        const hasConflict = sessionsToSearch
          ? sessionsToSearch.some((existing) => {
              return (
                s.id !== existing.id &&
                existing.meeting?.id === meeting.id &&
                areIntervalsOverlapping(
                  { start: startTime, end: endTime },
                  {
                    start: existing.date ? parseISO(existing.date) : new Date(),
                    end: existing.date
                      ? addHours(parseISO(existing.date), existing.duration)
                      : new Date(),
                  },
                )
              );
            })
          : false;
        updatedAvail[meeting.id] = !hasConflict;
      });
      setMeetingAvailability(updatedAvail);
    } catch {
      toast.error(t("availabilityError"));
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setEditedSession(session);
      areMeetingsAvailable(session);
    }
    setOpen(newOpen);
  };

  const onUpdate = async () => {
    setIsUpdating(true);
    try {
      await handleStatusChange(editedSession);
      setOpen(false);
    } catch {
      // toast is handled in parent
    } finally {
      setIsUpdating(false);
    }
  };

  const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 0.25);

  const TriggerButton = isDropdownItem ? (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        handleOpenChange(true);
      }}
    >
      <Edit className="h-4 w-4 mr-2" />
      {t("editSessionLabel")}
    </DropdownMenuItem>
  ) : (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => handleOpenChange(true)}>
          <Edit color="#f59e0b" className="h-4 w-4" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <center>{t("editSessionLabel")}</center>
      </HoverCardContent>
    </HoverCard>
  );

  return (
    <>
      {TriggerButton}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t("dateLabel")}</Label>
              <Input
                type="datetime-local"
                value={format(parseISO(editedSession.date), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const requestedDate = new Date(e.target.value);
                  if (!isValid(requestedDate)) return;

                  const updated = {
                    ...editedSession,
                    date: requestedDate.toISOString(),
                  };
                  setEditedSession(updated);
                  areMeetingsAvailable(updated);
                }}
                disabled={isChecking || isUpdating}
              />
            </div>
            <div>
              <Label>{t("meetingLinkLabel")}</Label>
              <Select
                value={editedSession.meeting?.id || ""}
                onValueChange={(val) => {
                  const m = meetings.find((x) => x.id === val);
                  setEditedSession({ ...editedSession, meeting: m });
                }}
                disabled={isChecking || isUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("meetingLinkSelectPlaceholder")}>
                    {editedSession.meeting?.id
                      ? meetingAvailability[editedSession.meeting.id]
                        ? meetings.find((m) => m.id === editedSession.meeting?.id)?.name
                        : t("meetingUnavailable")
                      : t("noMeetingSelected")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((meeting) => (
                    <SelectItem
                      key={meeting.id}
                      value={meeting.id}
                      disabled={!meetingAvailability[meeting.id]}
                      className="flex items-center justify-between"
                    >
                      <span className="mr-2">{meeting.name}</span>
                      <Circle
                        className={`w-2 h-2 ${
                          meetingAvailability[meeting.id] ? "text-green-500" : "text-red-500"
                        } fill-current`}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("durationLabel")}</Label>
              <Select
                value={editedSession.duration.toString()}
                onValueChange={(value) => {
                  const updated = {
                    ...editedSession,
                    duration: parseFloat(value),
                  };
                  setEditedSession(updated);
                  areMeetingsAvailable(updated);
                }}
                disabled={isChecking || isUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("durationSelectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((duration) => {
                    const minutes = (duration % 1) * 60;
                    const hours = Math.floor(duration);

                    return (
                      <SelectItem key={duration} value={duration.toString()}>
                        {hours} {hours === 1 ? t("hourSingular") : t("hourPlural")} {minutes}{" "}
                        {t("minutesLabel")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={
                isChecking ||
                isUpdating ||
                !editedSession.meeting ||
                !meetingAvailability[editedSession.meeting.id]
              }
              onClick={onUpdate}
            >
              {isUpdating || isChecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isChecking ? t("checkingStatus") : t("updating")}
                </>
              ) : (
                t("updateButton")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
