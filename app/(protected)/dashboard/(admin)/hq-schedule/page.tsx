import HQScheduleComponent from "@/components/admin/HQSchedule";
import { getMeetings } from "@/lib/actions/meeting.server.actions";

export default function HQSchedulePage() {
  const meetingsPromise = getMeetings();

  return (
    <main>
      <HQScheduleComponent meetingsPromise={meetingsPromise} />
    </main>
  );
}
