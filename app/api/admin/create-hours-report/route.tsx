// app/api/generate-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import HoursPDFDocument from "@/components/admin/HoursReport";
import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    await verifyAdmin();

    const data = await request.json();

    const month = data.month;

    const pdfBuffer = await renderToBuffer(<HoursPDFDocument data={data} />);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Connect Me Hours Report.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { message: "Error generating PDF" },
      { status: 500 },
    );
  }
}
