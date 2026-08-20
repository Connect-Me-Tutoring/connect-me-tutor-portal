import StudentList from "@/components/admin/StudentList";
import SkeletonTable, { SkeletonCard } from "@/components/ui/skeleton";
import { getAllProfiles } from "@/lib/actions/profile/server.actions";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

async function MyStudentsData() {
  const students = await getAllProfiles("Student", "created_at", false);

  return <StudentList initialStudents={students} />;
}

export default async function MyStudentsPage() {
  const t = await getTranslations("adminPeople.pages.allStudents");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">{t("heading")}</h1>

      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          <Suspense fallback={<SkeletonTable />}>
            <MyStudentsData />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
