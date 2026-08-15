"use server";

import { requireAuthenticatedProfile } from "@/lib/actions/auth/authz.server";

import { createClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";

interface SubmitQuizPayload {
  totalQuestions: number;
  totalAttempts: number;
  retries: number;
  questionsText?: string | null;
}

/**
 * Persists a quiz completion and sends the tutor's questions
 * to a Discord channel via webhook.
 */
export async function submitQuizCompletion(payload: SubmitQuizPayload) {
  const { profile } = await requireAuthenticatedProfile();
  const supabase = await createClient();

  const tutorName =
    `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "A tutor";

  // Mark orientation as completed in Supabase Profiles table
  const { error: updateError } = await supabase
    .from(Table.Profiles)
    .update({
      orientation_completed_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Failed to update profile orientation status:", updateError);
  }

  const hasQuestions =
    payload.questionsText && payload.questionsText.trim().length > 0;

  if (hasQuestions) {
    await sendDiscordWebhook(
      tutorName,
      payload.questionsText!.trim(),
      payload,
    );
  }

  console.log(
    `[Orientation Quiz] ${tutorName} completed quiz — ${payload.totalQuestions} questions, ${payload.retries} retries${hasQuestions ? ", submitted a question" : ""}`,
  );

  return { success: true };
}

async function sendDiscordWebhook(
  tutorName: string,
  question: string,
  stats: SubmitQuizPayload,
) {
  const webhookUrl = process.env.ORIENTATION_QUESTION_WEBHOOK;
  if (!webhookUrl) {
    console.warn(
      "ORIENTATION_QUESTION_WEBHOOK not set — skipping Discord notification",
    );
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
