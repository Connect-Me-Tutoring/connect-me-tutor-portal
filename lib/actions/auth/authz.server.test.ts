import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../user/actions", () => ({ cachedGetUser: vi.fn() }));
vi.mock("../../supabase/server", () => ({ createClient: vi.fn() }));

import { cachedGetUser } from "../user/actions";
import { createClient } from "../../supabase/server";
import { requireAdmin } from "./authz.server";

const getUser = cachedGetUser as unknown as ReturnType<typeof vi.fn>;
const makeClient = createClient as unknown as ReturnType<typeof vi.fn>;

function activeProfileIs(profile: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data: { profile }, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  makeClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });
}

const adminProfile = (userId: string, status = "Active") => ({
  id: "profile-admin",
  user_id: userId,
  role: "Admin",
  status,
  first_name: "Ada",
  last_name: "Admin",
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ id: "user-1" });
  });

  it("allows an Active Admin using their own profile", async () => {
    activeProfileIs(adminProfile("user-1"));
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("requires the active profile to belong to the signed-in user", async () => {
    activeProfileIs(adminProfile("someone-else"));
    await expect(requireAdmin()).rejects.toThrow("Profile not found");
  });

  it("requires the Admin profile to be Active", async () => {
    activeProfileIs(adminProfile("user-1", "Inactive"));
    await expect(requireAdmin()).rejects.toThrow("Admin access required");
  });
});
