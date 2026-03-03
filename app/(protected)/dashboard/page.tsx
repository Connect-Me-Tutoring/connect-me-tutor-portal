import AdminDashboard from "@/components/admin/DashboardContent";
// import Dashboard from "@/components/dashboard/dashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import TutorDashboard from "@/components/tutor/dashboard";
import SkeletonTable from "@/components/ui/skeleton";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import {
  cachedGetProfile,
  getProfile,
} from "@/lib/actions/profile.server.actions";
import {
  cancelUnsubmittedSEF,
  getTutorSessions,
} from "@/lib/actions/session.server.actions";
import { getStudentSessions } from "@/lib/actions/session.server.actions";
import { cachedGetUser, getUser } from "@/lib/actions/user.server.actions";
import { Meeting, Profile } from "@/types";
import { endOfWeek, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardContextProvider } from "@/contexts/dashboardContext";
import { createClient } from "@/lib/supabase/server";

async function TutorDashboardPage({
  profile,
  meetings,
}: {
  profile: Profile;
  meetings: Promise<Meeting[] | null>;
}) {
  const wrapper = async () => {
    await cancelUnsubmittedSEF(profile);
    const currentTutorSessions = getTutorSessions(profile.id, {
      startDate: startOfWeek(new Date()).toISOString(),
      endDate: endOfWeek(new Date()).toISOString(),
      orderBy: "date",
      ascending: true,
    });

    const activeTutorSessions = getTutorSessions(profile.id, {
      status: "Active",
      orderBy: "date",
      ascending: true,
    });

    const pastTutorSessions = getTutorSessions(profile.id, {
      status: ["Complete", "Cancelled"],
      orderBy: "date",
      ascending: true,
    });
    return {
      currentTutorSessions,
      activeTutorSessions,
      pastTutorSessions,
      meetings,
    };
  };

  return (
    <Suspense fallback={<SkeletonTable />}>
      <DashboardContextProvider
        key={profile.id}
        initialProfile={profile}
        promises={{
          currentSessionsPromise: currentTutorSessions,
          activeSessionsPromise: activeTutorSessions,
          pastSessionsPromise: pastTutorSessions,
          meetingsPromise: meetings,
        }}
      >
        <TutorDashboard key={profile.id} />
      </DashboardContextProvider>
    </Suspense>
  );
}

async function StudentDashboardPage({
  profile,
  meetings,
}: {
  profile: Profile;
  meetings: Promise<Meeting[] | null>;
}) {
  const currentStudentSessions = getStudentSessions(profile.id, {
    startDate: startOfWeek(new Date()).toISOString(),
    endDate: endOfWeek(new Date()).toISOString(),
    orderBy: "date",
    ascending: true,
  });

  const activeStudentSessions = getStudentSessions(profile.id, {
    status: "Active",
    orderBy: "date",
    ascending: true,
  });

  const pastStudentSessions = getStudentSessions(profile.id, {
    status: ["Complete", "Cancelled"],
    orderBy: "date",
    ascending: true,
  });

  return (
    <Suspense fallback={<SkeletonTable />}>
      <DashboardContextProvider
        key={profile.id}
        initialProfile={profile}
        promises={{
          currentSessionsPromise: currentStudentSessions,
          activeSessionsPromise: activeStudentSessions,
          pastSessionsPromise: pastStudentSessions,
          meetingsPromise: meetings,
        }}
      >
        <StudentDashboard key={profile.id} />
      </DashboardContextProvider>
    </Suspense>
  );
}

export default async function DashboardPage() {
  const user = await cachedGetUser();
  if (!user) {
    console.log("Redirecting back to root");
    redirect("/");
  }
  const profile = await cachedGetProfile(user.id);
  if (!profile) throw new Error("No Profile found");
  const meetings = getMeetings({ omit: ["Zoom Link HQ"] });

  return (
    <>
      {profile.role === "Student" && (
        <StudentDashboardPage
          key={profile.id}
          profile={profile}
          meetings={meetings}
        />
      )}
      {profile.role === "Tutor" && (
        <TutorDashboardPage
          key={profile.id}
          profile={profile}
          meetings={meetings}
        />
      )}
      {profile.role === "Admin" && <AdminDashboard />}
    </>
  );
}
