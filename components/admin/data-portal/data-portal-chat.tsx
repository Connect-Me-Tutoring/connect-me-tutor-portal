"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./data-portal.module.css";

/**
 * Ask a question about the figures above.
 *
 * The answer streams back as plain text. Nothing here posts the numbers: the
 * route reloads them itself, so the only thing travelling up is the question
 * and which range the page is showing.
 */

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Which subjects look worst staffed right now?",
  "Where are we losing students between signing up and a first session?",
  "Has session volume moved over this range, or is it flat?",
];

export function DataPortalChat({ dateRange, ready }: { dateRange: string; ready: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(history);
    setDraft("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/admin/data-portal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, dateRange }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "The answer could not be generated.");
        setPending(false);
        return;
      }

      // Show the answer as it arrives rather than after it finishes.
      setMessages([...history, { role: "assistant", content: "" }]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }

      // A stream that opens and closes with nothing in it is a failure the
      // status code could not tell us about, since the headers were already
      // sent. Do not leave an empty answer sitting there.
      if (answer.trim().length === 0) {
        setMessages(history);
        setError("The answer came back empty. Try asking again.");
      }
    } catch {
      setError("The answer could not be generated.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="dp-chat-heading" className={styles.card}>
      <div className={styles.cardHead}>
        <h2 id="dp-chat-heading" className={styles.cardTitle}>
          Ask about these figures
        </h2>
        <span className={styles.cardMeta}>answers come only from what is shown above</span>
      </div>

      {messages.length === 0 ? (
        <div className={styles.chatSuggestions}>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.chatSuggestion}
              onClick={() => void ask(suggestion)}
              disabled={!ready || pending}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : (
        <ol className={styles.chatLog}>
          {messages.map((message, index) => (
            <li
              key={index}
              className={message.role === "user" ? styles.chatAsked : styles.chatAnswer}
            >
              <span className={styles.chatWho}>{message.role === "user" ? "You" : "Analyst"}</span>
              <div className={styles.chatBody}>
                {message.content || (pending ? "Reading the figures..." : "")}
              </div>
            </li>
          ))}
          <div ref={endRef} />
        </ol>
      )}

      {error ? <p className={styles.chatError}>{error}</p> : null}

      <form
        className={styles.chatForm}
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <textarea
          className={styles.chatInput}
          value={draft}
          rows={2}
          placeholder={ready ? "Ask a question about these figures" : "Waiting for the figures"}
          disabled={!ready || pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, shift+enter keeps writing.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void ask(draft);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 border-black/15 bg-white/60"
          disabled={!ready || pending || draft.trim().length === 0}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CornerDownLeft className="h-4 w-4" />
          )}
          Ask
        </Button>
      </form>
    </section>
  );
}
