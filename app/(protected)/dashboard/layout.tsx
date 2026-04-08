import { cachedGetUser } from "@/lib/actions/user.server.actions";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import DashboardProviders from "./dashboardprovider";
import { getUserProfiles } from "@/lib/actions/profile.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await cachedGetUser().catch((error) => {
    console.error("Unable to get user session", error);
    redirect("/");
  });

  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);

  if (!profile || !profile.role) {
    console.log("Redirecting back to root");
    redirect("/");
  }

  const userProfiles = getUserProfiles(profile.userId);

  return (
    <>
      <DashboardProviders initialProfile={profile}>
        {" "}
        <DashboardLayout profile={profile} userProfilesPromise={userProfiles}>
          {children}
        </DashboardLayout>
      </DashboardProviders>
    </>
  );
}
