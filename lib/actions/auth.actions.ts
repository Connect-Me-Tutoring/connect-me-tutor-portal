"use client";
import { supabase } from "@/lib/supabase/client";
import { CreatedProfileData, Profile } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { createUser as createUserServer } from "@/lib/actions/auth.server.actions";
import { createPassword } from "@/lib/utils";
import { NextResponse } from "next/server";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { createPairingRequest, handleResolveQueues } from "./pairing.actions";
import { X } from "lucide-react";

const createUser = async (userData: CreatedProfileData): Promise<Profile> => {
  try {
    // Call signUp to create a new user
    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error: ${response.status}`);
    }
    return data.profileData;
  } catch (error) {
    const err = error as Error;
    console.error("Error creating user in API:", err.message);
    throw err;
  }
};

export const addUser = async (
  userData: Partial<Profile>,
  userRole: "Tutor" | "Student",
  isAddToPairing: boolean = false,
) => {
  let userId: string | null = null;
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
    const err = error as Error;
    console.error("Error adding tutor:", err.message);
    throw err;
  }
};
