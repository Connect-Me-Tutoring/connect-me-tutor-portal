import { getProfile } from "@/lib/actions/user/client.actions";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

/**
 * Custom hook to fetch the profile of the currently authenticated user.
 * @returns An object containing the profile data or null if not found.
 * @throws Will throw an error if the user is not authenticated or if there is an issue fetching the profile.
 */
export const useFetchProfile = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw new Error(userError.message);
        if (!user) throw new Error("No user found");

        const profileData = await getProfile(user.id);
        if (profileData && isMounted) setProfile(profileData);
      } catch (error: any) {
        if (isMounted) setError(error);
        console.error("Error fetching profile:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return { profile: profile, loading, error };
};

export const useFetchUser = () => {};
