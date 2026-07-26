import React from "react";
import { useState } from "react";
import { formatSessionDate, formatDateAdmin } from "@/lib/utils";
import { Session, Meeting } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchDaySessionsFromSchedule } from "@/lib/actions/session/actions";
import { toast } from "react-hot-toast";

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
import { Circle, Loader2, CalendarDays } from "lucide-react";
import { format, parseISO, isAfter, addHours, addWeeks, areIntervalsOverlapping } from "date-fns";

/**
 * Props interface for the RescheduleForm component
 */
interface RescheduleProps {
  selectedSession: Session | null;
  selectedSessionDate: string | null;
  meetings: Meeting[];
  setSelectedSessionDate: (date: string) => void;
  handleInputChange: (e: { target: { name: string; value: string } }) => void;
  handleReschedule: (sessionId: string, newDate: string, meetingId: string) => void;
}

/**
 * RescheduleForm Component
 *
 * A dialog component that allows users to reschedule a session by:
 * - Selecting a new date and time
 * - Choosing an available meeting link
 * - Checking for conflicts with existing sessions
 *
 * @param props - The props for the RescheduleForm component
 * @returns JSX element representing the reschedule form dialog
 */
const RescheduleForm: React.FC<RescheduleProps> = ({
  selectedSession,
  selectedSessionDate,
  meetings,
  setSelectedSessionDate,
  handleInputChange,
  handleReschedule,
}) => {
  /** State to track if meeting availability is being checked */
  const [isCheckingMeetingAvailability, setisCheckingMeetingAvailability] = useState(false);
  /** State to store meeting availability status for each meeting link */
  const [meetingAvailability, setMeetingAvailability] = useState<{
    [key: string]: boolean;
  }>({});

  /**
   * Gets the number of meetings that have been checked for availability
   * @returns Number of meetings in the availability object
   */
  const getMeetingAvailabilityLength = () => {
    return Object.keys(meetingAvailability).length;
  };

  /**
   * Checks which meeting links are available for the requested session time
   * by comparing against existing sessions to detect conflicts
   *
   * @param session - The session being rescheduled
   * @param requestedDate - The new requested date/time for the session
   */
  const areMeetingsAvailable = async (session: Session, requestedDate: Date) => {
    try {
      setisCheckingMeetingAvailability(true);

      const sessionsToSearch = await fetchDaySessionsFromSchedule(requestedDate);

      const updatedMeetingAvailability: { [key: string]: boolean } = {};

      meetings.forEach((meeting) => {
        updatedMeetingAvailability[meeting.id] = true;
      });

      const requestedSessionStartTime = requestedDate;
      const requestedSessionEndTime = addHours(requestedSessionStartTime, session.duration);

      meetings.forEach((meeting) => {
        const hasConflict = sessionsToSearch
          ? sessionsToSearch.some((existingSession) => {
              return (
                session.id !== existingSession.id &&
                existingSession.meeting?.id === meeting.id &&
                areIntervalsOverlapping(
                  {
                    start: requestedSessionStartTime,
                    end: requestedSessionEndTime,
                  },
                  {
                    start: existingSession.date ? parseISO(existingSession.date) : new Date(),
                    end: existingSession.date
                      ? addHours(parseISO(existingSession.date), existingSession.duration)
                      : new Date(),
                  },
                )
              );
            })
          : false;
        updatedMeetingAvailability[meeting.id] = !hasConflict;
      });
      setMeetingAvailability(updatedMeetingAvailability);
    } catch (error) {
      toast.error("Unable to find available meeting links");
      console.error("Unable to find available meeting links", error);
    } finally {
      setisCheckingMeetingAvailability(false);
    }
  };

  /**
   * Updates the selected session date state
   * @param isostring - The new date in ISO string format
   */
  const updatedSelectedDate = (isostring: string) => {
    setSelectedSessionDate(isostring);
  };

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Reschedule Session with {selectedSession?.student?.firstName}{" "}
            {selectedSession?.student?.lastName}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <Input
            type="datetime-local"
            disabled={isCheckingMeetingAvailability}
            defaultValue={
              selectedSession?.date
                ? format(parseISO(selectedSession.date), "yyyy-MM-dd'T'HH:mm")
                : ""
            }
            onBlur={async (e) => {
              if (selectedSession) {
                const rescheduledDate = new Date(e.target.value);
                setSelectedSessionDate(rescheduledDate.toISOString());
                await areMeetingsAvailable(selectedSession, rescheduledDate);
              }
            }}
            // max={addWeeks(new Date(), 2)}
          />

          <div>
            <Label>Meeting Link</Label>
            <Select
              name="meeting.id"
              value={selectedSession?.meeting?.id}
              onValueChange={(value) =>
                handleInputChange({
                  target: { name: "meeting.id", value },
                } as any)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a meeting link">
                  {selectedSession?.meeting?.id
                    ? meetingAvailability[selectedSession.meeting.id]
                      ? meetings.find((meeting) => meeting.id === selectedSession?.meeting?.id)
                          ?.name
                      : "Please select an available link"
                    : "Select a meeting"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {meetings.map((meeting) => (
                  <SelectItem
                    key={meeting.id}
                    value={meeting.id}
                    disabled={!meetingAvailability[meeting.id]}
                    className={`flex items-center justify-between`}
                  >
                    <span>
                      {meeting.name} - {meeting.id}
                    </span>
                    <Circle
                      className={`w-2 h-2 ml-2 ${
                        meetingAvailability[meeting.id] ? "text-green-500" : "text-red-500"
                      } fill-current`}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            disabled={
              isCheckingMeetingAvailability ||
              !selectedSession?.meeting?.id ||
              !meetingAvailability[selectedSession.meeting.id]
            }
            onClick={() =>
              selectedSession &&
              selectedSessionDate &&
              selectedSession.meeting?.id &&
              handleReschedule(
                selectedSession?.id,
                selectedSessionDate,
                selectedSession.meeting?.id,
              )
            }
          >
            {isCheckingMeetingAvailability ? (
              <>
                Checking Meeting Link Availability{"   "}
                <Loader2 className="mx-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Send Reschedule Request"
            )}
          </Button>
        </div>
      </DialogContent>
    </>
  );
};

export default RescheduleForm;
