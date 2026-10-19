import Link from "next/link";
import Logo from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

// Expired or already-used email links (invites included) land here from /auth/confirm.
// Forgot password sends a fresh 6-digit code, which also works for invited users who
// never set a password, then continues to /set-password.
export default function AuthError() {
  return (
    <>
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
                <h1 className="text-2xl text-center font-bold">This link has expired</h1>
                <p className="text-sm text-center text-gray-600">
                  Email links only work for a limited time and can only be used once. If you were
                  invited to Connect Me, or need to reset your password, get a new 6-digit code
                  sent to your email and set your password from there.
                </p>
              </div>
              <Button asChild className="w-full bg-blue-400">
                <Link href="/forgot-password">Get a new code</Link>
              </Button>
              <Link href="/" className="text-sm text-gray-600 hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </section>
    </>
  );
}
