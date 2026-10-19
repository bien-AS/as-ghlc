import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

// DATABASE_URL is Supabase's transaction pooler (port 6543), which cannot keep prepared statements.
// node-postgres only prepares a statement when a query is given a name (`.prepare("name")`): never name one here.
export const db = drizzle({
  connection: { connectionString: process.env.DATABASE_URL },
  schema,
});
