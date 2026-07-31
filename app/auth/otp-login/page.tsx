"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { useState, useEffect, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/ui/navigation-progress";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/ui/logo"; // Import Logo
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

// Define your Zod schema for OTP login
const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
});

const otpSchema = z.object({
  email: z.string().email(), // Keep email for verification if needed
  token: z.string().min(6, { message: "OTP must be 6 digits." }).max(6),
});

function OTPLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [emailForOtp, setEmailForOtp] = useState("");
  const sentOtp = useRef(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      email: "",
      token: "",
    },
  });

  useEffect(() => {
    const autoSendOtp = async () => {
      if (sentOtp.current) return;

      const isAutoSendOTP = searchParams.get("autoSend");

      if (isAutoSendOTP === "true") {
        const email = searchParams.get("email");

        if (email) {
          emailForm.setValue("email", email);
          sentOtp.current = true;
          await handleSendOtp({ email });
          setOtpSent(true);
        }
      }
    };
    autoSendOtp();
  }, [searchParams]);

  const handleSendOtp = async (values: z.infer<typeof emailSchema>) => {
    setIsLoading(true);
    setEmailForOtp(values.email);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        // options: {
        // emailRedirectTo: `${window.location.origin}/auth/callback`,
        // },
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      toast.success("OTP sent to your email!");
      setOtpSent(true);
      emailForm.reset();

      // Properly reset and set the OTP form
      otpForm.reset({
        email: values.email,
        token: "",
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (values: z.infer<typeof otpSchema>) => {
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
        toast.success("Logged in successfully!");
        startNavigationProgress();
        window.location.assign("/dashboard");
        return;
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
      <Toaster position="top-center" />
      <section className="flex flex-row ">
        <div className="absolute left-4 top-4 sm:left-8 sm:top-8">
          <Logo />
        </div>
      </section>
      <section className="flex flex-row justify-center items-center min-h-screen px-4">
        <section className="w-full flex flex-col items-center ">
          <div className="container h-full mx-auto max-w-lg p-6 sm:p-10 flex flex-col items-center justify-center">
            <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-4 border border-gray-300 rounded-xl shadow-lg w-full">
              {!otpSent ? (
                <>
                  <div className="flex flex-col gap-3 text-center">
                    <h1 className="text-xl sm:text-2xl font-bold">Login with OTP</h1>
                    <p className="text-sm text-gray-600">
                      Enter your email to receive a One-Time Password.
                    </p>
                  </div>
                  <Form {...emailForm}>
                    <form
                      onSubmit={emailForm.handleSubmit(handleSendOtp)}
                      className="space-y-6 w-full"
                    >
                      <FormField
                        control={emailForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="youremail@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending OTP..." : "Send OTP"}
                      </Button>
                    </form>
                  </Form>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 text-center">
                    <h1 className="text-xl sm:text-2xl font-bold">Enter OTP</h1>
                    <p className="text-sm text-gray-600">
                      An OTP has been sent to {emailForOtp}. Please enter it below.
                    </p>
                  </div>
                  <Form {...otpForm} key="otp-form">
                    <form
                      onSubmit={otpForm.handleSubmit(handleVerifyOtp)}
                      className="space-y-6 w-full"
                    >
                      <FormField
                        control={otpForm.control}
                        name="token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>One-Time Password</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="Enter your 6-digit OTP"
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
                        {isLoading ? "Verifying..." : "Verify OTP & Login"}
                      </Button>
                    </form>
                  </Form>
                  <Button
                    variant="link"
                    onClick={() => {
                      setOtpSent(false);
                      emailForm.reset();
                      otpForm.reset();
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

const OTPForm = () => {
  return (
    <>
      <Suspense fallback={null}>
        <OTPLogin />
      </Suspense>
    </>
  );
};

export default OTPForm;
