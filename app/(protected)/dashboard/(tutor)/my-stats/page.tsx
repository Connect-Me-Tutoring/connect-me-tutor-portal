import Stats from "@/components/tutor/my-stats";
import { getAllEventDetailsForTutor } from "@/lib/actions/hours.server.actions";
import { getSessionHoursByStudent } from "@/lib/actions/hours.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { Calendar } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function MyStatsData() {
  const user = await cachedGetUser();
  if (!user) redirect("/");
  const profile = await cachedGetProfile(user.id);
  if (!profile) throw new Error("Unable to find profile");
  const enrollmentDetails = getSessionHoursByStudent(profile.id);
  const eventDetails = getAllEventDetailsForTutor(profile.id);

  return (
    <Stats
      key={profile.id}
      enrollmentDetailsPromise={enrollmentDetails}
      eventDetailsPromise={eventDetails}
    />
  );
}

export default async function myStatsPage() {
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">My Hours</h1>
      <Suspense
        fallback={
          <div className="text-center py-10">
            <Calendar className="w-10 h-10 animate-spin mx-auto text-blue-500" />
            <p className="mt-4 text-gray-600">Loading hours...</p>
          </div>
        }
      >
        <MyStatsData />
      </Suspense>
    </main>
  );
}
