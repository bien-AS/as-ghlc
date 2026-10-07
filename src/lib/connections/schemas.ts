import { z } from "zod";

import { stageSchema } from "@/lib/leads/schemas";

/*
 * The Connection contract, shaped after spec 09's Connection row (type,
 * provider, credentials reference, sync status), whose field list is assumed.
 * Shared by Route Handlers, hooks, pages and the data-access layer (ADR-0003).
 * Client-safe: no server-only imports, no fixtures.
 *
 * A credential, and the reference to one, is deliberately not in this file:
 * neither ever reaches the browser (spec 09, rule 6). The provider's name is
 * here because the Integrations screen is for admins, who must know what they
 * are connecting; no other screen reads it.
 */

export const CONNECTION_TYPES = [
  "crm",
  "proposals",
  "invoices",
  "decks",
] as const;
export const CONNECTION_STATUSES = [
  "connected",
  "not_connected",
  "syncing",
  "needs_attention",
] as const;

export const connectionTypeSchema = z.enum(CONNECTION_TYPES);
export const connectionStatusSchema = z.enum(CONNECTION_STATUSES);
export type ConnectionType = z.infer<typeof connectionTypeSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const providerSchema = z.object({ id: z.string(), name: z.string() });
export type Provider = z.infer<typeof providerSchema>;

/**
 * Body of PUT /api/connections/crm/stage-mapping: for each of the app's six
 * stages, the name of the CRM stage it becomes. Every stage is required and no
 * other key is accepted.
 */
export const stageMappingInputSchema = z.record(
  stageSchema,
  z.string().trim().min(1, "Choose a stage.").max(200),
);
export type StageMappingInput = z.infer<typeof stageMappingInputSchema>;

export const stageMappingSchema = z.object({
  /** The stage names the connected CRM has, in its own order. */
  crmStages: z.array(z.string()),
  mapping: stageMappingInputSchema,
});
export type StageMapping = z.infer<typeof stageMappingSchema>;

export const connectionSchema = z.object({
  type: connectionTypeSchema,
  provider: providerSchema,
  status: connectionStatusSchema,
  lastSyncedAt: z.iso.datetime().nullable(),
  /** The CRM Connection's, while it is connected; null otherwise. */
  stageMapping: stageMappingSchema.nullable(),
});
export type Connection = z.infer<typeof connectionSchema>;

/** Body of POST /api/connections/[type]. The key is checked, used once and never returned. */
export const connectInputSchema = z.strictObject({
  apiKey: z
    .string()
    .trim()
    .min(1, "Enter the API key.")
    .max(500, "That is too long to be an API key."),
});
export type ConnectInput = z.infer<typeof connectInputSchema>;

/** What an import did (spec 11, "Importing": a final count is reported). */
export const importResultSchema = z.object({
  found: z.number().int().min(0),
  added: z.number().int().min(0),
  alreadyHere: z.number().int().min(0),
});
export type ImportResult = z.infer<typeof importResultSchema>;

/** Route params. Sync, import and the stage mapping exist for the CRM only. */
export const connectionParamsSchema = z.object({ type: connectionTypeSchema });
export const crmParamsSchema = z.object({ type: z.literal("crm") });
