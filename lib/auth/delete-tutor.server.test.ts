import { beforeEach, describe, expect, it, vi } from "vitest";
const { requireAdmin, rpc, createClient, createAdminClient, deleteAuth, logError, query } =
  vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    rpc: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    deleteAuth: vi.fn(),
    logError: vi.fn(),
    query: { from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), update: vi.fn() },
  }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/actions/auth/authz.server", () => ({ requireAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient, createAdminClient }));
vi.mock("@/lib/posthog", () => ({ logError }));
const { deleteOnboardingTutor } = await import("./delete-tutor.server");
const profileId = "20000000-0000-4000-8000-000000000002";
const input = {
  email: "new@example.com",
  reason: "First portal access failure after all standard recovery attempts.",
  recoveryAttempted: true as const,
  firstAccessFailure: true as const,
};
const attempt = {
  id: "audit-id",
  auth_user_id: "auth-id",
  email: input.email,
  status: "pending",
  failure: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ user: { id: "admin-id" } });
  rpc.mockResolvedValue({ data: attempt, error: null });
  createClient.mockResolvedValue({ rpc });
  for (const name of ["from", "select", "eq", "update"] as const)
    query[name].mockReturnValue(query);
  query.single.mockResolvedValue({ data: { status: "succeeded" }, error: null });
  createAdminClient.mockResolvedValue({
    auth: { admin: { deleteUser: deleteAuth } },
    from: query.from,
  });
  deleteAuth.mockResolvedValue({ error: null });
});
describe("guarded deleteUser orchestration", () => {
  it("requires admin before creating any clients", async () => {
    requireAdmin.mockRejectedValue(new Error("Forbidden"));
    await expect(deleteOnboardingTutor(profileId, input)).rejects.toThrow("Forbidden");
    expect(createClient).not.toHaveBeenCalled();
    expect(deleteAuth).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, recoveryAttempted: false },
    { ...input, firstAccessFailure: false },
    { ...input, reason: "short" },
    { ...input, email: "invalid" },
    undefined,
  ])("rejects malformed direct calls %j", async (confirmation) => {
    await expect(deleteOnboardingTutor(profileId, confirmation as typeof input)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteAuth).not.toHaveBeenCalled();
  });
  it("uses the authenticated RPC and deletes only its validated auth account", async () => {
    expect(await deleteOnboardingTutor(profileId, input)).toEqual({
      success: true,
      email: input.email,
    });
    expect(rpc).toHaveBeenCalledWith("prepare_tutor_onboarding_deletion", {
      p_profile_id: profileId,
      p_email: input.email,
      p_reason: input.reason,
      p_recovery_attempted: true,
      p_first_access_failure: true,
    });
    expect(deleteAuth).toHaveBeenCalledWith("auth-id");
    expect(query.from).toHaveBeenCalledWith("tutor_deletion_audit");
  });
  it("never starts deletion when eligibility validation or audit creation fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("Audit unavailable") });
    await expect(deleteOnboardingTutor(profileId, input)).rejects.toThrow(
      "No deletion was started",
    );
    expect(deleteAuth).not.toHaveBeenCalled();
  });
  it("returns protected-history reasons without starting deletion", async () => {
    rpc.mockResolvedValue({
      data: { ...attempt, status: "blocked", failure: "Protected sessions" },
      error: null,
    });
    expect(await deleteOnboardingTutor(profileId, input)).toEqual({
      success: false,
      message: "Protected sessions",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
  it("reconciles a lost response against the committed audit", async () => {
    deleteAuth.mockRejectedValue(new Error("Network response lost"));
    expect(await deleteOnboardingTutor(profileId, input)).toMatchObject({ success: true });
    expect(query.update).not.toHaveBeenCalled();
  });
  it("records deletion failures without ever deleting a profile separately", async () => {
    deleteAuth.mockResolvedValue({ error: new Error("Database guard rejected deletion") });
    query.single
      .mockResolvedValueOnce({ data: { status: "pending" }, error: null })
      .mockResolvedValueOnce({ data: { status: "failed" }, error: null });
    const result = await deleteOnboardingTutor(profileId, input);
    expect(result.success).toBe(false);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(query.eq).toHaveBeenCalledWith("status", "pending");
    expect(logError).toHaveBeenCalled();
  });
  it("reconciles success committed while the failure update was waiting", async () => {
    deleteAuth.mockRejectedValue(new Error("Timed out"));
    query.single
      .mockResolvedValueOnce({ data: { status: "pending" }, error: null })
      .mockResolvedValueOnce({ data: { status: "succeeded" }, error: null });
    expect(await deleteOnboardingTutor(profileId, input)).toMatchObject({ success: true });
  });
  it("does not claim success or failure when the audit cannot be read", async () => {
    query.single.mockResolvedValue({ data: null, error: new Error("Unavailable") });
    expect(await deleteOnboardingTutor(profileId, input)).toMatchObject({
      success: false,
      message: expect.stringContaining("could not be verified"),
    });
    expect(query.update).not.toHaveBeenCalled();
  });
});
