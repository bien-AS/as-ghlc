import { z } from "zod";

import {
  exitSchema,
  PROPOSAL_STATUSES,
  stageSchema,
} from "@/lib/leads/schemas";

/*
 * The proposal contract (spec 14, "Interface"), shaped after the Proposal row
 * of spec 09's sketch, whose field lists are assumed. Shared by Route Handlers,
 * hooks, pages and the data-access layer (ADR-0003). No server-only imports
 * and no fixtures here. The proposal service's own identifier is deliberately
 * absent: it stays on the server.
 */

export const proposalStatusSchema = z.enum(PROPOSAL_STATUSES);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

const isoTime = z.iso.datetime();

/** Prices are dollars (spec 14, "What is known"), to the cent. */
const price = z
  .number("Enter a price in dollars.")
  .min(0, "A price cannot be negative.")
  .max(1_000_000, "Enter a price of at most $1,000,000.")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "Use at most two decimal places.",
  );

export const lineItemSchema = z.strictObject({
  service: z
    .string()
    .trim()
    .min(1, "Name the service.")
    .max(120, "Use at most 120 characters."),
  description: z.string().trim().max(500, "Use at most 500 characters."),
  price,
});
export type LineItem = z.infer<typeof lineItemSchema>;

/** Who the proposal is addressed to. Prefilled from the lead; the rep may correct it. */
export const proposalClientSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Enter the client's name.")
    .max(120, "Use at most 120 characters."),
  company: z.string().trim().max(120, "Use at most 120 characters."),
  email: z.union([
    z.literal(""),
    z.email("Enter a valid email address.").max(254),
  ]),
});
export type ProposalClient = z.infer<typeof proposalClientSchema>;

export const proposalSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  client: proposalClientSchema,
  lineItems: z.array(lineItemSchema),
  /** What the rep wants the lead to read above the services. May be empty. */
  context: z.string(),
  status: proposalStatusSchema,
  /** The sum of the line items' prices, in dollars. */
  total: z.number(),
  sentAt: isoTime.nullable(),
  /** The line items as they were when the proposal was sent (spec 09). */
  snapshot: z.array(lineItemSchema).nullable(),
  updatedAt: isoTime,
});
export type Proposal = z.infer<typeof proposalSchema>;

/** One service the rep can add from the catalogue, with its suggested price. */
export const catalogueServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
});
export type CatalogueService = z.infer<typeof catalogueServiceSchema>;

/** What the builder needs for one lead: GET /api/proposals/{leadId} and every write. */
export const proposalViewSchema = z.object({
  lead: z.object({
    id: z.string(),
    name: z.string(),
    stage: stageSchema,
    exit: exitSchema.nullable(),
  }),
  /** The lead's own details, which a new proposal starts from. */
  client: proposalClientSchema,
  /** Whether a proposal can be generated for this lead now. */
  canStart: z.boolean(),
  proposal: proposalSchema.nullable(),
  catalogue: z.array(catalogueServiceSchema),
});
export type ProposalView = z.infer<typeof proposalViewSchema>;

/** One row of the picker: GET /api/proposals. */
export const proposalLeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  stage: stageSchema,
  /** Null when no proposal has been started. */
  proposalStatus: proposalStatusSchema.nullable(),
});
export type ProposalLead = z.infer<typeof proposalLeadSchema>;
export const proposalLeadsSchema = z.array(proposalLeadSchema);

/** Body of PUT /api/proposals/{leadId}. Strict: an unknown field is rejected. */
export const proposalDraftInputSchema = z.strictObject({
  client: proposalClientSchema,
  lineItems: z.array(lineItemSchema).max(50, "Use at most 50 services."),
  context: z.string().trim().max(2000, "Use at most 2,000 characters."),
});
export type ProposalDraftInput = z.infer<typeof proposalDraftInputSchema>;

/** Bodies of the generate and send routes: nothing. */
export const emptyInputSchema = z.strictObject({});

export const PROPOSAL_EVENTS = ["viewed", "signed"] as const;
/** Body of POST /api/proposals/{leadId}/simulate (sample data only). */
export const simulateInputSchema = z.strictObject({
  event: z.enum(PROPOSAL_EVENTS),
});
export type ProposalEvent = z.infer<typeof simulateInputSchema>["event"];

/** The builder's address: which lead, if any. Lenient, like the Pipeline's filters. */
export function parseProposalLead(address: Record<string, unknown>) {
  const lead = Array.isArray(address.lead) ? address.lead[0] : address.lead;
  return typeof lead === "string" && lead.trim() ? lead.trim() : undefined;
}
