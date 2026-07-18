"use client";

import { Suspense } from "react";
import { NavigationProgress } from "@/components/ui/navigation-progress";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {children}
    </>
  );
}
