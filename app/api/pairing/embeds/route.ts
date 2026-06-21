import { createSubjectEmbeddings } from "@/lib/pairing/embeddings";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";
import { NextRequest, NextResponse } from "next/server";

//used to create subject embeddings
export async function POST(request: NextRequest) {
  try {
    await verifyAdmin();
    const { subjects } = await request.json();
    if (!subjects)
      return NextResponse.json(
        { error: "must provide subjects" },
        { status: 403 }
      );
    const embed = await createSubjectEmbeddings(subjects as string[]);

    return NextResponse.json({ embed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
