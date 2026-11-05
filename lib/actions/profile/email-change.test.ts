import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuthenticatedProfile, createClient, createAdminClient, logError } = vi.hoisted(
  () => ({
    requireAuthenticatedProfile: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    logError: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ logError }));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));
vi.mock("../auth/authz.server", () => ({
  requireAdmin: vi.fn(),
  requireAuthenticatedProfile,
  requireSelfOrAdmin: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
  assertProfileBelongsToUser: vi.fn(),
}));

const { editProfile, requestEmailChange } = await import("./server.actions");

type Result = { data?: unknown; error: unknown };

/** A PostgREST-style builder: every filter returns itself and awaiting it yields `result`. */
function builder(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "update", "eq", "single"]) b[m] = vi.fn(() => b);
  b.throwOnError = vi.fn(() => Promise.resolve(result));
  b.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return b as Record<string, ReturnType<typeof vi.fn>>;
}

const ADMIN_USER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const TUTOR_USER_ID = "aaaaaaaa-0000-0000-0000-000000000002";
const TUTOR_PROFILE_ID = "bbbbbbbb-0000-0000-0000-000000000002";

const tutorProfile = {
  id: TUTOR_PROFILE_ID,
  role: "Tutor",
  firstName: "Tom",
  lastName: "Tutor",
  email: "new@example.com",
} as never;

let cookieBuilders: ReturnType<typeof builder>[];
let cookieClient: {
  from: ReturnType<typeof vi.fn>;
  auth: { updateUser: ReturnType<typeof vi.fn> };
};
let adminBuilder: ReturnType<typeof builder>;
let adminClient: {
  from: ReturnType<typeof vi.fn>;
  auth: { admin: { updateUserById: ReturnType<typeof vi.fn> } };
};

beforeEach(() => {
  vi.clearAllMocks();
  // 1st cookie-client query reads the current row, 2nd writes the edit.
  cookieBuilders = [
    builder({ data: { email: "old@example.com", user_id: TUTOR_USER_ID }, error: null }),
    builder({ data: {}, error: null }),
  ];
  let call = 0;
  cookieClient = {
    from: vi.fn(() => cookieBuilders[call++]),
    auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) },
  };
  adminBuilder = builder({ error: null });
  adminClient = {
    from: vi.fn(() => adminBuilder),
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
  };
  createClient.mockResolvedValue(cookieClient);
  createAdminClient.mockResolvedValue(adminClient);
});

const actAs = (role: string, userId: string, profileId: string, email: string) =>
  requireAuthenticatedProfile.mockResolvedValue({
    user: { id: userId, email },
    profile: { id: profileId, role },
  });

describe("editProfile email changes", () => {
  it("admin editing a tutor changes the tutor's login, never the admin's own", async () => {
    actAs("Admin", ADMIN_USER_ID, "admin-profile", "admin@example.com");
    await editProfile(tutorProfile);

    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith(TUTOR_USER_ID, {
      email: "new@example.com",
      email_confirm: true,
    });
    // every profile under that login follows
    expect(adminBuilder.update).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(adminBuilder.eq).toHaveBeenCalledWith("user_id", TUTOR_USER_ID);
    // and the regular edit no longer writes email itself
    expect(cookieBuilders[1].update.mock.calls[0][0]).not.toHaveProperty("email");
  });

  it("does not touch profiles when auth rejects the new address", async () => {
    actAs("Admin", ADMIN_USER_ID, "admin-profile", "admin@example.com");
    adminClient.auth.admin.updateUserById.mockResolvedValue({
      error: { message: "A user with this email address has already been registered" },
    });

    await expect(editProfile(tutorProfile)).rejects.toThrow("Unable to edit User");
    expect(adminClient.from).not.toHaveBeenCalled();
    expect(cookieBuilders[1].update).not.toHaveBeenCalled();
  });

  it("ignores a capitalisation-only change", async () => {
    actAs("Admin", ADMIN_USER_ID, "admin-profile", "admin@example.com");
    await editProfile({ ...(tutorProfile as object), email: "OLD@example.com" } as never);
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it("refuses a self-service email change through editProfile", async () => {
    actAs("Tutor", TUTOR_USER_ID, TUTOR_PROFILE_ID, "old@example.com");
    await expect(editProfile(tutorProfile)).rejects.toThrow("Unable to edit User");
    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe("requestEmailChange", () => {
  beforeEach(() => actAs("Tutor", TUTOR_USER_ID, TUTOR_PROFILE_ID, "old@example.com"));

  it("asks auth for the change and leaves Profiles alone until it's confirmed", async () => {
    const result = await requestEmailChange("  New@Example.com ");
    expect(result).toEqual({ error: null });
    expect(cookieClient.auth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: expect.stringContaining("/auth/confirm?next=/dashboard/settings") },
    );
    expect(cookieClient.from).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns auth's error so the user can see it", async () => {
    cookieClient.auth.updateUser.mockResolvedValue({
      error: { message: "A user with this email address has already been registered" },
    });
    expect(await requestEmailChange("taken@example.com")).toEqual({
      error: "A user with this email address has already been registered",
    });
    expect(logError).toHaveBeenCalled();
  });

  it("rejects invalid and unchanged addresses without calling auth", async () => {
    expect((await requestEmailChange("not-an-email")).error).toBeTruthy();
    expect((await requestEmailChange("OLD@example.com")).error).toBeTruthy();
    expect(cookieClient.auth.updateUser).not.toHaveBeenCalled();
  });
});
