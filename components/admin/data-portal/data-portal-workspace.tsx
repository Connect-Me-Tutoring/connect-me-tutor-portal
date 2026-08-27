"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AnalysisResult, ToolTrace } from "@/lib/data-portal/response-schemas";
import { AnalysisResults } from "./analysis-results";

/**
 * The analysis workspace, lean edition: the working core of the standalone
 * data portal (`dataPortalWebsite`) without its cinematic shell, restyled to
 * portal conventions and driven through /api/admin/data-portal.
 *
 * Conversation state lives in the parent so closing the panel does not erase
 * an analyst's session. Each question is still answered on its own — the
 * transcript is sent because the contract accepts it, but the service reads
 * only the most recent user turn.
 */

const MAX_MESSAGE_CHARS = 4_000;
const MAX_MESSAGES = 40;

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: AnalysisResult[];
  tool?: ToolTrace | null;
  warnings?: string[];
  limitations?: string[];
  dataMode?: "fixtures" | "live";
  isError?: boolean;
};

const DATE_RANGES = [
  { value: "last-30-days", label: "Last 30 days" },
  { value: "last-90-days", label: "Last 90 days" },
  { value: "this-year", label: "This year" },
] as const;

const SUGGESTED_QUESTIONS = [
  "How has session volume moved over time?",
  "Where are students dropping off between signup and a first session?",
  "Which subjects have the most students per tutor?",
  "How is tutor retention trending?",
];

type DataPortalWorkspaceProps = {
  messages: WorkspaceMessage[];
  onMessagesChange: (messages: WorkspaceMessage[]) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
};

export function DataPortalWorkspace({
  messages,
  onMessagesChange,
  dateRange,
  onDateRangeChange,
}: DataPortalWorkspaceProps) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, status]);

  const submit = async (raw?: string) => {
    const question = (raw ?? prompt).trim();
    if (!question || status === "submitting") return;

    const userMessage: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const history = [...messages, userMessage];

    onMessagesChange(history);
    setPrompt("");
    setStatus("submitting");

    const controller = new AbortController();
    abortRef.current = controller;

    const appendAssistant = (message: Omit<WorkspaceMessage, "id" | "role">) => {
      onMessagesChange([
        ...history,
        { id: crypto.randomUUID(), role: "assistant", ...message },
      ]);
    };

    try {
      const response = await fetch("/api/admin/data-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((message) => !message.isError)
            .slice(-MAX_MESSAGES)
            .map(({ role, content }) => ({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })),
          // Empty means "no restriction": every analysis may use what it needs.
          sourceIds: [],
          dateRange,
        }),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof body?.error === "string" ? body.error : "The analysis could not be completed.";
        appendAssistant({ content: message, isError: true });
        return;
      }

      appendAssistant({
        content: body.answer,
        results: body.results,
        tool: body.tool,
        warnings: body.warnings,
        limitations: body.limitations,
        dataMode: body.dataMode,
      });
    } catch {
      if (controller.signal.aborted) return;
      appendAssistant({ content: "The analysis service could not be reached.", isError: true });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center gap-3">
            <p className="text-sm text-muted-foreground">
              Ask an operational question. Questions map to a fixed set of read-only analyses;
              anything outside them is refused rather than guessed at.
            </p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <Button
                  key={question}
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal py-1.5 text-left font-normal"
                  onClick={() => submit(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-blue-500/10 px-3 py-2 text-sm">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    message.isError && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  {message.dataMode === "fixtures" && (
                    <Badge variant="outline" className="mb-2 text-amber-600">
                      Sample data — nothing real was queried
                    </Badge>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                  <AnalysisResults results={message.results ?? []} />

                  {message.warnings && message.warnings.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-amber-700">
                      {message.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}

                  {message.limitations && message.limitations.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {message.limitations.map((limitation, index) => (
                        <li key={index}>{limitation}</li>
                      ))}
                    </ul>
                  )}

                  {message.tool && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {message.tool.name} · {message.tool.sourceRowsRead.toLocaleString()} records
                      read · {message.tool.groupCount.toLocaleString()} groups shown
                    </p>
                  )}
                </div>
              ),
            )}

            {status === "submitting" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Running the analysis…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Ask about sessions, the signup funnel, subjects, or retention…"
            maxLength={MAX_MESSAGE_CHARS}
            rows={2}
            className="min-h-0 resize-none text-sm"
          />
          {status === "submitting" ? (
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={!prompt.trim()} size="icon">
              <SendHorizonal className="h-4 w-4" />
              <span className="sr-only">Ask</span>
            </Button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value} className="text-xs">
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-right text-[11px] text-muted-foreground">
            Each question is answered on its own.
          </p>
        </div>
      </div>
    </div>
  );
}
