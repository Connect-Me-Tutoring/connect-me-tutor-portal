import SettingsPage from "@/components/settings/SettingsPage";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";
import { redirect } from "next/navigation";

export default async function Display() {
  const user = await cachedGetUser();
  if (!user) {
    redirect("/");
  }
  const profile = cachedGetProfile(user.id);
  const orientationEnabled = isTutorOrientationEnabled();

  return <SettingsPage orientationEnabled={orientationEnabled} profilePromise={profile} />;
}
