import { NextResponse } from "next/server";
import { mastra } from "@/lib/mastra";

export async function POST(req: Request) {
  try {
    const { messages, documents } = await req.json();
    const lastMessage = messages?.at(-1)?.content;

    if (!lastMessage) {
      return NextResponse.json({ error: "No message content provided" }, { status: 400 });
    }

    const agent = mastra.getAgent("Tutor Assistant");

    if (!agent) {
      return NextResponse.json({ error: "Tutor Assistant agent not found" }, { status: 500 });
    }

    const systemMessage = {
      role: "system",
      content: `Use the following documents as your source material. Always answer using only the provided documents when the user asks about them. If the answer cannot be found in the documents, say that you could not find the information and do not invent details.\n\n${(
        documents || []
      )
        .map(
          (doc: { name: string; content: string }, index: number) =>
            `DOCUMENT ${index + 1}: ${doc.name}\n${doc.content}`,
        )
        .join("\n\n")}`,
    };

    const allMessages = [systemMessage, ...(messages || [])];

    const streamResult = await agent.stream(allMessages);

    return new Response(streamResult.textStream as unknown as BodyInit, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
