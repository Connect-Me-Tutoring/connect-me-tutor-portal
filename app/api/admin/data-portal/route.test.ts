import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { resetRateLimits } from "@/lib/data-portal/server/rate-limit";

vi.mock("@/lib/actions/auth/authz.server", () => ({
  requireAdmin: vi.fn(),
}));

const { POST, GET } = await import("./route");

const requireAdminMock = requireAdmin as ReturnType<typeof vi.fn>;

const ORIGIN = "http://localhost:3000";

const validQuestion = {
  messages: [{ role: "user", content: "How many sessions per week?" }],
  sourceIds: [],
  dateRange: "last-90-days",
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/admin/data-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      Host: "localhost:3000",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function asAdmin(id = "admin-1") {
  requireAdminMock.mockResolvedValue({ user: { id }, profile: { role: "Admin" } });
}

/** A well-formed service response, echoing whatever requestId the route sent. */
function stubService(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          requestId: sent.requestId,
          dataMode: "fixtures",
          answer: "Session volume held steady.",
          results: [{ kind: "metric", label: "Sessions", value: 554, unit: "sessions", delta: null }],
          tool: {
            name: "Session volume over time",
            sourceIds: ["Sessions"],
            dateRange: "last-90-days",
            groupCount: 13,
            sourceRowsRead: 554,
          },
          warnings: [],
          limitations: [],
          ...overrides,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetRateLimits();
  process.env.ANALYSIS_SERVICE_TOKEN = `test-token-${"0".repeat(32)}`;
  process.env.ANALYSIS_SERVICE_URL = "http://analysis.test";
});

describe("POST /api/admin/data-portal", () => {
  it("rejects a cross-site request before any session work", async () => {
    const response = await POST(
      post(validQuestion, { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }),
    );

    expect(response.status).toBe(403);
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content type", async () => {
    const response = await POST(
      new Request(`${ORIGIN}/api/admin/data-portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: ORIGIN,
          "Sec-Fetch-Site": "same-origin",
          Host: "localhost:3000",
        },
        body: "question=hi",
      }),
    );

    expect(response.status).toBe(415);
  });

  it("answers 401 when there is no session", async () => {
    const fetchMock = stubService();
    requireAdminMock.mockRejectedValue(new Error("Unauthenticated"));

    const response = await POST(post(validQuestion));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 403 for a signed-in non-admin", async () => {
    const fetchMock = stubService();
    requireAdminMock.mockRejectedValue(new Error("Admin access required"));

    const response = await POST(post(validQuestion));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies an admin question and forwards the server-established principal", async () => {
    const fetchMock = stubService();
    asAdmin("admin-42");

    const response = await POST(post(validQuestion));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.answer).toBe("Session volume held steady.");
    expect(json.dataMode).toBe("fixtures");
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://analysis.test/analyze");
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${process.env.ANALYSIS_SERVICE_TOKEN}`,
    });
    const sent = JSON.parse(String(init?.body));
    // The principal comes from requireAdmin(), never from the request body.
    expect(sent.principal).toEqual({ id: "admin-42", role: "admin" });
  });

  it("rejects an unknown field without forwarding it", async () => {
    const fetchMock = stubService();
    asAdmin();

    const response = await POST(post({ ...validQuestion, role: "system" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards a service response that fails the closed contract", async () => {
    asAdmin();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ requestId: "x", dataMode: "live", answer: "hi", surprise: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const response = await POST(post(validQuestion));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(json)).not.toContain("surprise");
  });

  it("enforces the per-admin rate limit with Retry-After", async () => {
    stubService();
    asAdmin("rate-limited-admin");

    let last: Response | undefined;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      last = await POST(post(validQuestion));
    }

    expect(last?.status).toBe(429);
    expect(last?.headers.get("Retry-After")).toBeTruthy();
  });

  it("refuses non-POST methods", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});
