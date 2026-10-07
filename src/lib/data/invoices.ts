import {
  buildSampleInvoice,
  type InvoiceRecord,
} from "@/lib/data/fixtures/invoices";
import { getLead, recordInvoiceDraft } from "@/lib/data/leads";
// Each of the two modules calls the other, inside functions only: signing a
// proposal drafts the invoice, and the invoice is built from that proposal.
import { getProposal } from "@/lib/data/proposals";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import {
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
  invoiceStatusSchema,
} from "@/lib/invoices/schemas";
import type { LineItem, Proposal } from "@/lib/proposals/schemas";
import { createInvoiceDraft as createInService } from "@/lib/services/invoice-service";

/*
 * Data access for invoices (spec 15; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard: it reads the lead
 * through `getLead`, which settles who is asking and applies the role rule
 * (staff reach only their own leads; another rep's lead answers "not_found").
 * Going live means replacing the bodies of the exported functions below with
 * queries on the Invoice table, filling in
 * `src/lib/services/invoice-service.ts`, and deleting `fixtures/`. Schemas,
 * the Route Handler, query options, hooks and components do not change.
 *
 * This is the only module that imports the invoice fixtures and the invoice
 * service. A lead is changed only through `recordInvoiceDraft`.
 */

/**
 * Question 3 (ASSUMED: draft only). The app drafts an invoice and stops; the
 * rep finishes and sends it in the invoice service. This is the only status
 * the app ever gives an invoice. If invoicing is to go further, it starts here.
 */
const INVOICE_STATUS_WHEN_CREATED: InvoiceStatus = "draft";

/**
 * MOCK CHOICE (spec 15: "which proposal fields map to invoice lines" is not
 * known). One invoice line per line item of the signed proposal's snapshot:
 * the service's name as the description, its price as the amount.
 */
function invoiceLinesFrom(snapshot: LineItem[]): InvoiceLine[] {
  return snapshot.map((item) => ({
    description: item.service,
    amount: item.price,
  }));
}

const records = sampleStore<Map<string, InvoiceRecord>>(
  "invoices",
  () => new Map(),
);

function toInvoice(record: InvoiceRecord): Invoice {
  // The invoice service's id never leaves the server.
  const { serviceInvoiceId: _hidden, ...invoice } = record;
  return structuredClone(invoice);
}

/** A signed proposal with its lines as sent. Anything else has nothing to invoice. */
function signed(proposal: Proposal | null) {
  if (proposal?.status !== "signed" || !proposal.snapshot) {
    throw new AccessError("conflict");
  }
  return { id: proposal.id, snapshot: proposal.snapshot };
}

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** A lead's invoice, or null when it has none. */
export async function getInvoice(leadId: string): Promise<Invoice | null> {
  const lead = await getLead(leadId);
  const stored = records().get(leadId);
  if (stored) return toInvoice(stored);
  if (!lead.invoice) return null;

  // A sample lead whose record already says it has an invoice: build it from
  // the lead's signed sample proposal, the first time it is asked for.
  const { proposal } = await getProposal(leadId);
  if (!proposal?.snapshot) return null;
  const built = buildSampleInvoice({
    leadId,
    proposalId: proposal.id,
    status: invoiceStatusSchema
      .catch(INVOICE_STATUS_WHEN_CREATED)
      .parse(lead.invoice.status),
    lines: invoiceLinesFrom(proposal.snapshot),
    createdAt: lead.updatedAt,
  });
  records().set(leadId, built);
  return toInvoice(built);
}

/**
 * Drafts the invoice for a lead whose proposal has just been signed. Called by
 * the proposals module, never by a Route Handler (spec 15, "Started by").
 */
export async function createInvoiceDraft(leadId: string): Promise<Invoice> {
  const proposal = signed((await getProposal(leadId)).proposal);
  if (records().has(leadId)) throw new AccessError("conflict");
  const lines = invoiceLinesFrom(proposal.snapshot);

  const { serviceInvoiceId } = await createInService({ leadId, lines });
  await recordInvoiceDraft(leadId);
  const created = buildSampleInvoice({
    leadId,
    proposalId: proposal.id,
    serviceInvoiceId,
    status: INVOICE_STATUS_WHEN_CREATED,
    lines,
    createdAt: new Date().toISOString(),
  });
  records().set(leadId, created);
  return toInvoice(created);
}
