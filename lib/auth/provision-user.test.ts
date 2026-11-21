import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatedProfileData } from "@/types";

// A fake service-role client: every query builder resolves through `respond`,
// which each test sets up for the table/operation it cares about.
type Call = { table: string; op: string; args: unknown[] };
let respond: (call: Call) => unknown;
const authUsers = new Map<string, string>(); // email -> auth user id
const inviteUserByEmail = vi.fn();
const deleteUser = vi.fn();

function builder(table: string) {
  const call: Call = { table, op: "select", args: [] };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "single", "maybeSingle", "throwOnError"]) {
    b[m] = (...args: unknown[]) => {
      if (m === "select" && call.op === "select") call.args = args;
      return b;
    };
  }
  b.insert = (...args: unknown[]) => {
    call.op = "insert";
    call.args = args;
    return b;
  };
  b.update = (...args: unknown[]) => {
    call.op = "update";
    call.args = args;
    return b;
  };
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(respond(call)).then(resolve, reject);
  return b;
}

const client = {
  from: (table: string) => builder(table),
  rpc: vi.fn(async (_fn: string, { email }: { email: string }) => ({
    data: authUsers.has(email) ? { id: authUsers.get(email) } : null,
    error: null,
  })),
  auth: { admin: { inviteUserByEmail, deleteUser } },
};

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: async () => client }));
vi.mock("@/lib/posthog", () => ({ logError: vi.fn() }));

const { provisionUser, ProvisionUserError } = await import("./provision-user.server");

const student = (email: string): CreatedProfileData =>
  ({
    email,
    role: "Student",
    firstName: "New",
    lastName: "Student",
    status: "Active",
    availability: [],
    subjects_of_interest: [],
    languages_spoken: [],
  }) as unknown as CreatedProfileData;

const insertedProfile = (userId: string) => ({
  id: "new-profile",
  user_id: userId,
  role: "Student",
  email: "x",
  first_name: "New",
  last_name: "Student",
  status: "Active",
});

type Row = { id?: string; role: string; first_name?: string; last_name?: string; status?: string };

describe("provisionUser", () => {
  let profilesByUser: Record<string, Row[]>;
  let inserted: { user_id: string } | null;
  let lastActiveProfileId: string | null;
  let settingsUpdates: unknown[];
  let pairingError: Error | null;

  beforeEach(() => {
    authUsers.clear();
    inviteUserByEmail.mockReset();
    deleteUser.mockReset();
    profilesByUser = {};
    inserted = null;
    lastActiveProfileId = null;
    settingsUpdates = [];
    pairingError = null;
    respond = ({ table, op, args }) => {
      if (table === "user_settings" && op === "update") {
        settingsUpdates.push(args[0]);
        return { data: null, error: null };
      }
      if (table === "user_settings") {
        return {
          data: lastActiveProfileId ? { last_active_profile_id: lastActiveProfileId } : null,
          error: null,
        };
      }
      if (table === "pairing_requests" && pairingError) {
        return { data: null, error: pairingError };
      }
      if (table === "Profiles" && op === "insert") {
        inserted = args[0] as { user_id: string };
        return { data: insertedProfile(inserted.user_id), error: null };
      }
      if (table === "Profiles" && op === "select") {
        // existing-login lookup and the profile count use the same table
        const rows = Object.values(profilesByUser).flat();
        return { data: rows, count: rows.length, error: null };
      }
      return { data: null, error: null }; // pairing_requests
    };
  });

  it("adds the profile to the login that owns the email, without inviting", async () => {
    // A login owns parent@x; its Profiles.email copy says something else.
    authUsers.set("parent@x", "existing-user");
    profilesByUser["existing-user"] = [{ role: "Student" }];

    const result = await provisionUser(student("Parent@X "));

    expect(result.invited).toBe(false);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(inserted?.user_id).toBe("existing-user");
  });

  it("refuses to add a profile to a login that has an Admin profile", async () => {
    authUsers.set("admin@x", "admin-user");
    profilesByUser["admin-user"] = [{ role: "Student" }, { role: "Admin" }];

    await expect(provisionUser(student("admin@x"))).rejects.toThrow("Multiple profiles prohibited");
    expect(inserted).toBeNull();
  });

  it("invites a new login when no auth user has the email", async () => {
    inviteUserByEmail.mockImplementation(async (email: string) => {
      authUsers.set(email, "invited-user");
      return { data: { user: { id: "invited-user" } }, error: null };
    });

    const result = await provisionUser(student("new@x"));

    expect(result.invited).toBe(true);
    expect(inviteUserByEmail).toHaveBeenCalledWith("new@x", expect.anything());
    expect(inserted?.user_id).toBe("invited-user");
  });

  it("cleans up a half-created invite only when it has no profiles", async () => {
    const failure = new Error("Error sending invite email");
    inviteUserByEmail.mockImplementation(async (email: string) => {
      authUsers.set(email, "half-created");
      return { data: { user: null }, error: failure };
    });

    await expect(provisionUser(student("new@x"))).rejects.toThrow(failure.message);
    expect(deleteUser).toHaveBeenCalledWith("half-created");
  });

  it("keeps a login that gained profiles if the invite then fails", async () => {
    inviteUserByEmail.mockImplementation(async (email: string) => {
      authUsers.set(email, "raced-user");
      profilesByUser["raced-user"] = [{ role: "Student" }];
      return { data: { user: null }, error: new Error("User already registered") };
    });

    await expect(provisionUser(student("new@x"))).rejects.toThrow("already registered");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  describe("re-adding someone whose email already has a login", () => {
    beforeEach(() => authUsers.set("parent@x", "existing-user"));

    it("refuses the same person with the same role instead of adding a duplicate", async () => {
      profilesByUser["existing-user"] = [
        { id: "old", role: "Student", first_name: " new ", last_name: "STUDENT", status: "Active" },
      ];

      await expect(provisionUser(student("parent@x"))).rejects.toThrow(
        "already has a student profile",
      );
      expect(inserted).toBeNull();
      expect(inviteUserByEmail).not.toHaveBeenCalled();
    });

    it("points the admin at reactivation when that profile is inactive", async () => {
      profilesByUser["existing-user"] = [
        { id: "old", role: "Student", first_name: "New", last_name: "Student", status: "Inactive" },
      ];

      const attempt = provisionUser(student("parent@x"));
      await expect(attempt).rejects.toBeInstanceOf(ProvisionUserError);
      await expect(attempt).rejects.toThrow("Reactivate that profile");
      expect(inserted).toBeNull();
    });

    it("still adds a sibling who shares the login", async () => {
      profilesByUser["existing-user"] = [
        { id: "sib", role: "Student", first_name: "Older", last_name: "Student", status: "Active" },
      ];
      lastActiveProfileId = "sib";

      const result = await provisionUser(student("parent@x"));

      expect(inserted?.user_id).toBe("existing-user");
      expect(result.invited).toBe(false);
      expect(settingsUpdates).toEqual([]); // the sibling's active profile stays the default
    });

    it("opens the new profile when the login's last active profile is inactive", async () => {
      profilesByUser["existing-user"] = [
        { id: "old", role: "Student", first_name: "Old", last_name: "Profile", status: "Inactive" },
      ];
      lastActiveProfileId = "old";

      const result = await provisionUser({ ...student("parent@x"), role: "Tutor" });

      expect(settingsUpdates).toEqual([{ last_active_profile_id: "new-profile" }]);
      expect(result.warning).toBeUndefined();
    });
  });

  it("reports a pairing queue failure as a warning, not a failed add", async () => {
    inviteUserByEmail.mockImplementation(async (email: string) => {
      authUsers.set(email, "invited-user");
      return { data: { user: { id: "invited-user" } }, error: null };
    });
    pairingError = new Error("queue unavailable");

    const result = await provisionUser(student("new@x"));

    expect(result.profile.id).toBe("new-profile");
    expect(result.warning).toMatch(/pairing queue/);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
