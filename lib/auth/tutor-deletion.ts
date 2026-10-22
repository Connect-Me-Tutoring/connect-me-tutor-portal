import { z } from "zod";

export const tutorDeletionConfirmationSchema = z.object({
  email: z.string().trim().email(),
  reason: z
    .string()
    .trim()
    .min(20, "Describe the onboarding issue and recovery attempts (at least 20 characters).")
    .max(2000),
  recoveryAttempted: z.literal(true),
  firstAccessFailure: z.literal(true),
});

export type TutorDeletionConfirmation = z.infer<typeof tutorDeletionConfirmationSchema>;
