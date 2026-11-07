import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../user/actions", () => ({ cachedGetUser: vi.fn() }));
vi.mock("../../supabase/server", () => ({ createClient: vi.fn() }));

import { cachedGetUser } from "../user/actions";
import { createClient } from "../../supabase/server";
import { requireAdmin } from "./authz.server";

const getUser = cachedGetUser as unknown as ReturnType<typeof vi.fn>;
const makeClient = createClient as unknown as ReturnType<typeof vi.fn>;

// The active profile as the user_settings -> Profiles embed returns it.
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

  it("lets an Active Admin through when the active profile is their own", async () => {
    activeProfileIs(adminProfile("user-1"));
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("refuses when the active profile pointer lands on someone else's Admin profile", async () => {
    activeProfileIs(adminProfile("someone-else"));
    await expect(requireAdmin()).rejects.toThrow("Profile not found");
  });

  it("refuses an Admin profile that is not Active", async () => {
    activeProfileIs(adminProfile("user-1", "Inactive"));
    await expect(requireAdmin()).rejects.toThrow("Admin access required");
  });
});
