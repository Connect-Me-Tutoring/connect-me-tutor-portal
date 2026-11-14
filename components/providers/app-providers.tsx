"use client";

import { Suspense } from "react";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/utils/error";

// Intercept toast.error globally so minified React errors or raw database
// messages are sanitized before being displayed to users.
if (typeof window !== "undefined") {
  const originalError = toast.error;
  toast.error = (message, options) => {
    const sanitized = typeof message === "function" ? message : getErrorMessage(message);
    return originalError(sanitized, options);
  };
}

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
