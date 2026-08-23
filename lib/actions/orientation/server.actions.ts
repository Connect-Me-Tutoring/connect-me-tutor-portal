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
  if (process.env.TUTOR_ORIENTATION_ENABLED !== "true") {
    throw new Error("Tutor orientation is not enabled.");
  }

  const { profile } = await requireAuthenticatedProfile();
  if (profile.role !== "Tutor") {
    throw new Error("Only tutors can complete the orientation quiz.");
  }

  const supabase = await createClient();

  const tutorName = `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "A tutor";

  // Mark orientation as completed in Supabase Profiles table
  const { error: updateError } = await supabase
    .from(Table.Profiles)
    .update({
      orientation_completed_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Failed to update profile orientation status:", updateError);
    throw new Error("Unable to save orientation completion.");
  }

  const questionsText = payload.questionsText?.trim().slice(0, 4000);
  if (questionsText) {
    await sendDiscordWebhook(tutorName, questionsText, payload);
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
