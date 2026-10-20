"use client";

import Logo from "@/components/ui/logo";
import { createClient } from "@/lib/supabase/client";
import { withAuthTimeout, passwordResetError } from "@/lib/auth/password-reset";
import { useState, useRef, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import * as z from "zod";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

const formSchema = z
  .object({
    password: z.string().min(8, {
      message: "Password must be at least 8 characters",
    }),
    confirmPassword: z.string().min(8, {
      message: "Password must be at least 8 characters",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const pending = useRef(false);

  const [data, setData] = useState<{
    password: string;
    confirmPassword: string;
  }>({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const confirmPasswords = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    setErrorMessage("");
    const parsed = formSchema.safeParse(data);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0].message);
      return;
    }
    pending.current = true;
    setIsLoading(true);
    try {
      const { data: resetData, error } = await withAuthTimeout(
        supabase.auth.updateUser({
          password: parsed.data.password,
        }),
      );
      if (error) {
        if (error.code === "session_not_found" || error.name === "AuthSessionMissingError") {
          setErrorMessage(
            "Your reset session has expired. Request a new code to reset your password.",
          );
          return;
        }
        if (error.code === "same_password" || error.code === "weak_password") {
          setErrorMessage(error.message);
          return;
        }
        throw error;
      }
      if (!resetData.user) throw new Error("Password update returned no user");
      toast.success("Login information updated");
      window.location.assign("/");
    } catch (error) {
      setErrorMessage(
        passwordResetError(error, "We couldn't update your password. Please try again."),
      );
    } finally {
      pending.current = false;
      setIsLoading(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <Toaster />
      <section className="flex flex-row ">
        <div className="absolute left-8 top-8">
          <Logo />
        </div>
      </section>
      <section className="flex flex-row justify-center items-center min-h-screen">
        <section className="w-full flex flex-col items-center ">
          <div className="container h-full mx-auto max-w-lg p-10 flex flex-col items-center justify-center align-center">
            <div className="p-8 flex flex-col items-center justify-center gap-4 border border-gray-300 rounded-xl">
              <div className="flex flex-col gap-3">
                <h1 className="text-2xl text-center font-bold">Set your Password</h1>
                <p className="text-sm text-gray-600"></p>
              </div>
              <form
                method="post"
                onSubmit={confirmPasswords}
                className="container mx-auto w-full max-w-[400px] grid gap-4"
              >
                <div className="grid gap-4">
                  <label htmlFor="password" className="text-sm font-medium">
                    Enter your new password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    value={data?.password}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="grid gap-4">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm your new password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    disabled={isLoading}
                    value={data?.confirmPassword}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  className="cursor-pointer hover:underline"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "Hide passwords" : "Show passwords"}
                </button>
                {errorMessage && (
                  <p role="alert" className="text-sm text-red-600">
                    {errorMessage}
                  </p>
                )}
                <Button type="submit" className="w-full bg-blue-400" disabled={isLoading}>
                  {isLoading ? "Updating..." : "Set Password"}
                </Button>
                <Link href="/forgot-password" className="text-sm text-center underline">
                  Request a new reset code
                </Link>
                <p className="text-xs text-center text-gray-600">
                  By setting your password you agree to our{" "}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
