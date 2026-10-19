import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { vi } from "vitest";

import type { CurrentUser } from "@/lib/auth/schemas";

/*
 * Stand-ins for the two server boundaries: Supabase Auth (stubbed at its
 * client) and the database. Test files wire them in with
 *   vi.mock("@/lib/supabase/server", async () => (await import("@/test/server-fakes")).supabaseServerModule);
 *   vi.mock("@/db/client", async () => (await import("@/test/server-fakes")).dbModule);
 */

type Claims = Record<string, unknown> | null;

/** A profiles row as the tests need it; unset columns take the table's defaults. */
type FakeProfile = CurrentUser & { active?: boolean };

export const fake = {
  claims: null as Claims,
  users: new Map<string, FakeProfile>(),
  /** The request's cookies, as `cookies()` from next/headers reads and writes them. */
  cookies: new Map<string, string>(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};

export function resetFakes() {
  fake.claims = null;
  fake.users.clear();
  fake.cookies.clear();
  fake.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  fake.exchangeCodeForSession
    .mockReset()
    .mockResolvedValue({ data: {}, error: null });
}

/** A verified session, as the token claims. `amr` says how it was established. */
export function signIn(claims: Record<string, unknown> = {}) {
  fake.claims = {
    sub: "auth-user-1",
    email: "ada@example.com",
    amr: [{ method: "password", timestamp: 1 }],
    user_metadata: {},
    ...claims,
  };
}

export const supabaseServerModule = {
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        fake.claims
          ? { data: { claims: fake.claims }, error: null }
          : { data: null, error: null },
      verifyOtp: fake.verifyOtp,
      exchangeCodeForSession: fake.exchangeCodeForSession,
    },
  }),
};

/** Wired in for every test by src/test/setup.ts. */
export const headersModule = {
  cookies: async () => ({
    get: (name: string) => {
      const value = fake.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      fake.cookies.set(name, value);
    },
    delete: (name: string) => {
      fake.cookies.delete(name);
    },
  }),
};

// Postgres' unique_violation, wrapped the way Drizzle wraps a failed query.
const uniqueViolation = () =>
  Object.assign(new Error("Failed query"), {
    name: "DrizzleQueryError",
    cause: { code: "23505" },
  });

const dialect = new PgDialect();
/** The id an `eq(profiles.id, id)` condition compares with. */
const idIn = (where: SQL) => dialect.sqlToQuery(where).params[0] as string;

const asCurrentUser = ({ id, email, firstName, lastName }: CurrentUser) => ({
  id,
  email,
  firstName,
  lastName,
});

/**
 * The `profiles` table, for exactly the queries src/lib/data/users.ts makes:
 * a read by id, an insert and a name update, each by `eq(profiles.id, …)`.
 */
export const dbModule = {
  db: {
    query: {
      profiles: {
        findFirst: async ({ where }: { where: SQL }) => {
          const user = fake.users.get(idIn(where));
          return user && asCurrentUser(user);
        },
      },
    },
    insert: () => ({
      values: (data: FakeProfile) => ({
        returning: async () => {
          const emailTaken = [...fake.users.values()].some(
            (user) => user.email === data.email,
          );
          if (fake.users.has(data.id) || emailTaken) throw uniqueViolation();
          fake.users.set(data.id, { ...data });
          return [asCurrentUser(data)];
        },
      }),
    }),
    update: () => ({
      set: (data: Partial<CurrentUser>) => ({
        where: (where: SQL) => ({
          returning: async () => {
            const id = idIn(where);
            const user = fake.users.get(id);
            if (!user) return [];
            const updated = { ...user, ...data };
            fake.users.set(id, updated);
            return [asCurrentUser(updated)];
          },
        }),
      }),
    }),
  },
};
