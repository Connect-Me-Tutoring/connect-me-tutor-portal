"use client";

import { createContext, useContext, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { ReactNode } from "react";
import type { Profile } from "@/types";
import { getProfile } from "@/lib/actions/user.actions";

type ProfileContextValue = {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileContextProvider({ children, initialProfile }: { children: ReactNode, initialProfile: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);

  // Sync with server-side profile when it changes
  if (initialProfile && profile?.id !== initialProfile.id) {
    setProfile(initialProfile);
  }

  const contextValue: ProfileContextValue = {
    profile,
    setProfile,
  };

  return (
    <ProfileContext.Provider value={contextValue}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (context === null) {
    throw new Error("useProfile must be used within ProfileContextProvider");
  }
  return context;
}
