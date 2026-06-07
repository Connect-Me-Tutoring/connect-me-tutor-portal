import EnrollmentsManager from "@/components/admin/EnrollmentsManagement";
import SkeletonTable, { SkeletonCard } from "@/components/ui/skeleton";
import { getAllEnrollments } from "@/lib/actions/enrollment.server.actions";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { getAllProfiles } from "@/lib/actions/profile.server.actions";
import { getWeeklyMeetingSchedules } from "@/lib/actions/meeting-schedule.server.actions";
import { Suspense } from "react";

function MyEnrollmentsData() {
  const enrollmentsPromise = getAllEnrollments();
  const meetingsPromise = getMeetings();
  const studentsPromise = getAllProfiles("Student");
  const tutorsPromise = getAllProfiles("Tutor");
  const weeklySchedulesPromise = getWeeklyMeetingSchedules();

  return (
    <EnrollmentsManager
      enrollmentsPromise={enrollmentsPromise}
      meetingsPromise={meetingsPromise}
      studentsPromise={studentsPromise}
      tutorsPromise={tutorsPromise}
      weeklySchedulesPromise={weeklySchedulesPromise}
    />
  );
}

export default function MyEnrollmentsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">All Enrollments</h1>
      <Suspense fallback={<SkeletonTable />}>
        <MyEnrollmentsData />
      </Suspense>
    </main>
  );
}
