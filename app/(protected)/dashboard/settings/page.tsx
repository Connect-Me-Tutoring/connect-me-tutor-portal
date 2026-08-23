import SettingsPage from "@/components/settings/SettingsPage";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import { redirect } from "next/navigation";

export default async function Display() {
  const user = await cachedGetUser();
  if (!user) {
    redirect("/");
  }
  const profile = cachedGetProfile(user.id);
  const orientationEnabled = process.env.TUTOR_ORIENTATION_ENABLED === "true";

  return <SettingsPage orientationEnabled={orientationEnabled} profilePromise={profile} />;
}
