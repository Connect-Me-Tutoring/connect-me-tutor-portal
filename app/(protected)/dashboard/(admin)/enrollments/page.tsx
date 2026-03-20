import EnrollmentsManager from "@/components/admin/EnrollmentsManagement";
import SkeletonTable, { SkeletonCard } from "@/components/ui/skeleton";
import { getAllEnrollments } from "@/lib/actions/enrollment.server.actions";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { getAllProfiles } from "@/lib/actions/profile.server.actions";
import { Suspense } from "react";

async function MyEnrollmentsData() {
  // await data here so client component doesnt need use() which is unstable in react 18
  const [enrollments, meetings, students, tutors] = await Promise.all([
    getAllEnrollments(),
    getMeetings(),
    getAllProfiles("Student"),
    getAllProfiles("Tutor"),
  ]);

  return (
    <EnrollmentsManager
      initialEnrollments={enrollments}
      initialMeetings={meetings}
      initialStudents={students}
      initialTutors={tutors}
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
