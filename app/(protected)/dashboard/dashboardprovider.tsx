"use client"; // This needs to be at the top to declare a client component

import React, { useEffect, useState } from "react";
import {
  ProfileContextProvider,
  useProfile,
} from "@/lib/contexts/profileContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Profile } from "@/types";

export default function DashboardProviders({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  initialProfile: Profile | null;
}) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileContextProvider initialProfile={initialProfile}>
        {children}
      </ProfileContextProvider>
    </QueryClientProvider>
  );
}
