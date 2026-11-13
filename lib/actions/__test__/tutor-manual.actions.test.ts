import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  DEFAULT_TUTOR_MANUAL_SECTIONS,
  tutorManualSchema,
  tutorManualSectionIds,
} from "@/constants/tutor-manual";

/** Thenable PostgREST builder: records chained calls and resolves to `result`. */
let result: { data: unknown; error: unknown } = { data: null, error: null };
const chain: Array<[string, unknown[]]> = [];
const mockFrom = vi.fn((table: string) => {
  chain.push(["from", [table]]);
  const builder: Record<string, any> = new Proxy(
    {},
    {
      get(_, method: string) {
        if (method === "then") {
          return (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
        }
        return (...args: unknown[]) => {
          chain.push([method, args]);
          return builder;
        };
      },
    },
  );
  return builder;
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));
vi.mock("@/lib/posthog", () => ({ logError: vi.fn().mockResolvedValue(undefined) }));

const mockRequireAuthenticatedProfile = vi.fn();
const mockRequireAdmin = vi.fn();
vi.mock("@/lib/actions/auth/authz.server", () => ({
  requireAuthenticatedProfile: () => mockRequireAuthenticatedProfile(),
  requireAdmin: () => mockRequireAdmin(),
}));

const { getTutorManual, saveTutorManual } = await import("../tutor-manual/server.actions");
const { revalidatePath } = await import("next/cache");

const asRole = (role: string) =>
  mockRequireAuthenticatedProfile.mockResolvedValue({
    user: { id: "u1" },
    profile: { id: "p1", role, firstName: "Ada", lastName: "Admin" },
  });

const sections = [{ title: "Hello", body: "**Welcome**" }];

beforeEach(() => {
  vi.clearAllMocks();
  chain.length = 0;
  result = { data: null, error: null };
});

describe("getTutorManual", () => {
  it("refuses students", async () => {
    asRole("Student");

    await expect(getTutorManual()).rejects.toThrow(/tutors and admins/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the newest saved version to tutors", async () => {
    asRole("Tutor");
    result = {
      data: {
        sections,
        created_at: "2026-11-02T15:00:00.000Z",
        editor: { first_name: "Ada", last_name: "Admin" },
      },
      error: null,
    };

    await expect(getTutorManual()).resolves.toEqual({
      sections,
      updatedAt: "2026-11-02T15:00:00.000Z",
      updatedByName: "Ada Admin",
    });
    expect(chain).toEqual(
      expect.arrayContaining([
        ["from", ["tutor_manual_versions"]],
        ["order", ["created_at", { ascending: false }]],
        ["limit", [1]],
      ]),
    );
  });

  it("falls back to the built-in manual before the first save", async () => {
    asRole("Tutor");

    const manual = await getTutorManual();

    expect(manual.sections).toBe(DEFAULT_TUTOR_MANUAL_SECTIONS);
    expect(manual.updatedAt).toBeNull();
  });

  it("falls back to the built-in manual when the read fails or the row is malformed", async () => {
    asRole("Tutor");
    result = { data: null, error: { message: "relation does not exist" } };
    expect((await getTutorManual()).sections).toBe(DEFAULT_TUTOR_MANUAL_SECTIONS);

    result = { data: { sections: "nope", created_at: "x", editor: null }, error: null };
    expect((await getTutorManual()).sections).toBe(DEFAULT_TUTOR_MANUAL_SECTIONS);
  });
});

describe("saveTutorManual", () => {
  it("only lets admins save", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));

    await expect(saveTutorManual(sections)).rejects.toThrow("Admin access required");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("inserts a new version stamped with the admin and refreshes the page", async () => {
    mockRequireAdmin.mockResolvedValue({
      user: { id: "u1" },
      profile: { id: "admin-1", role: "Admin", firstName: "Ada", lastName: "Admin" },
    });
    result = { data: { created_at: "2026-11-02T16:00:00.000Z" }, error: null };

    await expect(saveTutorManual(sections)).resolves.toEqual({
      sections,
      updatedAt: "2026-11-02T16:00:00.000Z",
      updatedByName: "Ada Admin",
    });
    expect(chain).toEqual(
      expect.arrayContaining([["insert", [{ sections, created_by: "admin-1" }]]]),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/manual");
  });

  it("rejects an empty manual or an untitled section without writing", async () => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "u1" }, profile: { id: "admin-1" } });

    await expect(saveTutorManual([])).rejects.toThrow();
    await expect(saveTutorManual([{ title: "  ", body: "x" }])).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("tutor manual content", () => {
  it("ships a default manual that passes its own validation", () => {
    expect(tutorManualSchema.safeParse({ sections: DEFAULT_TUTOR_MANUAL_SECTIONS }).success).toBe(
      true,
    );
  });

  it("gives every section a unique anchor id, even with repeated titles", () => {
    expect(
      tutorManualSectionIds([{ title: "Getting help!" }, { title: "Getting Help" }, { title: "" }]),
    ).toEqual(["getting-help", "getting-help-2", "section"]);
  });
});
