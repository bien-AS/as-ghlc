/**
 * `pnpm seed:admins` (spec 01 section 5, ADR-0008): makes the first admins.
 * For each email in SEED_ADMIN_EMAILS it creates the Supabase auth user
 * (confirmed, no email sent) when missing, then the admin profile with the same
 * id, or turns an existing profile into an active admin. Safe to run again.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (the Admin API;
 * server only) and DATABASE_URL, read from .env by `node --env-file`.
 */
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { z } from "zod";

const COMPANY_DOMAIN = "@authoritysolutions.com";

const emailsSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        z.email().refine((email) => email.endsWith(COMPANY_DOMAIN), {
          message: `must end in ${COMPANY_DOMAIN}`,
        }),
      )
      .min(1, "SEED_ADMIN_EMAILS lists no email"),
  );

/** The two Admin API calls the seed makes (supabase.auth.admin). */
type AuthAdmin = {
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: { id: string; email?: string }[] };
    error: unknown;
  }>;
  createUser(attributes: { email: string; email_confirm: boolean }): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
};
type Query = (text: string, values: unknown[]) => Promise<unknown>;

const PER_PAGE = 1000;

async function existingAuthUsers(auth: AuthAdmin) {
  const ids = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) ids.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < PER_PAGE) return ids;
  }
}

/** "zachery.ross@…" becomes Zachery / Ross; the person can change it in settings. */
function namesFrom(email: string) {
  const [first = "", ...rest] = email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1));
  return { firstName: first, lastName: rest.join(" ") };
}

export async function seedAdmins(
  rawEmails: string | undefined,
  { auth, query }: { auth: AuthAdmin; query: Query },
) {
  const emails = emailsSchema.parse(rawEmails ?? "");
  const known = await existingAuthUsers(auth);

  for (const email of emails) {
    let id = known.get(email);
    if (!id) {
      const { data, error } = await auth.createUser({
        email,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("no user returned");
      id = data.user.id;
    }
    const { firstName, lastName } = namesFrom(email);
    await query(
      `insert into profiles (id, email, first_name, last_name, role, active)
       values ($1, $2, $3, $4, 'admin', true)
       on conflict (id) do update set role = 'admin', active = true, updated_at = now()`,
      [id, email, firstName, lastName],
    );
  }
  return emails;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL in .env",
    );
  }
  // Service role: the Admin API is the only way to create auth users. Never in app code.
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const emails = await seedAdmins(process.env.SEED_ADMIN_EMAILS, {
      auth: supabase.auth.admin,
      query: (text, values) => db.query(text, values),
    });
    console.log(`Admins ready: ${emails.length}`);
  } finally {
    await db.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
