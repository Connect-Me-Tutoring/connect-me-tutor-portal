import { writeSpreadSheet } from "@/lib/google-sheet";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_LABELS } from "@/constants/sessionExitForm";
import { SessionExitFormCategory, SessionExitFormPayload } from "@/types/sessionExitForm";
import { logEvent, logError } from "@/lib/posthog";
import { requireAuthenticatedUser } from "@/lib/actions/auth/authz.server";

export const dynamic = "force-dynamic";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }
    return typeof value === "string" ? value.trim() : value;
  }, z.string().max(max).optional());

const optionalEmail = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  return typeof value === "string" ? value.trim() : value;
}, z.string().email().max(254).optional());

const formSchema = z
  .object({
    tutorFirstName: optionalText(100),
    tutorLastName: optionalText(100),
    studentFirstName: optionalText(100),
    studentLastName: optionalText(100),
    formContent: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.string().min(1).max(5000),
    ),
    tutorEmail: optionalEmail,
    studentEmail: optionalEmail,
    category: optionalText(100),
  })
  .strict();

export async function GET() {
  try {
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("API route error:", error);
    await logError(error, {}, "sef_error");
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = formSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const formData: SessionExitFormPayload = parsed.data;

  if (formData.category) {
    const label = CATEGORY_LABELS[formData.category as SessionExitFormCategory];

    if (!label) {
      await logEvent("sef_invalid_category", { category: formData.category });
      return NextResponse.json(
        { success: false, error: "A valid category is required." },
        { status: 400 },
      );
    }
    formData.category = label;
  }

  try {
    await writeSpreadSheet(formData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("API route error:", error);
    await logError(error, { category: formData.category }, "sef_error");
    return NextResponse.json(
      {
        success: false,
        error: "Unable to update question or concern",
      },
      { status: 500 },
    );
  }
}
