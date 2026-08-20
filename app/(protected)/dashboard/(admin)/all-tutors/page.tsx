import TutorList from "@/components/admin/TutorList";
import { getAllProfiles } from "@/lib/actions/profile/server.actions";
import { Suspense } from "react";
import SkeletonTable, { SkeletonCard } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

async function MyTutorsData() {
  const tutors = await getAllProfiles("Tutor", "created_at", false);
  return <TutorList initialTutors={tutors} />;
}

export default async function MyTutorsPage() {
  const t = await getTranslations("adminPeople.pages.allTutors");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">{t("heading")}</h1>
      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          <Suspense fallback={<SkeletonTable />}>
            <MyTutorsData />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
