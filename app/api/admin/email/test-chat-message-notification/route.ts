import { isAuthorized } from "@/lib/actions/auth.server.actions";
import { sendChatMessageNotificationEmailTest } from "@/lib/actions/email.server.actions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messagePreview: z.string().min(1, "messagePreview is required"),
  to: z.string().email().optional(),
  recipientName: z.string().optional(),
  senderName: z.string().optional(),
  chatRoomUrl: z.string().optional(),
});

/**
 * POST JSON body: { messagePreview, to?, recipientName?, senderName?, chatRoomUrl? }
 * Header: Authorization: Bearer <BEARER_TOKEN>
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = bodySchema.parse(json);

    const result = await sendChatMessageNotificationEmailTest(parsed);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.flatten()
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
