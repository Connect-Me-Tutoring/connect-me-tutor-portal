"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProfile, getProfileWithProfileId } from "@/lib/actions/user/actions";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { switchProfile, getProfileUncached } from "@/lib/actions/profile/server.actions";
import { useProfile } from "@/lib/contexts/profileContext";
import type { Database } from "@/types/database.types";
import { getUserProfiles } from "@/lib/actions/profile/server.actions";

interface AccountFormType {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  age: string;
  email: string;
  subjectsOfInterest: string;
  languagesSpoken: string;
}

export default function SettingsPage({
  profilePromise,
}: {
  profilePromise: Promise<Profile | null>;
}) {
  //   const profile = use(profilePromise);

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("settings");
  const { profile, setProfile } = useProfile();
  const showCompleteProfileBanner = searchParams.get("completeProfile") === "1";
  // changed to initialize from context so current profile is available at render time
  const [lastActiveProfileId, setLastActiveProfileId] = useState<string>(profile?.id || "");
  const [userProfiles, setUserProfiles] = useState<Partial<Profile>[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // changed to hydrate the form from the current profile on first render (instead of waiting for useEffect)
  const [accountForm, setAccountForm] = useState(() => ({
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    phoneNumber: profile?.phoneNumber || "",
    age: profile?.age !== undefined && profile?.age !== null ? String(profile.age) : "",
    email: profile?.email || "",
    subjectsOfInterest: Array.isArray((profile as any)?.subjects_of_interest)
      ? (profile as any).subjects_of_interest.join(", ")
      : "",
    languagesSpoken: Array.isArray((profile as any)?.languages_spoken)
      ? (profile as any).languages_spoken.join(", ")
      : "",
  }));
  // track account status stae for students so they can toggle their own active inactive status in settings without admin help
  const [accountStatus, setAccountStatus] = useState<Profile["status"]>(
    profile?.status === "Inactive" ? "Inactive" : "Active",
  );
  const [sessionReminders, setSessionReminders] = useState(false);
  const [sessionEmailNotifications, setSessionEmailNotifications] = useState(false);
  const [sessionTextNotifications, setSessionTextNotifications] = useState(false);
  const [webinarReminders, setWebinarReminders] = useState(false);
  const [webinarEmailNotifications, setWebinarEmailNotifications] = useState(false);
  const [webinarTextNotifications, setWebinarTextNotifications] = useState(false);
  const [settingsId, setSettingsId] = useState("");

  const fetchUserInfo = async () => {
    const userId = await fetchUser();
    if (userId) return await fetchUserProfiles(userId);
  };

  useEffect(() => {
    const fetchData = async () => {
      const userProfiles = await fetchUserInfo();
      if (userProfiles) setUserProfiles(userProfiles);
    };
    fetchData();
  }, []);

  useEffect(() => {
    fetchNotificationSettings();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    setAccountForm({
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      phoneNumber: profile.phoneNumber || "",
      age: profile.age !== undefined && profile.age !== null ? String(profile.age) : "",
      email: profile.email || "",
      subjectsOfInterest: Array.isArray((profile as any).subjects_of_interest)
        ? (profile as any).subjects_of_interest.join(", ")
        : "",
      languagesSpoken: Array.isArray((profile as any).languages_spoken)
        ? (profile as any).languages_spoken.join(", ")
        : "",
    });
    // sync account status when profile loads so the selector actually shows the current saved value instead of defaults
    setAccountStatus(profile.status === "Inactive" ? "Inactive" : "Active");
  }, [profile]);

  const toList = (value: string) => {
    return value
      .split(/[\n,]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const fetchUser = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw new Error(userError.message);
      if (!user) throw new Error("No user found");

      const profileData = await getProfile(user.id);
      if (profileData) {
        // changed to refresh profile after page load so the context stays current
        setProfile(profileData);
        setLastActiveProfileId(profileData.id);
      }
      return user.id;
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchUserProfiles = async (userId: string) => {
    try {
      return await getUserProfiles(userId);
    } catch (error) {
      toast.error(t("profiles.toasts.fetchError"));
      console.error("Error fetching other profiles", error);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      if (!profile?.settingsId) return;

      const { data, error } = await supabase
        .from("user_notification_settings")
        .select("*")
        .eq("id", profile.settingsId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return;

      setSessionEmailNotifications(data.email_tutoring_session_notifications_enabled);
      setSessionTextNotifications(false);
      setWebinarEmailNotifications(data.email_webinar_notifications_enabled);
      setWebinarTextNotifications(data.text_webinar_notifications_enabled);

      setSessionReminders(
        data.email_tutoring_session_notifications_enabled ||
          data.text_tutoring_session_notifications_enabled,
      );

      setWebinarReminders(false);

      setSettingsId(profile.settingsId);
    } catch (error) {
      console.error("Unable to fetch notification settings", error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!profile?.id) {
        toast.error(t("account.toasts.noActiveProfile"));
        return;
      }

      setIsSavingProfile(true);

      const updatePayload: Record<string, any> = {
        first_name: accountForm.firstName.trim(),
        last_name: accountForm.lastName.trim(),
        phone_number: accountForm.phoneNumber.trim() || null,
        age: accountForm.age ? Number(accountForm.age) : null,
        email: accountForm.email.trim() || null,
        subjects_of_interest: toList(accountForm.subjectsOfInterest),
        languages_spoken: toList(accountForm.languagesSpoken),
      };
      // only add status to update if students so tutors dont get this control in settings and keep the admin level stuff
      if (profile.role === "Student") {
        updatePayload.status = accountStatus;
      }

      const { error } = await supabase
        .from("Profiles")
        .update(updatePayload as Database["public"]["Tables"]["Profiles"]["Update"])
        .eq("id", profile.id);

      if (error) throw error;

      const refreshed = await getProfileWithProfileId(profile.id);
      if (refreshed) setProfile(refreshed);

      toast.success(t("account.toasts.updateSuccess"));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t("account.toasts.updateError"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      // Handle notification settings save logic here
      // You could show a success toast here

      await supabase
        .from("user_notification_settings")
        .update({
          email_tutoring_session_notifications_enabled: sessionEmailNotifications,
          text_tutoring_session_notifications_enabled: sessionTextNotifications,
          email_webinar_notifications_enabled: webinarEmailNotifications,
          text_webinar_notifications_enabled: webinarTextNotifications,
        })
        .eq("id", settingsId)
        .throwOnError();

      await fetchNotificationSettings();
      toast.success(t("notifications.toasts.saveSuccess"));
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error(t("notifications.toasts.saveError"));
    }
  };

  const handleSwitchProfile = async () => {
    try {
      if (profile) {
        const [, newProfileData] = await Promise.all([
          switchProfile(profile?.userId, lastActiveProfileId),
          getProfileWithProfileId(lastActiveProfileId),
        ]);
        setProfile(newProfileData);
        router.refresh();
      }
      toast.success(t("profiles.toasts.switchSuccess"));
    } catch (error) {
      console.error("Unable to switch account", error);
      toast.error(t("profiles.toasts.switchError"));
    }
  };

  return (
    <>
      <Toaster />{" "}
      <main className="p-8 max-w-4xl mx-auto">
        <div className="space-y-12">
          {showCompleteProfileBanner && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertDescription>{t("completeProfileBanner")}</AlertDescription>
            </Alert>
          )}

          {/* Switch Profiles Section */}
          <section className="bg-white rounded-lg border p-6">
            <h1 className="text-2xl font-bold mb-6">{t("profiles.heading")}</h1>
            <div className="space-y-8">
              {/* Profiles */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="text-lg font-semibold">{t("profiles.yourProfiles")}</h3>
                </div>
                <Select onValueChange={setLastActiveProfileId}>
                  <SelectTrigger className="h-12">
                    <SelectValue
                      placeholder={profile ? `${profile?.firstName} ${profile?.lastName}` : ""}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>{t("profiles.heading")}</SelectLabel>
                      {userProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id || ""}>
                          {profile.firstName} {profile.lastName}
                        </SelectItem>
                      ))}
                      {/* <SelectItem value="all">All</SelectItem> */}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSwitchProfile} className="mt-6 w-full sm:w-auto">
              {t("profiles.switchProfile")}
            </Button>
          </section>
          {/* Notifications Section */}
          <section className="bg-white rounded-lg border p-6">
            <h1 className="text-2xl font-bold mb-6">{t("notifications.heading")}</h1>

            <div className="space-y-8">
              {/* Session Reminders */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {t("notifications.sessionReminders.title")}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t("notifications.sessionReminders.description")}
                    </p>
                  </div>
                  <Switch
                    id="session-reminders"
                    checked={sessionReminders}
                    onCheckedChange={setSessionReminders}
                  />
                </div>

                {sessionReminders && (
                  <div className="mt-4 ml-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="session-email" className="text-base">
                          {t("notifications.emailNotifications")}
                        </Label>
                      </div>

                      <Switch
                        id="session-email"
                        checked={sessionEmailNotifications}
                        onCheckedChange={setSessionEmailNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="session-text" className="text-base">
                          {t("notifications.textNotifications")}
                        </Label>
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                          {t("notifications.inDevelopment")}
                        </span>
                      </div>
                      <Switch
                        id="session-text"
                        checked={sessionTextNotifications}
                        onCheckedChange={setSessionTextNotifications}
                        disabled
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Webinar Reminders */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {t("notifications.webinarReminders.title")}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t("notifications.webinarReminders.description")}
                    </p>
                  </div>
                  <Switch
                    id="webinar-reminders"
                    checked={webinarReminders}
                    onCheckedChange={setWebinarReminders}
                  />
                </div>

                {webinarReminders && (
                  <div className="mt-4 ml-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="webinar-email" className="text-base">
                        {t("notifications.emailNotifications")}
                      </Label>
                      <Switch
                        id="webinar-email"
                        checked={webinarEmailNotifications}
                        onCheckedChange={setWebinarEmailNotifications}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="webinar-text" className="text-base">
                          {t("notifications.textNotifications")}
                        </Label>
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                          {t("notifications.inDevelopment")}
                        </span>
                      </div>
                      <Switch
                        id="webinar-text"
                        checked={webinarTextNotifications}
                        onCheckedChange={setWebinarTextNotifications}
                        disabled
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleSaveNotifications} className="mt-6 w-full sm:w-auto">
              {t("notifications.save")}
            </Button>
          </section>
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold">{t("account.heading")}</h2>
              <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                {t("account.inDevelopment")}
              </span>
            </div>
            <p className="text-gray-600 mb-6">{t("account.description")}</p>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* students can toggle their own active inactive status here without needing admin intervention to deactivate account */}
              {profile?.role === "Student" && (
                <div>
                  <Label htmlFor="account-status" className="text-sm font-medium">
                    {t("account.status.label")}
                  </Label>
                  <Select
                    value={accountStatus}
                    onValueChange={(value) => setAccountStatus(value as Profile["status"])}
                  >
                    <SelectTrigger id="account-status" className="mt-1">
                      <SelectValue placeholder={t("account.status.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">{t("account.status.active")}</SelectItem>
                      <SelectItem value="Inactive">{t("account.status.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first-name" className="text-sm font-medium">
                    {t("account.firstName.label")}
                  </Label>
                  <Input
                    id="first-name"
                    placeholder={t("account.firstName.placeholder")}
                    className="mt-1 placeholder:text-gray-300"
                    value={accountForm.firstName}
                    onChange={(e) =>
                      setAccountForm((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="last-name" className="text-sm font-medium">
                    {t("account.lastName.label")}
                  </Label>
                  <Input
                    id="last-name"
                    placeholder={t("account.lastName.placeholder")}
                    className="mt-1 placeholder:text-gray-300"
                    value={accountForm.lastName}
                    onChange={(e) =>
                      setAccountForm((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone-number" className="text-sm font-medium">
                    {t("account.phoneNumber.label")}
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder={t("account.phoneNumber.placeholder")}
                    className="mt-1 placeholder:text-gray-300"
                    value={accountForm.phoneNumber}
                    onChange={(e) =>
                      setAccountForm((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="age" className="text-sm font-medium">
                    {t("account.age.label")}
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder={t("account.age.placeholder")}
                    className="mt-1 placeholder:text-gray-300"
                    value={accountForm.age}
                    onChange={(e) =>
                      setAccountForm((prev) => ({
                        ...prev,
                        age: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium">
                  {t("account.email.label")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("account.email.placeholder")}
                  className="mt-1 placeholder:text-gray-300"
                  value={accountForm.email}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="bio" className="text-sm font-medium">
                  {t("account.bio.label")}
                </Label>
                <Textarea
                  id="bio"
                  placeholder={t("account.bio.placeholder")}
                  className="mt-1 placeholder:text-gray-300"
                  rows={4}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="subjects" className="text-sm font-medium">
                  {t("account.subjects.label")}
                </Label>
                <Textarea
                  id="subjects"
                  placeholder={t("account.subjects.placeholder")}
                  className="mt-1 placeholder:text-gray-300"
                  rows={4}
                  value={accountForm.subjectsOfInterest}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      subjectsOfInterest: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="languages" className="text-sm font-medium">
                  {t("account.languages.label")}
                </Label>
                <Textarea
                  id="languages"
                  placeholder={t("account.languages.placeholder")}
                  className="mt-1 placeholder:text-gray-300"
                  rows={4}
                  value={accountForm.languagesSpoken}
                  onChange={(e) =>
                    setAccountForm((prev) => ({
                      ...prev,
                      languagesSpoken: e.target.value,
                    }))
                  }
                />
              </div>

              <Button
                type="submit"
                disabled={!profile || isSavingProfile}
                className="w-full sm:w-auto"
              >
                {isSavingProfile ? t("account.updating") : t("account.update")}
              </Button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
