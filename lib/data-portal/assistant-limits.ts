import "server-only";
import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";

/**
 * How much the Data Portal assistant may be asked, and what one question may
 * send up.
 *
 * Two halves. The per-question half lives here and in the agent's default
 * options: how much history goes up, how many tokens come back, how many tool
 * steps it may take. The how-many-questions half lives in the database, in
 * public.data_portal_assistant_claim(), because Vercel runs many instances and
 * a count kept in one of them says nothing about the others.
 *
 * Together they put a ceiling on the bill. A question costs at most about 50
 * cents at these caps, and usually a few, and the database lets through at
 * most 100 a day and 500 a month across every admin.
 */

/** Characters of conversation sent with a question, newest first. */
export const HISTORY_CHAR_BUDGET = 16_000;

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Keeps the newest messages that fit the budget and drops the rest.
 *
 * The latest message is always kept: it is the question. The kept run always
 * starts with a question too, since an answer with nothing before it reads to
 * the model as something it said unprompted.
 */
export function fitHistory<T extends ChatMessage>(
  messages: T[],
  budget = HISTORY_CHAR_BUDGET,
): T[] {
  if (messages.length === 0) return [];

  let start = messages.length - 1;
  let used = messages[start].content.length;

  while (start > 0 && used + messages[start - 1].content.length <= budget) {
    start -= 1;
    used += messages[start].content.length;
  }

  while (start < messages.length - 1 && messages[start].role !== "user") start += 1;

  return messages.slice(start);
}

const ClaimSchema = z.object({
  allowed: z.boolean(),
  limit: z.enum(["admin_burst", "admin_daily", "global_daily", "global_monthly"]).nullable(),
  retryAfterSeconds: z.number().int().nonnegative(),
});

export type AssistantLimit = NonNullable<z.infer<typeof ClaimSchema>["limit"]>;

export type AssistantClaim =
  | { ok: true }
  | { ok: false; reason: "limited"; limit: AssistantLimit; retryAfterSeconds: number }
  | { ok: false; reason: "denied" }
  | { ok: false; reason: "unavailable" };

const LIMIT_MESSAGES: Record<AssistantLimit, string> = {
  admin_burst: "That is a lot of questions at once. Try again in a few minutes.",
  admin_daily: "You have reached the daily limit on questions. It frees up over the next day.",
  global_daily: "The assistant has reached its daily limit across all admins. Try again tomorrow.",
  global_monthly:
    "The assistant has reached its monthly limit across all admins. It frees up as older questions age out.",
};

export function limitMessage(limit: AssistantLimit): string {
  return LIMIT_MESSAGES[limit];
}

/**
 * Asks the database to count one more question, before the model is called.
 *
 * Fails closed. If the count cannot be taken, because the migration has not
 * been applied or the database is unreachable, the question is refused rather
 * than let through uncounted.
 */
export async function claimAssistantQuestion(): Promise<AssistantClaim> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("data_portal_assistant_claim");

  if (error) {
    if (error.message.includes("Admin access required")) return { ok: false, reason: "denied" };
    console.error("[data-portal] Assistant claim failed.", { message: error.message });
    return { ok: false, reason: "unavailable" };
  }

  const claim = ClaimSchema.safeParse(data);
  if (!claim.success) {
    console.error("[data-portal] Assistant claim returned an unexpected payload.");
    return { ok: false, reason: "unavailable" };
  }

  if (claim.data.allowed) return { ok: true };
  if (!claim.data.limit) return { ok: false, reason: "unavailable" };

  return {
    ok: false,
    reason: "limited",
    limit: claim.data.limit,
    retryAfterSeconds: claim.data.retryAfterSeconds,
  };
}
