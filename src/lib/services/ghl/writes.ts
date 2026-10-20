import type { leads } from "@/db/schema";
import { ghlDeckLinkWrite } from "@/lib/flags";

import { type GhlConfig, ghlConfig } from "./index";
import { runWrite, type SyncLogEntry, type WritePlan } from "./runner";

/*
 * The app's writes to GHL (spec 06, "Writes out"), one function each, all run
 * through `runWrite`. The callers (validation in spec 08, the rep's decisions
 * in spec 07) have already read the lead through its scope and pass it in.
 *
 * ASSUMED request shapes, to confirm in the supervised write session (or on a
 * dev sub-account) before writes are switched on:
 *  - contact fields: POST /contacts/upsert { locationId, email, phone,
 *    customFields: [{ id, value }] }, matching on email or phone and answering
 *    `"new": false` when it updated (anything else is recorded failed);
 *  - opportunity: PUT /opportunities/{id} { pipelineId, pipelineStageId,
 *    customFields: [{ id, field_value }] }, then read back (check 9).
 */

type Lead = typeof leads.$inferSelect;
export type ContactLead = Pick<Lead, "id" | "email" | "phone">;
export type OpportunityLead = Pick<Lead, "id"> & { ghlOpportunityId: string };

type ContactField = keyof GhlConfig["contactFields"];

function contactUpsert(
  lead: ContactLead,
  fields: Partial<Record<ContactField, string>>,
): WritePlan {
  const cfg = ghlConfig();
  return {
    method: "POST",
    path: "/contacts/upsert",
    body: {
      locationId: cfg.locationId,
      ...(lead.email && { email: lead.email }),
      ...(lead.phone && { phone: lead.phone }),
      customFields: Object.entries(fields).map(([key, value]) => ({
        id: cfg.contactFields[key as ContactField],
        value,
      })),
    },
    expect: "existing_contact",
  };
}

const VALIDATION_STATUS = {
  valid: "Valid",
  suspect: "Suspect",
  spam: "Spam",
} as const;

/** W1: the validation verdict and its summary (the research brief) on the contact. */
export const writeValidationVerdict = (
  lead: ContactLead,
  verdict: keyof typeof VALIDATION_STATUS,
  summary: string,
): Promise<SyncLogEntry> =>
  runWrite({
    leadId: lead.id,
    writeType: "w1_verdict",
    idempotencyKey: `w1_verdict:${lead.id}:${verdict}`,
    plan: contactUpsert(lead, {
      validation_status: VALIDATION_STATUS[verdict],
      validation_summary: summary,
    }),
  });

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
        plan: contactUpsert(lead, { ds_deck_link: deckUrl }),
      })
    : null;

/** W3: the rep's qualification decision, and the stage that goes with it (Qualified or Lead Lost). */
export function writeQualification(
  lead: OpportunityLead,
  decision: "qualified" | "not_qualified",
): Promise<SyncLogEntry> {
  const cfg = ghlConfig();
  const pipelineStageId =
    cfg.stages[decision === "qualified" ? "Qualified" : "Lead Lost"];
  return runWrite({
    leadId: lead.id,
    writeType: "w3_qualification",
    idempotencyKey: `w3_qualification:${lead.id}:${decision}`,
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
  });
}

/** W4: a rep marks a suspect as spam. Validation Status = Spam, nothing else; GHL does the removal. */
export const writeMarkSpam = (lead: ContactLead): Promise<SyncLogEntry> =>
  runWrite({
    leadId: lead.id,
    writeType: "w4_mark_spam",
    idempotencyKey: `w4_mark_spam:${lead.id}`,
    plan: contactUpsert(lead, { validation_status: "Spam" }),
  });
