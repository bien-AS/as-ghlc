import {
  buildSampleProposal,
  clientOf,
  type ProposalRecord,
  SERVICE_CATALOGUE,
  suggestLineItems,
} from "@/lib/data/fixtures/proposals";
import { createInvoiceDraft } from "@/lib/data/invoices";
import {
  getLead,
  listVisibleLeads,
  recordProposalStatus,
} from "@/lib/data/leads";
import { createNotification } from "@/lib/data/notifications";
import { SAMPLE_DATA, sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import type { LeadDetail } from "@/lib/leads/schemas";
import {
  canEditProposal,
  canHaveProposal,
  sendBlockedReason,
  totalOf,
} from "@/lib/proposals/rules";
import type {
  ProposalDraftInput,
  ProposalEvent,
  ProposalLead,
  ProposalStatus,
  ProposalView,
} from "@/lib/proposals/schemas";
import {
  createProposal as createInService,
  readProposal as readFromService,
  sendProposal as sendThroughService,
  toAppStatus,
} from "@/lib/services/proposal-service";

/*
 * Data access for proposals (spec 14; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard: it reads the lead
 * through `getLead` / `listVisibleLeads`, which settle who is asking and apply
 * the role rule (staff reach only their own leads; another rep's lead answers
 * "not_found"). Going live means replacing the bodies of the exported
 * functions below with database queries on the Proposal table, filling in
 * `src/lib/services/proposal-service.ts`, and deleting `fixtures/`. Schemas,
 * Route Handlers, query options, hooks and components do not change.
 *
 * This is the only module, with its tests, that imports the proposal fixtures
 * and the proposal service. A lead is changed only through `recordProposalStatus`.
 */

const records = sampleStore<Map<string, ProposalRecord>>(
  "proposals",
  () => new Map(),
);

/**
 * The lead's proposal, or undefined. A sample lead whose record already says
 * it has a proposal gets one built for it the first time it is asked for.
 */
function recordFor(lead: LeadDetail): ProposalRecord | undefined {
  const stored = records().get(lead.id);
  if (stored || !lead.proposal) return stored;
  const built = buildSampleProposal({ ...lead, proposal: lead.proposal });
  records().set(lead.id, built);
  return built;
}

function toView(lead: LeadDetail, record: ProposalRecord | undefined) {
  let proposal: ProposalView["proposal"] = null;
  if (record) {
    // The proposal service's id never leaves the server.
    const { serviceProposalId: _hidden, ...rest } = record;
    proposal = structuredClone(rest);
  }
  const view: ProposalView = {
    lead: { id: lead.id, name: lead.name, stage: lead.stage, exit: lead.exit },
    client: clientOf(lead),
    canStart: !record && canHaveProposal(lead),
    proposal,
    catalogue: SERVICE_CATALOGUE.map(({ id, name, description, price }) => ({
      id,
      name,
      description,
      price,
    })),
  };
  return view;
}

/** The lead and its proposal for a write, refusing a lead that has left the pipeline. */
async function forWrite(leadId: string) {
  const lead = await getLead(leadId);
  if (lead.exit) throw new AccessError("conflict");
  return { lead, record: recordFor(lead) };
}

/**
 * Question 6 (ASSUMED: the app polls the proposal service for status and
 * events). This is the one place a view or a signature is learned. With
 * nothing to poll, `simulated` says what a poll would have found; the real
 * version takes no such argument and runs on a schedule. If the service can
 * push instead, this becomes the webhook's handler and nothing else moves.
 */
async function pollProposalService(
  record: ProposalRecord,
  simulated: ProposalEvent,
): Promise<ProposalStatus> {
  const report = await readFromService(
    record.serviceProposalId,
    simulated === "signed"
      ? { status: "won", events: ["proposal_viewed", "proposal_signed"] }
      : { status: "sent", events: ["proposal_viewed"] },
  );
  return toAppStatus(report);
}

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** The picker: the viewer's leads that are at a stage where a proposal belongs. */
export async function listProposalLeads(): Promise<ProposalLead[]> {
  const leads = await listVisibleLeads();
  return (
    leads
      .filter(canHaveProposal)
      // Furthest from done first, then by name: the ones to work on lead the list.
      .sort(
        (a, b) =>
          Number(Boolean(a.proposal)) - Number(Boolean(b.proposal)) ||
          a.name.localeCompare(b.name),
      )
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        company: lead.company,
        stage: lead.stage,
        proposalStatus: recordFor(lead)?.status ?? null,
      }))
  );
}

/** One lead's client details, whether a proposal can be started, and its proposal. */
export async function getProposal(leadId: string): Promise<ProposalView> {
  const lead = await getLead(leadId);
  return toView(lead, recordFor(lead));
}

/** Mock generate: a draft with services suggested from the lead's form answers and budget. */
export async function generateProposal(leadId: string): Promise<ProposalView> {
  const { lead, record } = await forWrite(leadId);
  if (record || !canHaveProposal(lead)) throw new AccessError("conflict");

  const client = clientOf(lead);
  const lineItems = suggestLineItems(lead);
  const { serviceProposalId } = await createInService({
    leadId,
    client,
    lineItems,
  });
  const updated = await recordProposalStatus(leadId, "draft");
  const created: ProposalRecord = {
    id: `proposal-${leadId}`,
    serviceProposalId,
    leadId,
    client,
    lineItems,
    context: "",
    status: "draft",
    total: totalOf(lineItems),
    sentAt: null,
    snapshot: null,
    updatedAt: new Date().toISOString(),
  };
  records().set(leadId, created);
  return toView(updated, created);
}

/** Saves the rep's edits. Only a draft can be edited (spec 14). */
export async function saveProposalDraft(
  leadId: string,
  input: ProposalDraftInput,
): Promise<ProposalView> {
  const { lead, record } = await forWrite(leadId);
  if (!record || !canEditProposal(record)) throw new AccessError("conflict");

  record.client = input.client;
  record.lineItems = input.lineItems;
  record.context = input.context;
  record.total = totalOf(input.lineItems);
  record.updatedAt = new Date().toISOString();
  return toView(lead, record);
}

/** Sends the draft: takes the snapshot and moves the lead to Proposal Sent. */
export async function sendProposal(leadId: string): Promise<ProposalView> {
  const { record } = await forWrite(leadId);
  if (!record || !canEditProposal(record) || sendBlockedReason(record)) {
    throw new AccessError("conflict");
  }

  const report = await sendThroughService(record.serviceProposalId, record);
  const updated = await recordProposalStatus(leadId, "sent");
  const time = new Date().toISOString();
  record.status = toAppStatus(report);
  record.sentAt = time;
  record.updatedAt = time;
  // Spec 09: a stored copy, so later price changes do not alter history.
  record.snapshot = structuredClone(record.lineItems);
  return toView(updated, record);
}

/**
 * Sample data only: stands in for what polling the proposal service would
 * discover (question 6). Viewing changes the status; signing also moves the
 * lead to Lead Won, drafts the invoice and raises both notifications.
 */
export async function simulateProposalEvent(
  leadId: string,
  event: ProposalEvent,
): Promise<ProposalView> {
  const { record } = await forWrite(leadId);
  // Refused once the data is real: nobody may then invent a signature.
  if (!SAMPLE_DATA) throw new AccessError("forbidden");
  const waiting =
    record?.status === "sent" ||
    (record?.status === "viewed" && event === "signed");
  if (!record || !waiting) throw new AccessError("conflict");

  const status = await pollProposalService(record, event);
  let updated = await recordProposalStatus(leadId, status);
  record.status = status;
  record.updatedAt = new Date().toISOString();

  if (status === "signed") {
    // Spec 14, "Hands on to": Invoices, then Notifications.
    await createInvoiceDraft(leadId);
    await createNotification({ leadId, type: "proposal_signed" });
    await createNotification({ leadId, type: "invoice_draft_ready" });
    updated = await getLead(leadId);
  }
  return toView(updated, record);
}
