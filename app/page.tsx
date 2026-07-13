import LoginForm from "@/components/auth/LoginForm";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Log in | Connect Me",
  description: "Sign in to your Connect Me tutoring portal.",
};

export default async function LoginPage() {
  return (
    <main className="min-h-svh bg-white text-[#071329] lg:grid lg:min-h-[760px] lg:grid-cols-[48%_52%]">
      <section className="relative min-h-[250px] overflow-hidden bg-[#dceeff] px-6 py-7 sm:min-h-[300px] sm:px-10 lg:min-h-svh lg:px-[10%] lg:py-12">
        <div
          aria-hidden="true"
          className="absolute -left-8 top-[22%] h-20 w-20 rounded-full bg-[#f4f0c9] sm:h-24 sm:w-24 lg:-left-10 lg:top-[18%]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-[22%] top-[16%] h-[390px] w-[390px] rounded-full bg-[#bfe8f5]/70 sm:-right-[12%] lg:-right-[28%] lg:h-[620px] lg:w-[620px]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-[#f4f0c9] lg:-bottom-40 lg:-left-28 lg:h-[350px] lg:w-[350px]"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-[7%] right-[15%] hidden h-24 w-24 rounded-full bg-[#b9dcff]/80 lg:block"
        />

        <div className="relative z-10 flex items-center gap-3">
          <Image
            alt="Connect Me globe"
            className="h-10 w-10 sm:h-11 sm:w-11"
            height={44}
            priority
            src="/logo.png"
            width={44}
          />
          <span className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
            Connect Me
          </span>
        </div>
        <h1 className="relative z-10 mt-16 max-w-[520px] text-[2.5rem] font-bold leading-[1.06] tracking-[-0.035em] text-balance sm:mt-20 sm:text-5xl lg:absolute lg:left-[10%] lg:top-[43%] lg:mt-0 lg:-translate-y-1/2 lg:text-[clamp(3.1rem,3.5vw,4.2rem)]">
          Learning is better together.
        </h1>
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
