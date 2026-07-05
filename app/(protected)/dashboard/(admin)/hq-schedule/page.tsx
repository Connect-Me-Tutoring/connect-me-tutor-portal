import HQScheduleComponent from "@/components/admin/HQSchedule";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { getAllActiveEnrollments } from "@/lib/actions/enrollment.server.actions";

export default function HQSchedulePage() {
  const meetingsPromise = getMeetings();
  const enrollmentsPromise = getAllActiveEnrollments();

  return (
    <main>
      <HQScheduleComponent
        meetingsPromise={meetingsPromise}
        enrollmentsPromise={enrollmentsPromise}
      />
    </main>
  );
}
