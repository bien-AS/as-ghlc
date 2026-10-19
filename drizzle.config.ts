import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations run on DIRECT_URL (session mode); the app uses the pooled DATABASE_URL (src/db/client.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DIRECT_URL ?? "" },
});
