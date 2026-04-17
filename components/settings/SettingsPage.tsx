"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  getProfile,
  getProfileWithProfileId,
} from "@/lib/actions/user.actions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  switchProfile,
  getProfileUncached,
} from "@/lib/actions/profile.server.actions";
import { useProfile } from "@/lib/contexts/profileContext";
import { getUserProfiles } from "@/lib/actions/profile.server.actions";
import { NetworkAccessProfileListInstance } from "twilio/lib/rest/supersim/v1/networkAccessProfile";

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

  const supabase = createClientComponentClient();
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  // changed to initialize from context so current profile is available at render time
  const [lastActiveProfileId, setLastActiveProfileId] = useState<string>(
    profile?.id || "",
  );
  const [userProfiles, setUserProfiles] = useState<Partial<Profile>[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // changed to hydrate the form from the current profile on first render (instead of waiting for useEffect)
  const [accountForm, setAccountForm] = useState(() => ({
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    phoneNumber: profile?.phoneNumber || "",
    age:
      profile?.age !== undefined && profile?.age !== null
        ? String(profile.age)
        : "",
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
  const [sessionEmailNotifications, setSessionEmailNotifications] =
    useState(false);
  const [sessionTextNotifications, setSessionTextNotifications] =
    useState(false);
  const [webinarReminders, setWebinarReminders] = useState(false);
  const [webinarEmailNotifications, setWebinarEmailNotifications] =
    useState(false);
  const [webinarTextNotifications, setWebinarTextNotifications] =
    useState(false);
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
      age:
        profile.age !== undefined && profile.age !== null
          ? String(profile.age)
          : "",
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
      if (!profileData) throw new Error("No profile found");

      // changed to refresh profile after page load so the context stays current
      setProfile(profileData);
      setLastActiveProfileId(profileData.id);
      return user.id;
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchUserProfiles = async (userId: string) => {
    try {
      return await getUserProfiles(userId);
    } catch (error) {
      toast.error("Error fetching profiles");
      console.error("Error fetching other profiles", error);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      if (profile) {
        const { data, error } = await supabase
          .from("user_notification_settings")
          .select("*")
          .eq("id", profile.settingsId)
          .single();
        if (error) throw error;

        setSessionEmailNotifications(
          data.email_tutoring_session_notifications_enabled,
        );
        setSessionTextNotifications(false);
        setWebinarEmailNotifications(data.email_webinar_notifications_enabled);
        setWebinarTextNotifications(data.text_webinar_notifications_enabled);

        setSessionReminders(
          data.email_tutoring_session_notifications_enabled ||
            data.text_tutoring_session_notifications_enabled,
        );

        setWebinarReminders(false);

        setSettingsId(profile.settingsId);
      }
    } catch (error) {
      console.error("Unable to fetch notification settings", error);
      throw error;
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!profile?.id) {
        toast.error("No active profile to update");
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
        .update(updatePayload)
        .eq("id", profile.id);

      if (error) throw error;

      const refreshed = await getProfileWithProfileId(profile.id);
      if (refreshed) setProfile(refreshed);

      toast.success("Profile updated");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Unable to update profile");
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
          email_tutoring_session_notifications_enabled:
            sessionEmailNotifications,
          text_tutoring_session_notifications_enabled: sessionTextNotifications,
          email_webinar_notifications_enabled: webinarEmailNotifications,
          text_webinar_notifications_enabled: webinarTextNotifications,
        })
        .eq("id", settingsId)
        .throwOnError();

      await fetchNotificationSettings();
      toast.success("Saved Notification Settings");
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast.error("Unable to save notification settings");
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
      toast.success("Switched Profile");
    } catch (error) {
      console.error("Unable to switch account", error);
      toast.error("Unable to switch account");
    }
  };

  return (
    <>
      <Toaster />{" "}
      <main className="p-8 max-w-4xl mx-auto">
        <div className="space-y-12">
          {/* Switch Profiles Section */}
          <section className="bg-white rounded-lg border p-6">
            <h1 className="text-2xl font-bold mb-6">Profiles</h1>
            <div className="space-y-8">
              {/* Profiles */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <h3 className="text-lg font-semibold">Your Profiles</h3>
                </div>
                <Select onValueChange={setLastActiveProfileId}>
                  <SelectTrigger className="h-12">
                    <SelectValue
                      placeholder={
                        profile
                          ? `${profile?.firstName} ${profile?.lastName}`
                          : ""
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Profiles</SelectLabel>
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

            <Button
              onClick={handleSwitchProfile}
              className="mt-6 w-full sm:w-auto"
            >
              Switch Profile
            </Button>
          </section>
          {/* Notifications Section */}
          <section className="bg-white rounded-lg border p-6">
            <h1 className="text-2xl font-bold mb-6">Notification Settings</h1>

            <div className="space-y-8">
              {/* Session Reminders */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <h3 className="text-lg font-semibold">Session Reminders</h3>
                    <p className="text-sm text-gray-600">
                      Get notified about upcoming tutoring sessions
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
                          Email notifications
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
                          Text notifications
                        </Label>
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                          In Development
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
                    <h3 className="text-lg font-semibold">Webinar Reminders</h3>
                    <p className="text-sm text-gray-600">
                      Get notified about upcoming webinars and events
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
                        Email notifications
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
                          Text notifications
                        </Label>
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                          In Development
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
            <Button
              onClick={handleSaveNotifications}
              className="mt-6 w-full sm:w-auto"
            >
              Save Notification Settings
            </Button>
          </section>
          <section className="bg-white rounded-lg border p-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold">Account Settings</h2>
              <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
                In Development
              </span>
            </div>
            <p className="text-gray-600 mb-6">
              Manage your information and account preferences.
            </p>
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* students can toggle their own active inactive status here without needing admin intervention to deactivate account */}
              {profile?.role === "Student" && (
                <div>
                  <Label
                    htmlFor="account-status"
                    className="text-sm font-medium"
                  >
                    Account Status
                  </Label>
                  <Select
                    value={accountStatus}
                    onValueChange={(value) =>
                      setAccountStatus(value as Profile["status"])
                    }
                  >
                    <SelectTrigger id="account-status" className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first-name" className="text-sm font-medium">
                    First Name
                  </Label>
                  <Input
                    id="first-name"
                    placeholder="Enter your first name (e.g John)"
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
                    Last Name
                  </Label>
                  <Input
                    id="last-name"
                    placeholder="Enter your last name (e.g Smith)"
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
                    Phone Number
                  </Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="Enter your phone number (e.g (555) 123-4567)"
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
                    Age
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="Enter your age (e.g 25)"
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
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email (e.g john@example.com)"
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
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself (e.g What hobbies do you enjoy?)"
                  className="mt-1 placeholder:text-gray-300"
                  rows={4}
                  disabled
                />
              </div>
              <div>
                <Label htmlFor="subjects" className="text-sm font-medium">
                  Subjects of Interest
                </Label>
                <Textarea
                  id="subjects"
                  placeholder="Enter your subjects of interest (e.g Mathematics, Physics, Chemistry)"
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
                {/* hi */}
                <Label htmlFor="languages" className="text-sm font-medium">
                  Languages Spoken
                </Label>
                <Textarea
                  id="languages"
                  placeholder="Enter languages you speak (e.g English, Spanish, French)"
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
                {isSavingProfile ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
