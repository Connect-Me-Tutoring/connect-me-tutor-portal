"use client";

import { useEffect } from "react";
import Link from "next/link";
import { getErrorMessage } from "@/lib/utils/error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-6 bg-gray-50 text-gray-900 font-sans">
        <div className="w-full max-w-md p-8 border border-gray-300 rounded-xl bg-white text-center flex flex-col items-center gap-4 shadow-sm">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            {getErrorMessage(error, "An unexpected error occurred. Please refresh the page.")}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 cursor-pointer border-none"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 border border-gray-300 text-decoration-none"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
