-- Prisma is removed (spec 01): drop its one model's table and its migration ledger. Approved by the owner.
DROP TABLE IF EXISTS "public"."User";--> statement-breakpoint
DROP TABLE IF EXISTS "public"."_prisma_migrations";
