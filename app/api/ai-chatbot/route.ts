import { NextResponse } from 'next/server';
// import { mastra } from '@/lib/mastra';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const lastMessage = messages?.at(-1)?.content;

    if (!lastMessage) {
      return NextResponse.json(
        { error: 'No message content provided' },
        { status: 400 }
      );
    }

    const response = await fetch('http://localhost:8000/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: lastMessage,
        history: messages.slice(0, -1).map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `FastAPI error: ${errorText}` },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}