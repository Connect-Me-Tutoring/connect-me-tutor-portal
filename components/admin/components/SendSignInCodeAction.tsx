"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import toast from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { sendSignInCode } from "@/lib/actions/auth/send-sign-in-code";
import type { Profile } from "@/types";

export default function SendSignInCodeAction({
  profile,
}: {
  profile: Pick<Profile, "id" | "firstName">;
}) {
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    setIsSending(true);
    try {
      const result = await sendSignInCode(profile.id);
      if (result.ok) {
        toast.success(`Sign-in code sent to ${result.email}`);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not send a sign-in code. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Send sign-in code" disabled={isSending}>
          <Mail className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send a sign-in code for {profile.firstName}?</AlertDialogTitle>
          <AlertDialogDescription>
            The code goes to the email address on the linked login. The recipient can choose “Login
            with OTP” on the login page, then select “I already have a code.”
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend}>Send code</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
