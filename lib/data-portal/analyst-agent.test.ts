import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYSES } from "@/lib/analysis/catalog";
import { runAnalysis } from "@/lib/analysis/runner";

vi.mock("@/lib/analysis/runner", () => ({
  runAnalysis: vi.fn(),
}));

const { streamAnswer, CLAUDE_MODEL_ID, PER_QUESTION_LIMITS } = await import("./analyst-agent");

const runAnalysisMock = runAnalysis as ReturnType<typeof vi.fn>;

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; input: object };

/** One streamed Messages API response, in the wire format the SDK parses. */
function sse(blocks: Block[], stopReason: string) {
  const events: object[] = [
    {
      type: "message_start",
      message: {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: CLAUDE_MODEL_ID,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 },
      },
    },
  ];
  blocks.forEach((block, index) => {
    if (block.type === "text") {
      events.push({
        type: "content_block_start",
        index,
        content_block: { type: "text", text: "" },
      });
      events.push({
        type: "content_block_delta",
        index,
        delta: { type: "text_delta", text: block.text },
      });
    } else {
      events.push({
        type: "content_block_start",
        index,
        content_block: { type: "tool_use", id: block.id, name: "run_analysis", input: {} },
      });
      events.push({
        type: "content_block_delta",
        index,
        delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) },
      });
    }
    events.push({ type: "content_block_stop", index });
  });
  events.push({
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 5 },
  });
  events.push({ type: "message_stop" });

  return new Response(
    events
      .map(
        (event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(""),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

const answer = (text: string) => sse([{ type: "text", text }], "end_turn");
const toolCall = (id: string, analysisId: string, stopReason = "tool_use") =>
  sse([{ type: "tool_use", id, input: { analysisId } }], stopReason);

async function readAll(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, call: number) {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

const QUESTION = {
  figures: "<figures></figures>",
  messages: [{ role: "user" as const, content: "How is it going?" }],
};

describe("streamAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATA_PORTAL_ANTHROPIC_API_KEY", "test-data-portal-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls Claude with the data portal key and the per-question caps", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => answer("Hello."));
    vi.stubGlobal("fetch", fetchMock);

    expect(await readAll(streamAnswer(QUESTION))).toBe("Hello.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/messages/);

    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe("test-data-portal-key");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");

    const body = requestBody(fetchMock, 0);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(PER_QUESTION_LIMITS.maxTokensPerCall);
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.fallbacks).toBe("default");
    expect(body.stream).toBe(true);
    expect(body.system[1].text).toContain("<figures></figures>");

    // The model can only name an analysis on the allow list.
    const [tool] = body.tools;
    expect(tool.name).toBe("run_analysis");
    expect(tool.input_schema.properties.analysisId.enum).toEqual(ANALYSES.map((a) => a.id));
  });

  it("refuses to run without the data portal key, whatever else the environment holds", () => {
    vi.stubEnv("DATA_PORTAL_ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "some-other-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => streamAnswer(QUESTION)).toThrow(/DATA_PORTAL_ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs the analysis the model asks for and answers from it", async () => {
    const analysisId = ANALYSES[0].id;
    runAnalysisMock.mockResolvedValue({
      ok: true,
      id: analysisId,
      title: ANALYSES[0].title,
      ranAt: "2026-10-15T00:00:00Z",
      durationMs: 10,
      rowsRead: { sessions: 3 },
      sections: [{ kind: "text", title: "Summary", body: "Three sessions." }],
      limitations: ["A test limitation."],
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => toolCall("toolu_1", analysisId))
      .mockImplementationOnce(async () => answer("It ran."));
    vi.stubGlobal("fetch", fetchMock);

    const text = await readAll(streamAnswer(QUESTION));

    expect(runAnalysisMock).toHaveBeenCalledWith(analysisId);
    expect(text).toContain(`Running "${ANALYSES[0].title}"`);
    expect(text.endsWith("It ran.")).toBe(true);

    const followUp = requestBody(fetchMock, 1);
    const toolResult = followUp.messages
      .flatMap((message: { content: unknown }) =>
        Array.isArray(message.content) ? message.content : [],
      )
      .find((block: { type: string }) => block.type === "tool_result");
    expect(JSON.stringify(toolResult.content)).toContain("Three sessions.");
  });

  it("stops at the call limit and says so", async () => {
    const analysisId = ANALYSES[0].id;
    runAnalysisMock.mockResolvedValue({ ok: false, id: analysisId, error: "Not now." });
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => toolCall(`toolu_${fetchMock.mock.calls.length}`, analysisId));
    vi.stubGlobal("fetch", fetchMock);

    const text = await readAll(streamAnswer(QUESTION));

    expect(fetchMock).toHaveBeenCalledTimes(PER_QUESTION_LIMITS.maxModelCalls);
    expect(text).toContain("more analysis runs than one question allows");
  });

  it("never runs a tool call that was cut off at the token limit", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => toolCall("toolu_1", ANALYSES[0].id, "max_tokens"));
    vi.stubGlobal("fetch", fetchMock);

    const text = await readAll(streamAnswer(QUESTION));

    expect(runAnalysisMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(text).toContain("cut short");
  });

  it("ends with a note when the model declines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => sse([], "refusal")),
    );

    expect(await readAll(streamAnswer(QUESTION))).toContain("could not answer that one");
  });

  it("ends with a note, not a crash, when the key is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              type: "error",
              error: { type: "authentication_error", message: "bad key" },
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    expect(await readAll(streamAnswer(QUESTION))).toContain("not set up correctly");
  });
});
