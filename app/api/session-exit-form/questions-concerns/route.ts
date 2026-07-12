import { readSpreadsheet, writeSpreadSheet } from "@/lib/google-sheet";
import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_LABELS } from "@/constants/sessionExitForm";
import {
  SessionExitFormCategory,
  SessionExitFormPayload,
} from "@/types/sessionExitForm";

export const dynamic = "force-dynamic";

interface ResponseData {
  success: boolean;
  data?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData: SessionExitFormPayload = await request.json();

    const label = formData.category
      ? CATEGORY_LABELS[formData.category as SessionExitFormCategory]
      : undefined;

    if (!label) {
      console.warn(
        `[session-exit-form] Missing or unrecognized category "${formData.category}"`,
      );
      return NextResponse.json(
        { success: false, error: "A valid category is required." },
        { status: 400 },
      );
    }
    formData.category = label;

    const data = await writeSpreadSheet(formData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json({
      success: false,
      error: "Unable to update question or concern",
    });
  }
}
