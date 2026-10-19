import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { vi } from "vitest";

import type { CurrentUser } from "@/lib/auth/schemas";
import { SAMPLE_REPS } from "@/lib/data/fixtures/leads";

/*
 * Stand-ins for the two server boundaries: Supabase Auth (stubbed at its
 * client) and the database. Test files wire them in with
 *   vi.mock("@/lib/supabase/server", async () => (await import("@/test/server-fakes")).supabaseServerModule);
 *   vi.mock("@/db/client", async () => (await import("@/test/server-fakes")).dbModule);
 */

type Claims = Record<string, unknown> | null;

/**
 * A profiles row as the tests need it. Unset, `active` is true and `role` is
 * admin, so a test that does not care about roles sees everything.
 */
type FakeProfile = CurrentUser & {
  role?: "admin" | "rep";
  active?: boolean;
  firstRun?: boolean;
};

export const fake = {
  claims: null as Claims,
  users: new Map<string, FakeProfile>(),
  /** The request's cookies, as `cookies()` from next/headers reads and writes them. */
  cookies: new Map<string, string>(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
};

export function resetFakes() {
  fake.claims = null;
  fake.users.clear();
  fake.cookies.clear();
  fake.exchangeCodeForSession
    .mockReset()
    .mockResolvedValue({ data: {}, error: null });
  fake.signOut.mockReset().mockResolvedValue({ error: null });
}

/** A verified session, as the token claims. */
export function signIn(claims: Record<string, unknown> = {}) {
  fake.claims = {
    sub: "auth-user-1",
    email: "ada@example.com",
    ...claims,
  };
}

/** The rep the role tests sign in as: the first sample rep, who owns sample leads. */
export const SAMPLE_REP = {
  id: SAMPLE_REPS[0].id,
  email: "maya@example.com",
  firstName: "Maya",
  lastName: "Okafor",
};

/**
 * Signs in with a role (`profiles.role`, spec 01). "staff", the screens' name
 * for a rep, is the first sample rep; "admin" and "owner" are the default
 * signed-in person, whose profile is an admin.
 */
export function viewAs(role: "owner" | "admin" | "staff") {
  if (role !== "staff") return signIn();
  fake.users.set(SAMPLE_REP.id, { ...SAMPLE_REP, role: "rep" });
  signIn({ sub: SAMPLE_REP.id, email: SAMPLE_REP.email });
}

export const supabaseServerModule = {
  createClient: async () => ({
    auth: {
      getClaims: async () =>
        fake.claims
          ? { data: { claims: fake.claims }, error: null }
          : { data: null, error: null },
      exchangeCodeForSession: fake.exchangeCodeForSession,
      signOut: fake.signOut,
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
 * a read by id and a name update, each by `eq(profiles.id, …)`.
 */
export const dbModule = {
  db: {
    query: {
      profiles: {
        findFirst: async ({ where }: { where: SQL }) => {
          const user = fake.users.get(idIn(where));
          return user && { role: "admin", active: true, ...user };
        },
      },
    },
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
