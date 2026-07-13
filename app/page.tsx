import LoginForm from "@/components/auth/LoginForm";
import Logo from "@/components/ui/logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in | Connect Me",
  description: "Sign in to your Connect Me tutoring portal.",
};

export default async function LoginPage() {
  return (
    <main className="min-h-svh bg-white text-[#071329] lg:grid lg:min-h-[760px] lg:grid-cols-[48%_52%]">
      <section className="relative min-h-[250px] overflow-hidden bg-[#dceeff] px-6 py-7 sm:min-h-[300px] sm:px-10 lg:min-h-svh lg:px-[10%] lg:py-12">
        <div className="absolute left-8 top-8">
          <Logo />
        </div>
        <div className="h-5/6" />
        <div className=" w-full h-fit text-lg p-8">
          &quot;Connect me has helped me explore new math topics and learn
          critical problem solving skills. It makes learning so much fun&quot;
          <br />
          --Olivia M.
        </div>
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
    </main>
  );
}
