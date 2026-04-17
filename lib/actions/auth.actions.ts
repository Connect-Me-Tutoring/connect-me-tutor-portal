"use client";
import { CreatedProfileData, Profile } from "@/types";
import { createUser as createUserServer } from "@/lib/actions/auth.server.actions";
import { createPassword } from "@/lib/utils";

export const addUser = async (
  userData: Partial<Profile>,
  userRole: "Tutor" | "Student",
  isAddToPairing: boolean = false,
) => {
  let err: Error | undefined;
  for (let i = 0; i < 5; ++i) {
    try {
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
      const profileData: Profile = await createUserServer(newProfileData);
      return profileData;
    } catch (error) {
      err = error as Error;
      console.error("Error adding tutor:", err.message);
    }
  }
  if (err) throw err;
  throw new Error("addUser did not run");
};
