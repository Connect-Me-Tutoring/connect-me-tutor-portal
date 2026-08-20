import Stats, { EnrollmentDetails, EventDetails } from "@/components/tutor/my-stats";
import {
  getSessionHoursByStudent,
  getAllEventDetailsForTutor,
} from "@/lib/actions/hours/server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/server.actions";
import { Calendar } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

async function MyStatsData() {
  const user = await cachedGetUser();
  if (!user) redirect("/");
  const profile = await cachedGetProfile(user.id);
  if (!profile) throw new Error("Unable to find profile");
  const [enrollmentDetails, eventDetails] = await Promise.all([
    getSessionHoursByStudent(profile.id),
    getAllEventDetailsForTutor(profile.id),
  ]);

  return (
    <Stats
      key={profile.id}
      enrollmentDetails={enrollmentDetails as unknown as EnrollmentDetails[]}
      eventDetails={eventDetails as unknown as { [key: string]: EventDetails[] }}
    />
  );
}

export default async function myStatsPage() {
  const t = await getTranslations("tutorPages.myStats");
  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">{t("heading")}</h1>
      <Suspense
        fallback={
          <div className="text-center py-10">
            <Calendar className="w-10 h-10 animate-spin mx-auto text-blue-500" />
            <p className="mt-4 text-gray-600">{t("loading")}</p>
          </div>
        }
      >
        <MyStatsData />
      </Suspense>
    </main>
  );
}
