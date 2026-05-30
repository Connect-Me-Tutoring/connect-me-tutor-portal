import AdminDashboard from "@/components/admin/DashboardContent";
// import Dashboard from "@/components/dashboard/dashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import TutorDashboard from "@/components/tutor/dashboard";
import SkeletonTable from "@/components/ui/skeleton";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { getTutorSessions } from "@/lib/actions/session.server.actions";
import { getStudentSessions } from "@/lib/actions/session.server.actions";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { Meeting, Profile } from "@/types";
import { endOfWeek, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardContextProvider } from "@/lib/contexts/dashboardContext";
import { getProfile } from "@/lib/actions/profile.server.actions";

async function TutorDashboardPage({
  profile,
  meetings,
}: {
  profile: Profile;
  meetings: Promise<Meeting[] | null>;
}) {
  const sessions = getTutorSessions(profile.id, {
    orderBy: "date",
    ascending: true,
  });

  const activeTutorSessions = sessions.then((sessions) =>
    sessions.filter((session) => session.status == "Active"),
  );

  const pastTutorSessions = sessions.then((sessions) =>
    sessions.filter((session) => session.status == "Complete" || "Cancelled"),
  );

  const currentTutorSessions = sessions.then((sessions) => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= start && sessionDate <= end;
    });
  });

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
  const sessions = getStudentSessions(profile.id, {
    orderBy: "date",
    ascending: true,
  });

  const currentStudentSessions = sessions.then((sessions) => {
    const now = new Date();
    const start = startOfWeek(now);
    const end = endOfWeek(now);
    return sessions.filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= start && sessionDate <= end;
    });
  });

  const activeStudentSessions = sessions.then((sessions) =>
    sessions.filter((session) => session.status == "Active"),
  );

  const pastStudentSessions = sessions.then((sessions) =>
    sessions.filter((session) => session.status == "Complete" || "Cancelled"),
  );

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
