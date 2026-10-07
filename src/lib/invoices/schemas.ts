import { z } from "zod";

/*
 * The invoice contract (spec 15, "Interface"), shaped after the Invoice row of
 * spec 09's sketch, whose field lists are assumed. Client-safe: no server-only
 * imports, no fixtures. The invoice service's own identifier is deliberately
 * absent: it stays on the server.
 */

/**
 * Spec 09 lists no status values. "draft" is the only one this app produces
 * (question 3, see `src/lib/data/invoices.ts`); "sent" is here only because one
 * sample lead already carries it.
 */
export const INVOICE_STATUSES = ["draft", "sent"] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const invoiceLineSchema = z.object({
  description: z.string(),
  /** Dollars. */
  amount: z.number(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  leadId: z.string(),
  /** The signed proposal this invoice was drafted from. */
  proposalId: z.string(),
  status: invoiceStatusSchema,
  lines: z.array(invoiceLineSchema),
  total: z.number(),
  createdAt: z.iso.datetime(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

/** GET /api/leads/{leadId}/invoice answers with the invoice, or null when there is none. */
export const invoiceResponseSchema = invoiceSchema.nullable();
