import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdmin, createClient, createAdminClient, logError, chain } = vi.hoisted(() => {
  const chain = {
    from: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  return {
    chain,
    requireAdmin: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    logError: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ logError }));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));
vi.mock("../auth/authz.server", () => ({
  requireAdmin,
  requireAuthenticatedProfile: vi.fn(),
  requireSelfOrAdmin: vi.fn(),
  requireTutorProfileAccess: vi.fn(),
  assertProfileBelongsToUser: vi.fn(),
}));

const { setProfileStatus, deactivateProfile, reactivateProfile } = await import("./server.actions");

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  role: "Tutor",
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  status: "Inactive",
};

describe("setProfileStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of ["from", "update", "eq", "select"] as const) {
      chain[fn].mockReturnValue(chain);
    }
    chain.single.mockResolvedValue({ data: row, error: null });
    createClient.mockResolvedValue(chain);
    requireAdmin.mockResolvedValue({ user: {}, profile: { role: "Admin" } });
  });

  it("refuses non-admins before touching the database", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(deactivateProfile(row.id)).rejects.toThrow("Forbidden");
    expect(createClient).not.toHaveBeenCalled();
    expect(chain.update).not.toHaveBeenCalled();
  });

  it("uses the cookie-bound client, never the service-role client", async () => {
    // guard_profile_columns only lets status change when private.is_admin() is
    // true, which needs auth.uid(). The service-role client has none.
    await deactivateProfile(row.id);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("deactivate writes only status=Inactive, scoped to the one profile", async () => {
    await deactivateProfile(row.id);
    expect(chain.update).toHaveBeenCalledWith({ status: "Inactive" });
    expect(chain.eq).toHaveBeenCalledWith("id", row.id);
  });

  it("reactivate writes only status=Active", async () => {
    chain.single.mockResolvedValue({ data: { ...row, status: "Active" }, error: null });
    const result = await reactivateProfile(row.id);
    expect(chain.update).toHaveBeenCalledWith({ status: "Active" });
    expect(result.status).toBe("Active");
  });

  it("logs and throws a generic error on DB failure", async () => {
    chain.single.mockResolvedValue({
      data: null,
      error: { message: "Not allowed to modify privileged Profiles columns" },
    });
    await expect(setProfileStatus(row.id, "Inactive")).rejects.toThrow(
      "Unable to set profile status to Inactive",
    );
    expect(logError).toHaveBeenCalledWith(
      expect.anything(),
      { action: "setProfileStatus", profileId: row.id, status: "Inactive" },
      "profile_error",
    );
  });
});
