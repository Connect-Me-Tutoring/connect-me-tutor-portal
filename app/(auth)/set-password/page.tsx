"use client";

import Logo from "@/components/ui/logo";

import { createClient } from "@/lib/supabase/client";
import { setDefaultAutoSelectFamily } from "net";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { string } from "zod";
import { Button } from "@/components/ui/button";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import toast, { Toaster, ValueFunction } from "react-hot-toast";

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
import { Router } from "lucide-react";

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
  const router = useRouter();

  // const [isVerifying, setIsVerifying ] = useState(true)
  // const [verificationError, setVerificationError ] = useState<string | null>(null);

  const [data, setData] = useState<{
    password: string;
    confirmPassword: string;
  }>({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const confirmPasswords = async () => {
    try {
      const { password, confirmPassword } = data;
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return alert("Passwords do not match");
      }

      const { data: resetData, error } = await supabase.auth.updateUser({
        password: data.password,
      });
      if (error) {
        throw error;
      }

      if (resetData.user) {
        toast.success("Login information updated");
        router.push("/");
      }
    } catch (error) {
      console.error("Password update error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
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
              <div className="container mx-auto w-[400px] grid gap-4">
                <div className="grid gap-4">
                  <label className="text-sm font-medium">Enter your new password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={data?.password}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="grid gap-4">
                  <label className="text-sm font-medium">Confirm your new password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={data?.confirmPassword}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div
                  className="cursor-pointer hover:underline"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  Show passwords
                </div>
                <Button type="submit" className="w-full bg-blue-400" onClick={confirmPasswords}>
                  Set Password
                </Button>
              </div>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
