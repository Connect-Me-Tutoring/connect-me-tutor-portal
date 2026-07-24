import LoginForm from "@/components/auth/LoginForm";
import { LoginTestimonial } from "@/components/auth/LoginTestimonial";
import Logo from "@/components/ui/logo";
import { selectRandomLoginQuote } from "@/lib/login/select-random-login-quote";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Log in | Connect Me",
  description: "Connect Me Tutor Portal",
};

export default async function LoginPage() {
  await connection();
  const quote = selectRandomLoginQuote();

  return (
    <section className="flex flex-col md:flex-row ">
      <section className="lg:hidden flex flex-col p-1 items-center justify-center bg-white shadow-md">
        <Logo />
      </section>
      <section className="hidden lg:flex flex-col w-1/2 h-full lg:h-[100vh] bg-[#d9ebff] rounded-xl">
        <div className="absolute left-8 top-8">
          <Logo />
        </div>
        <div className="h-5/6" />
        <LoginTestimonial quote={quote} />
      </section>
      <section className="w-full h-full lg:w-1/2 flex flex-col items-center justify-center p-4 lg:p-20">
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 px-5 lg:px-20 py-20 rounded-xl">
          <div className="flex flex-col gap-1 w-full">
            <h1 className="text-4xl text-center font-bold">Welcome Back</h1>
            <p className="text-sm text-center opacity-50">
              Enter your email and password to continue.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </section>
  );
}
