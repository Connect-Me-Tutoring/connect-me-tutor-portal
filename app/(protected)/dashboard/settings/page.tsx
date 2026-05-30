import SettingsPage from "@/components/settings/SettingsPage";
import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { redirect } from "next/navigation";

export default async function Display() {
  const user = await cachedGetUser();
  if (!user) {
    redirect("/");
  }
  const profile = cachedGetProfile(user.id);

  return <SettingsPage profilePromise={profile} />;
}
