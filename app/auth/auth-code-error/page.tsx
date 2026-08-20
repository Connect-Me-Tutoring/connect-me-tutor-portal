"use client";

import { supabase } from "@/lib/supabase/client";
import toast, { Toaster, ValueFunction } from "react-hot-toast";
import Logo from "@/components/ui/logo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
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

export default function AuthError() {
  const [resetPassword, setResetPassword] = useState<boolean>(false);

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("auth.authCodeError");
  const tCommon = useTranslations("auth.common");

  const formSchema = z.object({
    email: z.string().email({
      message: tCommon("errors.invalidEmail"),
    }),
  });

  const sendResetPassword = async () => {
    try {
      const email = form.getValues("email");

      const { data: resetData, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });
      if (error) {
        throw error;
      }
      if (!resetData) {
        throw new Error();
      }
      toast.success(tCommon("toasts.resetEmailSent"));
    } catch (error) {
      console.error("Unable to reset password");
      toast.error(`${tCommon("toasts.resetEmailError")} ${error}`);
    }
  };
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

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
                <h1 className="text-2xl text-center font-bold">{t("title")}</h1>
                <p className="text-sm text-gray-600"></p>
              </div>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(async () => {
                    await sendResetPassword();
                  })}
                  className="space-y-8 p-0 rounded-md"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("enterEmailLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={tCommon("emailPlaceholder")} {...field} />
                        </FormControl>
                        <FormDescription>{t("description")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full bg-blue-400">
                    {tCommon("resetPassword")}
                  </Button>
                </form>
                <Toaster />
              </Form>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
