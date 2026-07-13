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

        <figure className="absolute bottom-[7%] left-[10%] z-10 hidden max-w-[470px] lg:block">
          <blockquote className="text-xl font-semibold leading-[1.38] tracking-[-0.015em]">
            &ldquo;Connect Me makes learning feel simple and less
            stressful.&rdquo;
          </blockquote>
          <figcaption className="mt-2 text-lg font-bold text-[#2f6fed]">
            - Olivia M.
          </figcaption>
        </figure>
      </section>

      <section className="relative flex min-h-[680px] items-center justify-center overflow-hidden px-6 py-14 sm:px-10 lg:min-h-svh lg:px-14 lg:py-16">
        <div
          aria-hidden="true"
          className="absolute right-[15%] top-5 h-20 w-20 rounded-full bg-[#f4f0c9]/75 lg:h-24 lg:w-24"
        />
        <div
          aria-hidden="true"
          className="absolute -right-10 top-[20%] h-24 w-24 rounded-full bg-[#b9dcff]/70 lg:-right-12 lg:h-28 lg:w-28"
        />
        <div
          aria-hidden="true"
          className="absolute -left-5 top-[62%] hidden h-16 w-16 rounded-full bg-[#ccecf4]/80 lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-32 h-[330px] w-[330px] rounded-full bg-[#e9f6fc] lg:-bottom-48 lg:-right-36 lg:h-[390px] lg:w-[390px]"
        />

        <div className="relative z-10 w-full max-w-[540px]">
          <div className="mb-10 space-y-3">
            <h2 className="text-[2.65rem] font-bold leading-none tracking-[-0.035em] sm:text-5xl">
              Welcome back
            </h2>
            <p className="max-w-[520px] text-base leading-7 text-[#5f708d] sm:text-lg">
              Pick up where you left off with your tutor.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
