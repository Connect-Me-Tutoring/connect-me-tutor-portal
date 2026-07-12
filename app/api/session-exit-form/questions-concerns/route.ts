import { readSpreadsheet, writeSpreadSheet } from "@/lib/google-sheet";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface FormData {
  tutorFirstName?: string;
  tutorLastName?: string;
  studentFirstName?: string;
  studentLastName?: string;
  formContent: string;
  tutorEmail?: string;
  studentEmail?: string;
  category?: string;
}

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
    const formData = await request.json();
const categoryMapping:Record<string, string>={
    attendance: "Attendance & Engagement",
    technical: "Technical and Portal Issues",
    behavior: "Student Behavior and Support",
    urgent: "Urgent Escalation",
  };

  if(formData.category){
    formData.category = categoryMapping[formData.category] || "General";
  }

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
