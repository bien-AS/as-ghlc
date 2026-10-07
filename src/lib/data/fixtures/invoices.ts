import type { Invoice } from "@/lib/invoices/schemas";

/*
 * Sample invoices (ADR-0006). Imported by `src/lib/data/invoices.ts` only.
 * Nothing here comes from the invoice service.
 */

/** An invoice as stored: the contract, plus the invoice service's own id. */
export type InvoiceRecord = Invoice & { serviceInvoiceId: string };

/** A sample invoice for a lead, from lines the caller has already worked out. */
export function buildSampleInvoice(
  input: Pick<
    Invoice,
    "leadId" | "proposalId" | "status" | "lines" | "createdAt"
  > & { serviceInvoiceId?: string },
): InvoiceRecord {
  return {
    id: `invoice-${input.leadId}`,
    serviceInvoiceId:
      input.serviceInvoiceId ?? `sample-invoice-${input.leadId}`,
    leadId: input.leadId,
    proposalId: input.proposalId,
    status: input.status,
    lines: input.lines,
    total:
      Math.round(
        input.lines.reduce((sum, line) => sum + line.amount, 0) * 100,
      ) / 100,
    createdAt: input.createdAt,
  };
}
