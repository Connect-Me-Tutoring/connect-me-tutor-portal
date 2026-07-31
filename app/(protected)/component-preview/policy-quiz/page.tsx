import { redirect } from "next/navigation";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import PolicyQuiz from "@/components/tutor/PolicyQuiz";

export const metadata = {
  title: "Component Preview — Policy Quiz | Connect Me",
  description: "Admin-only component preview page",
};

export default async function PolicyQuizPreviewPage() {
  const user = await cachedGetUser().catch(() => null);
  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);
  if (!profile || profile.role !== "Admin") redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* test shapes — visible through translucent areas */}
      <div className="pointer-events-none absolute left-1/4 top-32 h-72 w-72 rounded-full bg-yellow-300 opacity-80" />
      <div className="pointer-events-none absolute right-1/4 top-64 h-96 w-96 rounded-full bg-red-500 opacity-70" />
      <div className="pointer-events-none absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-green-400 opacity-75" />
      <div className="pointer-events-none absolute left-12 top-96 h-48 w-48 rounded-full bg-blue-300 opacity-80" />

      {/* preview header bar */}
      <div className="relative z-10 border-b bg-amber-50 px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">
              PREVIEW
            </span>
            <span className="text-sm font-medium text-amber-900">
              Policy Quiz Component — with Transluscent Test
            </span>
          </div>
          <a href="/dashboard" className="text-sm text-amber-700 underline hover:text-amber-900">
            ← Back to Dashboard
          </a>
        </div>
      </div>

      {/* component under test */}
      <div className="relative z-10">
        <PolicyQuiz />
      </div>
    </div>
  );
}
