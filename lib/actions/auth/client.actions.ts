"use client";
import { CreatedProfileData, Profile } from "@/types";
import { createUser as createUserServer } from "@/lib/actions/auth/server.actions";
import { createPassword } from "@/lib/utils";

export const addUser = async (
  userData: Partial<Profile>,
  userRole: "Tutor" | "Student",
  isAddToPairing: boolean = false,
) => {
  if (!userData.email) {
    throw new Error("Email is required to create a student profile");
  }

  const lowerCaseEmail = userData.email.toLowerCase().trim();
  const tempPassword = await createPassword();

  const userAvailability = userData.availability
    ? userData.availability.length === 0
      ? [
          { day: "Monday", startTime: "00:00", endTime: "23:59" },
          { day: "Tuesday", startTime: "00:00", endTime: "23:59" },
          { day: "Wednesday", startTime: "00:00", endTime: "23:59" },
          { day: "Thursday", startTime: "00:00", endTime: "23:59" },
          { day: "Friday", startTime: "00:00", endTime: "23:59" },
          { day: "Saturday", startTime: "00:00", endTime: "23:59" },
          { day: "Sunday", startTime: "00:00", endTime: "23:59" },
        ]
      : userData.availability
    : [];

  const newProfileData: CreatedProfileData = {
    email: lowerCaseEmail,
    password: tempPassword,
    role: userRole,
    firstName: userData.firstName || "",
    lastName: userData.lastName || "",
    age: userData.age || "",
    grade: userData.grade || "",
    gender: userData.gender || "",
    startDate: userData.startDate || new Date().toISOString(),
    availability: userAvailability,
    parentName: userData.parentName || "",
    parentPhone: userData.parentPhone || "",
    parentEmail: userData.parentEmail || "",
    phoneNumber: userData.phoneNumber || "",
    timezone: userData.timeZone || "",
    subjects_of_interest: userData.subjects_of_interest || [],
    status: "Active",
    studentNumber: userData.studentNumber || "",
    languages_spoken: userData.languages_spoken || [],
  };

  // No automatic retry: creating an account sends an invite and isn't idempotent, so
  // retrying used to send several invites (each dead once rolled back) or add the same
  // person twice. A manual retry after a success is refused as a duplicate.
  return createUserServer(newProfileData);
};

/** What to tell the admin after a successful add. */
export const addedUserMessage = (
  result: { profile: Profile; invited: boolean },
  role: "Tutor" | "Student",
) => {
  const who = role.toLowerCase();
  if (result.invited) return `Added ${who}. An invite email was sent to ${result.profile.email}.`;
  return `Added ${who} to the login that already uses ${result.profile.email}. No invite email was sent: they sign in with that login and can switch profiles from the menu.`;
};
