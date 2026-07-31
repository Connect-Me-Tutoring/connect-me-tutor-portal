"use server";

export type ProcessDMPayload = {
  message: string;
  userId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
};

const WORKER_URL = `${process.env.CHATBOT_URL}/process-dm`;

export async function processDMStream(payload: ProcessDMPayload) {
  // Ensure timeoutMs cannot cause excessively long-lived timers
  const DEFAULT_TIMEOUT_MS = 30_000;
  // const MAX_TIMEOUT_MS = 60_000;
  // let safeTimeout = DEFAULT_TIMEOUT_MS;
  // if (safeTimeout < 0) safeTimeout = 0;
  // if (safeTimeout > MAX_TIMEOUT_MS) safeTimeout = MAX_TIMEOUT_MS;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`processDMStream failed: ${res.status} ${res.statusText} ${text}`);
    }

    if (!res.body) throw new Error("No body stream available on worker response");
    return res.body;
  } finally {
    clearTimeout(id);
  }
}
