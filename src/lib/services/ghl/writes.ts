import type { leads } from "@/db/schema";
import { ghlDeckLinkWrite } from "@/lib/flags";

import { type GhlConfig, ghlConfig } from "./index";
import {
  runWrite,
  type SyncLogEntry,
  type Write,
  type WritePlan,
} from "./runner";

/*
 * The app's writes to GHL (spec 06, "Writes out"), one function each, all run
 * through `runWrite`. W1, W3 and W4 are also exported as the planned `Write`,
 * for a caller that logs it in its own transaction and runs it after the
 * commit (the rep's decisions, src/lib/data/leads.ts). The callers (validation in spec 08, the rep's decisions
 * in spec 07) have already read the lead through its scope and pass it in.
 *
 * `decisionId` is a stable id the caller owns for the decision being written
 * (the validation_runs or lead_status_events row that recorded it). It is part
 * of the idempotency key: the same decision sent twice makes one GHL change,
 * and a decision made again later (Qualified, Not Qualified, Qualified) is a
 * new decision and is written again.
 *
 * ASSUMED request shapes, to confirm in the supervised write session (or on a
 * dev sub-account) before writes are switched on:
 *  - contact fields: PUT /contacts/{ghlContactId} { customFields: [{ id, value }] }
 *    on the lead's own contact, by id. Not POST /contacts/upsert: that matches
 *    on email or phone, so it can create or update some other contact;
 *  - opportunity: PUT /opportunities/{id} { pipelineId, pipelineStageId,
 *    customFields: [{ id, field_value }] }.
 * Both are read back afterwards (check 9), so a wrong shape that GHL answers
 * 200 to and ignores is recorded failed, never succeeded.
 */

type Lead = typeof leads.$inferSelect;
export type ContactLead = Pick<Lead, "id" | "ghlContactId">;
export type OpportunityLead = Pick<Lead, "id"> & { ghlOpportunityId: string };

type ContactField = keyof GhlConfig["contactFields"];

function contactUpdate(
  lead: ContactLead,
  fields: Partial<Record<ContactField, string>>,
): WritePlan {
  const cfg = ghlConfig();
  const customFields = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      cfg.contactFields[key as ContactField],
      value,
    ]),
  );
  return {
    method: "PUT",
    path: `/contacts/${encodeURIComponent(lead.ghlContactId)}`,
    body: {
      customFields: Object.entries(customFields).map(([id, value]) => ({
        id,
        value,
      })),
    },
    expect: { contactId: lead.ghlContactId, customFields },
  };
}

const VALIDATION_STATUS = {
  valid: "Valid",
  suspect: "Suspect",
  spam: "Spam",
} as const;

/** W1: the validation verdict and its summary (the research brief) on the contact. */
export const validationVerdictWrite = (
  lead: ContactLead,
  verdict: keyof typeof VALIDATION_STATUS,
  summary: string,
  decisionId: string,
): Write => ({
  leadId: lead.id,
  writeType: "w1_verdict",
  idempotencyKey: `w1_verdict:${lead.id}:${verdict}:${decisionId}`,
  plan: contactUpdate(lead, {
    validation_status: VALIDATION_STATUS[verdict],
    validation_summary: summary,
  }),
});
export const writeValidationVerdict = (
  ...args: Parameters<typeof validationVerdictWrite>
): Promise<SyncLogEntry> => runWrite(validationVerdictWrite(...args));

/** W2: the deck link on the contact. Off behind `ghlDeckLinkWrite` (Phase 4): null, nothing logged. */
export const writeDeckLink = async (
  lead: ContactLead,
  deckUrl: string,
): Promise<SyncLogEntry | null> =>
  ghlDeckLinkWrite
    ? runWrite({
        leadId: lead.id,
        writeType: "w2_deck_link",
        idempotencyKey: `w2_deck_link:${lead.id}:${deckUrl}`,
        plan: contactUpdate(lead, { ds_deck_link: deckUrl }),
      })
    : null;

/** W3: the rep's qualification decision, and the stage that goes with it (Qualified or Lead Lost). */
export function qualificationWrite(
  lead: OpportunityLead,
  decision: "qualified" | "not_qualified",
  decisionId: string,
): Write {
  const cfg = ghlConfig();
  const pipelineStageId =
    cfg.stages[decision === "qualified" ? "Qualified" : "Lead Lost"];
  return {
    leadId: lead.id,
    writeType: "w3_qualification",
    idempotencyKey: `w3_qualification:${lead.id}:${decision}:${decisionId}`,
    plan: {
      method: "PUT",
      path: `/opportunities/${encodeURIComponent(lead.ghlOpportunityId)}`,
      body: {
        pipelineId: cfg.pipelineId,
        pipelineStageId,
        customFields: [
          {
            id: cfg.opportunityFields.qualification_decision,
            field_value:
              decision === "qualified" ? "Qualified" : "Not Qualified",
          },
        ],
      },
      expect: { opportunityId: lead.ghlOpportunityId, pipelineStageId },
    },
  };
}
export const writeQualification = (
  ...args: Parameters<typeof qualificationWrite>
): Promise<SyncLogEntry> => runWrite(qualificationWrite(...args));

/** W4: a rep marks a suspect as spam. Validation Status = Spam, nothing else; GHL does the removal. */
export const markSpamWrite = (
  lead: ContactLead,
  decisionId: string,
): Write => ({
  leadId: lead.id,
  writeType: "w4_mark_spam",
  idempotencyKey: `w4_mark_spam:${lead.id}:spam:${decisionId}`,
  plan: contactUpdate(lead, { validation_status: "Spam" }),
});
export const writeMarkSpam = (
  ...args: Parameters<typeof markSpamWrite>
): Promise<SyncLogEntry> => runWrite(markSpamWrite(...args));
