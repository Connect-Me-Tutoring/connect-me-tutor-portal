"use client";

import { useEffect } from "react";
import Link from "next/link";
import Logo from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils/error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root application error:", error);
  }, [error]);

  return (
    <>
      <section className="flex flex-row">
        <div className="absolute left-8 top-8">
          <Logo />
        </div>
      </section>
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg p-8 flex flex-col items-center justify-center gap-4 border border-gray-300 rounded-xl bg-white shadow-sm text-center">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm text-gray-600">
              {getErrorMessage(error, "An unexpected error occurred while loading this page.")}
            </p>
          </div>
          <div className="flex gap-3 mt-2 w-full sm:w-auto">
            <Button onClick={() => reset()} className="bg-blue-500 hover:bg-blue-600">
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to login</Link>
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
