"use client";

import toast, { Toaster, ValueFunction } from "react-hot-toast";
import Logo from "@/components/ui/logo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
import { setDefaultAutoSelectFamily } from "net";

const emailSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

const tokenSchema = z.object({
  email: z.string().email(),
  token: z.string().min(6, { message: "Token must be 6 digits" }).max(6),
});

export default function ForgotPasswordPage() {
  const [resetPassword, setResetPassword] = useState<boolean>(false);
  const [isEmailSent, setIsEmailSent] = useState<boolean>(false);
  const [emailForReset, setEmailForReset] = useState<string>("");

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const sendResetPassword = async () => {
    try {
      const email = emailForm.getValues("email");

      const { data, error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error();
      }

      toast.success("Password reset email sent successfully");
    } catch (error) {
      console.error("Unable to reset password");
      toast.error(`Unable to send reset password link ${error}`);
    }
  };
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const tokenForm = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: {
      email: "",
      token: "",
    },
  });

  const handleSendToken = async (values: z.infer<typeof emailSchema>) => {
    setEmailForReset(values.email);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        // options: {
        // emailRedirectTo: `${window.location.origin}/auth/callback`,
        // }
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success("6-digit code sent to your email");
      setIsEmailSent(true);
      emailForm.reset();

      tokenForm.reset({
        email: values.email,
        token: "",
      });
    } catch (error) {
      console.error("Error sending token:", error);
    }
  };

  const handleVerifyOtp = async (values: z.infer<typeof tokenSchema>) => {
    setIsLoading(true);
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.verifyOtp({
        email: values.email, // Use the stored email
        token: values.token,
        type: "email", // or 'sms' if using SMS OTP
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      if (session) {
        router.push("/set-password"); // Redirect to dashboard or home
        router.refresh(); // Refresh server components
      } else {
        toast.error("Failed to verify OTP. Please try again.");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      // toast.error("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
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
                      onSubmit={emailForm.handleSubmit(handleSendToken)}
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
                              <Input placeholder="youremail@example.com" {...field} />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full bg-blue-400">
                        Reset Password
                      </Button>
                    </form>
                    <Toaster />
                  </Form>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 text-center">
                    <h1 className="text-xl sm:text-2xl font-bold">Enter Verification Code</h1>
                    <p className="text-sm text-gray-600">
                      A verification code has been sent to {emailForReset}. Please enter it below.
                    </p>
                  </div>
                  <Form {...tokenForm} key="otp-form">
                    <form
                      onSubmit={tokenForm.handleSubmit(handleVerifyOtp)}
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
                                maxLength={6}
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
                        {isLoading ? "Verifying..." : "Verify code"}
                      </Button>
                    </form>
                  </Form>
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsEmailSent(false);
                      emailForm.reset();
                      tokenForm.reset();
                    }}
                    disabled={isLoading}
                  >
                    Use a different email?
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
