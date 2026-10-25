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

const { provisionUser } = await import("./provision-user.server");

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

describe("provisionUser", () => {
  let profilesByUser: Record<string, { role: string }[]>;
  let inserted: { user_id: string } | null;

  beforeEach(() => {
    authUsers.clear();
    inviteUserByEmail.mockReset();
    deleteUser.mockReset();
    profilesByUser = {};
    inserted = null;
    respond = ({ table, op, args }) => {
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

    await provisionUser(student("Parent@X "));

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

    await provisionUser(student("new@x"));

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
});
