import EnrollmentsList from "@/components/tutor/EnrollmentsManagement";
import {
  cachedGetEnrollments,
  getEnrollments,
} from "@/lib/actions/enrollment.server.actions";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { cachedGetProfile, cachedGetTutorStudents } from "@/lib/actions/cache";
import { createClient } from "@/lib/supabase/server";
import { Profile } from "@/types";
import { profile } from "console";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { Suspense } from "react";
import { Calendar } from "lucide-react";
import SkeletonTable from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

const fetchUserProfile = async () => {
  const user = await cachedGetUser();
  if (!user) redirect("/");
  const profileData = await cachedGetProfile(user.id);
  if (!profileData) throw new Error("No profile found");
  return profileData;
};

const fetchEnrollments = async (profile: Profile) => {
  const enrollmentsData = await cachedGetEnrollments(profile.id);
  if (!enrollmentsData) throw new Error("No enrollments found");

  const sortedEnrollments = enrollmentsData.sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
  return sortedEnrollments;
};

async function MyEnrollmentsData() {
  const profile = await fetchUserProfile();

  const sortedEnrollments = fetchEnrollments(profile);
  const meetings = getMeetings({ omit: ["Zoom Link HQ"] });
  const students = cachedGetTutorStudents(profile.id);

  return (
    <EnrollmentsList
      key={profile.id}
      profile={profile}
      enrollmentsPromise={sortedEnrollments}
      meetingsPromise={meetings}
      studentsPromise={students}
    />
  );
}

export default async function MyEnrollmentsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Enrollments</h1>
      <Suspense fallback={<SkeletonTable />}>
        <MyEnrollmentsData />
      </Suspense>
    </main>
  );
}
