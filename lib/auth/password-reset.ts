import { isAuthError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.types";

export const resetEmailSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
});

export const resetCodeSchema = z.object({
  token: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email.")),
});

// Bound UI waits even if the network or the auth client's session lock stalls.
// The underlying SDK call can still settle; callers must only act on this result.
export async function withAuthTimeout<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("The request timed out. Check your connection and try again."));
        }, 20_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendPasswordResetCode(client: SupabaseClient<Database>, email: string) {
  const { error } = await withAuthTimeout(
    client.auth.signInWithOtp({
      email,
      // Keep the deployed login-code templates and support admin-created accounts.
      options: { shouldCreateUser: false },
    }),
  );
  // Avoid revealing whether the email belongs to an account.
  if (error && error.code !== "otp_disabled" && error.code !== "signup_disabled") {
    throw error;
  }
}

export async function verifyPasswordResetCode(
  client: SupabaseClient<Database>,
  email: string,
  token: string,
) {
  const { data, error } = await withAuthTimeout(
    client.auth.verifyOtp({ email, token, type: "email" }),
  );
  if (error) throw error;
  if (!data.session) {
    throw new Error("We couldn't start your password reset. Request a new code and try again.");
  }
}

export function passwordResetError(error: unknown, fallback: string): string {
  if (isAuthError(error)) {
    if (error.code === "otp_expired") {
      return "This code is invalid or has expired. Use the latest email, or request a new code.";
    }
    if (error.status === 429) {
      return "Too many attempts. Please wait a minute before trying again.";
    }
    if (error.name === "AuthRetryableFetchError") {
      return "We couldn't connect. Check your connection and try again.";
    }
    return fallback;
  }
  return error instanceof Error && error.message.includes("timed out") ? error.message : fallback;
}
