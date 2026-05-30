import StudentList from "@/components/tutor/StudentList";
import { PageLoader } from "@/components/ui/page-loader";
import SkeletonTable from "@/components/ui/skeleton";

import { cachedGetProfile, cachedGetTutorStudents } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function MyStudentsData() {
  const user = await cachedGetUser();
  if (!user) redirect("/");
  const profile = await cachedGetProfile(user.id);
  if (!profile) throw new Error("Profile not found");
  const students = await cachedGetTutorStudents(profile.id);

  return <StudentList key={profile.id} initialStudents={students} />;
}

export default async function MyStudentsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Students</h1>
      <div className="flex space-x-6">
        <div className="flex-grow bg-white rounded-lg shadow p-6">
          {" "}
          <Suspense fallback={<SkeletonTable />}>
            <MyStudentsData />{" "}
          </Suspense>
        </div>
      </div>
    </main>
  );
}
