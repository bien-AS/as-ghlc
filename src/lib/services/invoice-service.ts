import type { InvoiceLine } from "@/lib/invoices/schemas";

/*
 * The invoice service (spec 15). SERVER ONLY: called by
 * `src/lib/data/invoices.ts` and by nothing else. This is the one place the
 * real client will live. Its API documentation has not been read (spec 15).
 *
 * Today the function returns a sample value and makes NO network call.
 */

/** Creates a draft invoice for the client. The rep finishes it in the service. */
export async function createInvoiceDraft(input: {
  leadId: string;
  lines: InvoiceLine[];
}): Promise<{ serviceInvoiceId: string }> {
  return { serviceInvoiceId: `sample-invoice-${input.leadId}` };
}
