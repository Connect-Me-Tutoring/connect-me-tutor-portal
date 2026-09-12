import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

const query = {
  eq: mocks.eq,
  maybeSingle: mocks.maybeSingle,
  select: mocks.select,
  single: mocks.single,
};

mocks.from.mockReturnValue(query);
mocks.select.mockReturnValue(query);
mocks.eq.mockReturnValue(query);

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

import { getProfileFromUserSettings, getProfileWithProfileId } from "./client.actions";

const databaseProfile = {
  id: "profile-1",
  orientation_completed_at: "2026-08-29T12:00:00.000Z",
  role: "Tutor",
  user_id: "user-1",
};

describe("client profile queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
  });

  it("preserves orientation completion when refreshing the active profile", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { profile: databaseProfile },
      error: null,
    });

    const profile = await getProfileFromUserSettings("user-1");

    expect(mocks.select.mock.calls[0][0]).toContain("orientation_completed_at");
    expect(profile?.orientationCompletedAt).toBe(databaseProfile.orientation_completed_at);
  });

  it("preserves orientation completion after a profile switch", async () => {
    mocks.single.mockResolvedValue({ data: databaseProfile, error: null });

    const profile = await getProfileWithProfileId("profile-1");

    expect(mocks.select.mock.calls[0][0]).toContain("orientation_completed_at");
    expect(profile?.orientationCompletedAt).toBe(databaseProfile.orientation_completed_at);
  });
});
