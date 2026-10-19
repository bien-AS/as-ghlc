// @vitest-environment node
import { expect, test, vi } from "vitest";

import { seedAdmins } from "./seed-admins";

/** A stand-in for supabase.auth.admin and the profiles table; nothing real is touched. */
function fakes(existing: Record<string, string> = {}) {
  const users = new Map(Object.entries(existing));
  const profiles = new Map<string, unknown[]>();
  const auth = {
    listUsers: vi.fn(async () => ({
      data: {
        users: [...users].map(([email, id]) => ({ id, email })),
      },
      error: null,
    })),
    createUser: vi.fn(async ({ email }: { email: string }) => {
      const id = `auth-${email.split("@")[0]}`;
      users.set(email, id);
      return { data: { user: { id } }, error: null };
    }),
  };
  const query = vi.fn(async (_text: string, values: unknown[]) => {
    profiles.set(values[0] as string, values);
  });
  return { auth, query, profiles };
}

test("creates confirmed auth users and admin profiles with the same id", async () => {
  const { auth, query, profiles } = fakes();
  await seedAdmins(
    " Zachery.Ross@authoritysolutions.com, mitchell@authoritysolutions.com ",
    { auth, query },
  );
  expect(auth.createUser).toHaveBeenCalledWith({
    email: "zachery.ross@authoritysolutions.com",
    email_confirm: true,
  });
  expect(profiles.get("auth-zachery.ross")).toEqual([
    "auth-zachery.ross",
    "zachery.ross@authoritysolutions.com",
    "Zachery",
    "Ross",
  ]);
  expect(profiles.get("auth-mitchell")).toEqual([
    "auth-mitchell",
    "mitchell@authoritysolutions.com",
    "Mitchell",
    "",
  ]);
  expect(query.mock.calls[0][0]).toMatch(/on conflict \(id\) do update/);
});

test("run again, it reuses the existing auth user instead of creating another", async () => {
  const { auth, query } = fakes({ "bien@authoritysolutions.com": "auth-bien" });
  await seedAdmins("bien@authoritysolutions.com", { auth, query });
  expect(auth.createUser).not.toHaveBeenCalled();
  expect(query.mock.calls[0][1][0]).toBe("auth-bien");
});

test.each([
  ["nothing", undefined],
  ["an empty list", " , "],
  ["a non-company address", "zach@gmail.com"],
  ["a malformed address", "not-an-email"],
])("refuses %s before touching anything", async (_name, raw) => {
  const { auth, query } = fakes();
  await expect(seedAdmins(raw, { auth, query })).rejects.toThrow();
  expect(auth.listUsers).not.toHaveBeenCalled();
  expect(query).not.toHaveBeenCalled();
});
