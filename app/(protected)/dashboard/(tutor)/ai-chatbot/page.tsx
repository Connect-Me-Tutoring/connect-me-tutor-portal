"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Plus, User, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; id: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendToBackend = async (text: string) => {
    try {
      const res = await fetch("/api/ai-chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const responseText = await res.text();
      return responseText;
    } catch (err: any) {
      console.error("chat error", err);
      return `Error: ${err.message}`;
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userId = Date.now().toString();

    setMessages((m) => [
      ...m,
      {
        role: "user",
        content: trimmed,
        id: userId,
      },
    ]);

    setInput("");
    setIsLoading(true);

    const aiId = `ai-${Date.now()}`;

    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: "",
        id: aiId,
      },
    ]);

    const answer = await sendToBackend(trimmed);

    setMessages((m) =>
      m.map((msg) =>
        msg.id === aiId
          ? {
            ...msg,
            content: answer,
          }
          : msg
      )
    );

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Connect Me Chatbot
            </h2>
            <p className="text-sm text-gray-500">
              Ask questions about tutoring and learning materials.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => {
              setMessages([]);
              setInput("");
            }}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-700">
                How can I help you?
              </h3>

              <p className="text-sm text-gray-500">
                Ask me anything about your tutoring or learning materials.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${m.role === "user"
                  ? "flex-row-reverse"
                  : "flex-row"
                  }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-white ${m.role === "user"
                    ? "bg-blue-600"
                    : "bg-slate-700"
                    }`}
                >
                  {m.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={`${m.role === "user"
                    ? "text-white bg-blue-600"
                    : "bg-slate-50 text-slate-900"
                    } rounded-lg px-4 py-2 max-w-[75%]`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div className="text-sm prose prose-sm prose-slate max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-pre:my-2 prose-headings:my-2 prose-headings:font-semibold prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      isLoading && (
                        <div className="flex items-center gap-1.5 py-1 text-sm text-slate-500 font-medium animate-pulse">
                          <span>Thinking</span>
                          <span className="flex gap-0.5">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </span>
                        </div>
                      )
                    )
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4 flex-shrink-0">
        <form
          onSubmit={handleSendMessage}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Message AI Chatbot..."
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              className="flex-1"
            />

            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              size="icon"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-gray-400">
            AI Chatbot may produce inaccurate information
          </p>
        </form>
      </div>
    </div>
  );
}

export default function AIChatbotPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="p-8 pb-4">
        <h1 className="text-3xl font-bold mb-6">
          AI Chatbot
        </h1>
      </div>

      <div className="flex px-8 pb-32">
        <div className="flex-grow max-h-[65vh]">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}