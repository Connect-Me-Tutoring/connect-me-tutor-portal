import React, { useState } from "react";
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
import { format, parseISO, areIntervalsOverlapping, addHours } from "date-fns";
import { checkAvailableMeeting } from "@/lib/actions/meeting.actions";
import { toast } from "react-hot-toast";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { fetchDaySessionsFromSchedule } from "@/lib/actions/session.actions";

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
                  }
                )
              );
            })
          : false;
        updatedAvail[meeting.id] = !hasConflict;
      });
      setMeetingAvailability(updatedAvail);
    } catch {
      toast.error("Unable to check meeting availability.");
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

  const TriggerButton = isDropdownItem ? (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        handleOpenChange(true);
      }}
    >
      <Edit className="h-4 w-4 mr-2" />
      Edit Session
    </DropdownMenuItem>
  ) : (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => handleOpenChange(true)}>
          <Edit color="#f59e0b" className="h-4 w-4" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <center>Edit Session</center>
      </HoverCardContent>
    </HoverCard>
  );

  return (
    <>
      {TriggerButton}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Date</Label>
              <Input
                type="datetime-local"
                value={format(parseISO(editedSession.date), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => {
                  const updated = { ...editedSession, date: new Date(e.target.value).toISOString() };
                  setEditedSession(updated);
                  areMeetingsAvailable(updated);
                }}
                disabled={isChecking || isUpdating}
              />
            </div>
            <div>
              <Label>Meeting Link</Label>
              <Select
                value={editedSession.meeting?.id || ""}
                onValueChange={(val) => {
                  const m = meetings.find((x) => x.id === val);
                  setEditedSession({ ...editedSession, meeting: m });
                }}
                disabled={isChecking || isUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a meeting link">
                    {editedSession.meeting?.id
                      ? meetingAvailability[editedSession.meeting.id]
                        ? meetings.find((m) => m.id === editedSession.meeting?.id)?.name
                        : "Meeting unavilable, please select another"
                      : "Select a meeting"}
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
                  {isChecking ? "Checking Status" : "Updating..."}
                </>
              ) : (
                "Update Session"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
