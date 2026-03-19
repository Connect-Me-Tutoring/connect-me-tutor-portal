import ScheduleManagement from "@/components/admin/ScheduleManagement";
import { getAllActiveEnrollments } from "@/lib/actions/enrollment.server.actions";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { getAllProfiles } from "@/lib/actions/profile.server.actions";
import { getAllSessions } from "@/lib/actions/session.server.actions";
import { endOfWeek, startOfWeek } from "date-fns";

export default async function MySchedulePage() {
  return (
    <main>
      <ScheduleManagement />
    </main>
  );
}
