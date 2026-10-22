import { beforeEach, describe, expect, it, vi } from "vitest";
const { admin, createAdminClient, tableToInterfaceProfiles, logError } = vi.hoisted(() => ({
  admin: {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    throwOnError: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    inviteUserByEmail: vi.fn(),
    deleteUser: vi.fn(),
    rpc: vi.fn(),
  },
  createAdminClient: vi.fn(),
  tableToInterfaceProfiles: vi.fn(),
  logError: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient }));
vi.mock("@/lib/utils/type-utils", () => ({ tableToInterfaceProfiles }));
vi.mock("@/lib/posthog", () => ({ logError }));
const { provisionUser } = await import("./provision-user.server");
import type { CreatedProfileData } from "@/types";
const input = {
  email: "original@example.com",
  role: "Tutor",
  firstName: "New",
  lastName: "Tutor",
  status: "Active",
} as CreatedProfileData;
beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ["from", "select", "eq", "limit", "order", "insert", "maybeSingle"] as const)
    admin[method].mockReturnValue(admin);
  admin.throwOnError.mockResolvedValue({ data: null, error: null });
  createAdminClient.mockResolvedValue({
    ...admin,
    auth: { admin: { inviteUserByEmail: admin.inviteUserByEmail, deleteUser: admin.deleteUser } },
  });
});
describe("Add Tutor after onboarding recovery", () => {
  it("preserves an existing authentication account when reinvitation fails", async () => {
    admin.inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: new Error("Email already registered"),
    });
    await expect(provisionUser(input)).rejects.toThrow("Email already registered");
    expect(admin.deleteUser).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
    expect(admin.insert).not.toHaveBeenCalled();
  });
  it("reports an invite that returned no account instead of deleting by email", async () => {
    admin.inviteUserByEmail.mockResolvedValue({ data: { user: null }, error: null });
    await expect(provisionUser(input)).rejects.toThrow(
      "Invitation did not return an authentication account",
    );
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });
  it("invites the original email and creates a fresh tutor through the normal workflow", async () => {
    admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-auth-id" } },
      error: null,
    });
    admin.single.mockResolvedValue({ data: { id: "new-profile-id", role: "Tutor" }, error: null });
    tableToInterfaceProfiles.mockReturnValue({
      id: "new-profile-id",
      role: "Tutor",
      email: input.email,
    });
    expect(await provisionUser(input)).toMatchObject({ id: "new-profile-id", email: input.email });
    expect(admin.inviteUserByEmail).toHaveBeenCalledWith(input.email, expect.anything());
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: input.email, role: "Tutor", user_id: "new-auth-id" }),
    );
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });
});
