"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast, { Toaster, ValueFunction } from "react-hot-toast";
import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { startNavigationProgress } from "@/components/ui/navigation-progress";
import { X, ExternalLink } from "lucide-react";

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
import { getProfileRole } from "@/lib/actions/user/actions";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
});

export default function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        throw error;
      }

      const userRole = await getProfileRole(data.user.id);

      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmailsList = adminEmails ? adminEmails.split(",") : [];

      if (userRole == "Admin" && data.user.email && !adminEmailsList.includes(data.user.email)) {
        await supabase.auth.signOut();
        router.push("/auth/otp-login?autoSend=true&email=" + encodeURIComponent(values.email));
      } else if (data.user) {
        toast.success("Logged in successfully");
        startNavigationProgress();
        window.location.assign("/dashboard");
        return;
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  function showForms() {
    const message = "Language Questionaire, We'd love your feedback!";
    const formUrl = "https://forms.gle/gS8g8JBh7T4kNFUC9";

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <ExternalLink className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {message || "We'd love your feedback!"}
                </p>
                <button
                  onClick={() => {
                    window.open(formUrl, "_blank");
                    toast.dismiss(t.id);
                  }}
                  className="mt-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Fill out our form →
                </button>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ),
      { duration: 1000000, position: "bottom-right" },
    );
  }

  return (
    <>
      <Toaster />
      <Suspense>
        {" "}
        <Form {...form} key="login-form">
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4 p-0 rounded-md">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center w-full">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium hover:text-blue-800 underline" // Added styling for the link
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <FormControl>
                    <Input type="password" placeholder="Enter your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button disabled={isLoading} type="submit" className="w-full bg-blue-400">
              {isLoading ? "Logging in..." : "Login"}
            </Button>
            <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
              <span className="bg-background text-muted-foreground relative z-10 px-2">
                Or continue with
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => router.push("/auth/otp-login")}
              type="button"
            >
              Login with OTP
            </Button>
          </form>
        </Form>
      </Suspense>
    </>
  );
}
