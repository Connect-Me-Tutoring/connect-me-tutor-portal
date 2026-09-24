"use server";

import { requireAuthenticatedProfile } from "@/lib/actions/auth/authz.server";

import { policyQuizQuestions } from "@/constants/policy-quiz";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";
import { createClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const submitQuizPayloadSchema = z
  .object({
    totalQuestions: z.number().int().positive(),
    totalAttempts: z.number().int().positive().max(10_000),
    retries: z.number().int().nonnegative().max(10_000),
    questionsText: z.string().max(4000).nullish(),
  })
  .refine((payload) => payload.totalQuestions === policyQuizQuestions.length, {
    message: "Quiz question count does not match the current orientation quiz.",
  })
  .refine(
    (payload) =>
      payload.totalAttempts >= payload.totalQuestions &&
      payload.retries === payload.totalAttempts - payload.totalQuestions,
    { message: "Quiz attempt statistics are invalid." },
  );

type SubmitQuizPayload = z.infer<typeof submitQuizPayloadSchema>;

/**
 * Persists a quiz completion and sends the tutor's questions
 * to a Discord channel via webhook.
 */
export async function submitQuizCompletion(payload: SubmitQuizPayload) {
  if (!isTutorOrientationEnabled()) {
    throw new Error("Tutor orientation is not enabled.");
  }

  const parsedPayload = submitQuizPayloadSchema.parse(payload);
  const { profile, user } = await requireAuthenticatedProfile();
  if (profile.role !== "Tutor") {
    throw new Error("Only tutors can complete the orientation quiz.");
  }

  const supabase = await createClient();

  const tutorName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "A tutor";

  if (!profile.orientationCompletedAt) {
    const { data: updatedProfile, error: updateError } = await supabase
      .from(Table.Profiles)
      .update({
        orientation_completed_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error(
        "Failed to update profile orientation status:",
        updateError ?? "No profile row was updated.",
      );
      throw new Error("Unable to save orientation completion.");
    }

    revalidatePath("/dashboard", "layout");
  }

  const questionsText = parsedPayload.questionsText?.trim();
  if (questionsText) {
    await sendDiscordWebhook(tutorName, questionsText, parsedPayload);
  }

  return { success: true };
}

async function sendDiscordWebhook(tutorName: string, question: string, stats: SubmitQuizPayload) {
  const webhookUrl = process.env.ORIENTATION_QUESTION_WEBHOOK;
  if (!webhookUrl) {
    console.warn("ORIENTATION_QUESTION_WEBHOOK not set — skipping Discord notification");
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: null,
        embeds: [
          {
            title: "New Orientation Quiz Question",
            description: question,
            color: 0x3b82f6,
            fields: [
              {
                name: "Tutor",
                value: tutorName,
                inline: true,
              },
              {
                name: "Quiz Stats",
                value: `${stats.totalQuestions} questions, ${stats.retries} retries`,
                inline: true,
              },
              {
                name: "Submitted",
                value: new Date().toLocaleString("en-US", {
                  timeZone: "America/Los_Angeles",
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
                inline: true,
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`Discord webhook returned ${res.status}: ${res.statusText}`);
    }
  } catch (err) {
    console.error("Discord webhook failed:", err);
  }
}
