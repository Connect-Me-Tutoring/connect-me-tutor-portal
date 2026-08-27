import PolicyQuiz from "@/components/tutor/PolicyQuiz";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";

export default async function OrientationQuizPage() {
  const user = await cachedGetUser();
  const profile = user ? await cachedGetProfile(user.id) : null;

  return <PolicyQuiz previewMode={profile?.role === "Admin"} />;
}
