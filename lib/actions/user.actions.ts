import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile } from "@/types";
import { Table } from "../supabase/tables";
import { tableToInterfaceProfiles } from "../type-utils";
import { table } from "console";
import { supabase } from "@/lib/supabase/client"


export const getUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null; // Return null if no user or error occurs
  }
  return user;
};

export const getProfileFromUserSettings = async (
  userId: string
): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        `
        profile:Profiles!last_active_profile_id(
          id,
          created_at,
          role,
          user_id,
          first_name,
          last_name,
          date_of_birth,
          start_date,
          availability,
          email,
          phone_number,
          parent_name,
          parent_phone,
          parent_email,
          tutor_ids,
          timezone,
          subjects_of_interest,
          status,
          student_number,
          settings_id,
          languages_spoken
        )
      `
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile in getProfile:", error.message);
      console.error("Error details:", error);
      throw error;
    }

    if (!data?.profile) {
      return null;
    }

    return tableToInterfaceProfiles(data.profile as any);
  } catch (error) {
    throw error;
  }
};

//Fetches profile through userId
export const getProfile = async (userId: string): Promise<Profile | null> => {
  if (!userId) {
    console.error("User ID is required to fetch profile data");
    return null;
  }
  try {
    return await getProfileFromUserSettings(userId);
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
};

export const getProfileByEmail = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select(
        `
      profile:Profiles!last_active_profile_id(*)  
        `
      )
      .eq("email", email)
      .single();
    if (error) throw new Error(`Profile fetch failed: ${error.message}`);
    const userProfile: Profile | null = await tableToInterfaceProfiles(data.profile);
    return userProfile;
  } catch (error) {
    throw error;
  }
};

export const getProfileRole = async (
  userId: string
): Promise<string | null> => {
  if (!userId) {
    console.error("User ID is required to fetch profile role");
    return null;
  }

  try {
    const { data } = await supabase
      .from("user_settings")
      .select(
        `
        profile:Profiles!last_active_profile_id(role)
      `
      )
      .eq("user_id", userId)
      .maybeSingle()
      .throwOnError();

    if (!data?.profile?.role) {
      return null;
    }

    const profileRole: { profile: { role: string } } = data as any;

    console.log("Profile Data", profileRole.profile.role);

    if (!profileRole || !profileRole.profile || !profileRole.profile.role) {
      console.error("No role identified");
      return null;
    }

    const result = profileRole?.profile.role || null;
    console.log(result);

    return result;
  } catch (error) {
    console.error("Unexpected error in getProfileRole:", error);
    return null;
  }
};

export const getSessionUserProfile = async (): Promise<Profile | null> => {
  const user = await getUser();
  const userId = user?.id;

  try {
    return userId ? await getProfileFromUserSettings(userId) : null;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
};

export async function getProfileWithProfileId(
  profileId: string
): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .select(
        `
        id,
        created_at,
        role,
        user_id,
        first_name,
        last_name,
        date_of_birth,
        start_date,
        availability,
        email,
        phone_number,
        parent_name,
        parent_phone,
        parent_email,
        tutor_ids,
        timezone,
        subjects_of_interest,
        status,
        student_number,
        settings_id
      `
      )
      .eq("id", profileId)
      .single();

    if (error) {
      console.error(
        "Error fetching profile in getProfileWithProfileId:",
        error.message
      );
      console.error("Error details:", error);
      return null;
    }

    // Mapping the fetched data to the Profile object
    const userProfile: Profile | null = await tableToInterfaceProfiles(data);

    return userProfile;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}

export async function getUserInfo() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null; // Return null if no user or error occurs
  }
  return user;
}

export async function updateProfile(userId: string, profileData: any) {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update(profileData)
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
}

export async function createUser(userData: any) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
    });

    if (error) throw error;

    // If you need to store additional user data, you can do it here
    const { data: profileData, error: profileError } = await supabase
      .from(Table.Profiles)
      .insert({
        user_id: data.user.id,
        ...userData,
      })
      .single();

    if (profileError) throw profileError;

    return { user: data.user, profile: profileData };
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

export const logoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
    }
  } catch (error) {
    console.error("Unexpected error logging out:", error);
  }
};
