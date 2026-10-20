"use client";

import toast, { Toaster } from "react-hot-toast";
import Logo from "@/components/ui/logo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  resetEmailSchema as emailSchema,
  resetCodeSchema as tokenSchema,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  passwordResetError,
} from "@/lib/auth/password-reset";

export default function ForgotPasswordPage() {
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [emailForReset, setEmailForReset] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const pending = useRef(false);
  const isLoading = status !== "idle";
  const supabase = createClient();

  useEffect(() => {
    if (resendAfter <= Date.now()) return;
    const timer = setInterval(() => {
      if (Date.now() >= resendAfter) setResendAfter(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const tokenForm = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      token: "",
    },
  });

  const handleSendToken = async (values: z.infer<typeof emailSchema>) => {
    if (pending.current || resendAfter > Date.now()) return;
    pending.current = true;
    setStatus("sending");
    setErrorMessage("");
    // Also throttle retries after a timeout: the original email may still arrive.
    setResendAfter(Date.now() + 60_000);
    try {
      await sendPasswordResetCode(supabase, values.email);
      setEmailForReset(values.email);
      setIsEmailSent(true);
      tokenForm.reset({ token: "" });
      toast.success("If an account exists for that email, we've sent a 6-digit code.");
    } catch (error) {
      setErrorMessage(
        passwordResetError(error, "We couldn't send a code. Please try again in a minute."),
      );
    } finally {
      pending.current = false;
      setStatus("idle");
    }
  };

  const handleVerifyOtp = async (values: z.infer<typeof tokenSchema>) => {
    if (pending.current) return;
    pending.current = true;
    setStatus("verifying");
    setErrorMessage("");
    try {
      await verifyPasswordResetCode(supabase, emailForReset, values.token);
      // Load with the newly persisted session cookies, without a push/refresh race.
      window.location.assign("/set-password");
    } catch (error) {
      setErrorMessage(passwordResetError(error, "We couldn't verify the code. Please try again."));
      pending.current = false;
      setStatus("idle");
    }
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
              {!isEmailSent ? (
                <>
                  <div className="flex flex-col gap-3">
                    <h1 className="text-2xl text-center font-bold">Forgot Password</h1>
                    <p className="text-sm text-gray-600"></p>
                  </div>
                  <Form {...emailForm}>
                    <form
                      method="post"
                      onSubmit={(event) => emailForm.handleSubmit(handleSendToken)(event)}
                      className="space-y-8 p-0 rounded-md"
                    >
                      <FormField
                        control={emailForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormDescription>
                              No worries! Just enter the email associated with your account to reset
                              your password
                            </FormDescription>
                            <FormControl>
                              <Input
                                type="email"
                                autoComplete="email"
                                aria-label="Email address"
                                placeholder="youremail@example.com"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full bg-blue-400"
                        disabled={isLoading || resendAfter > 0}
                      >
                        {status === "sending"
                          ? "Sending..."
                          : resendAfter > 0
                            ? "Please wait before trying again"
                            : "Reset Password"}
                      </Button>
                    </form>
                  </Form>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 text-center">
                    <h1 className="text-xl sm:text-2xl font-bold">Enter Verification Code</h1>
                    <p className="text-sm text-gray-600">
                      If an account exists for {emailForReset}, a code is on its way. Enter the code
                      from the latest email.
                    </p>
                  </div>
                  <Form {...tokenForm} key="otp-form">
                    <form
                      method="post"
                      onSubmit={(event) => tokenForm.handleSubmit(handleVerifyOtp)(event)}
                      className="space-y-6 w-full"
                    >
                      <FormField
                        control={tokenForm.control}
                        name="token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>One-Time Password</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="Enter your 6-digit code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                disabled={isLoading}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                        disabled={isLoading}
                      >
                        {status === "verifying" ? "Verifying..." : "Verify code"}
                      </Button>
                    </form>
                  </Form>
                  <Button
                    variant="outline"
                    onClick={() => handleSendToken({ email: emailForReset })}
                    disabled={isLoading || resendAfter > 0}
                  >
                    {status === "sending"
                      ? "Sending..."
                      : resendAfter > 0
                        ? "Resend available in a minute"
                        : "Resend code"}
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsEmailSent(false);
                      setErrorMessage("");
                      emailForm.reset();
                      tokenForm.reset();
                    }}
                    disabled={isLoading}
                  >
                    Use a different email?
                  </Button>
                </>
              )}
              {errorMessage && (
                <p role="alert" className="text-sm text-red-600">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
