import type { Tone } from "@/lib/leads/rules";
import type {
  Notification,
  NotificationType,
} from "@/lib/notifications/schemas";

/*
 * The words for notifications (spec 08, "Text"). Pure; no data access.
 */

/** The name of each type, as the preference switches list them. */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  suspect_to_review: "Suspect to review",
  proposal_signed: "Proposal signed",
  invoice_draft_ready: "Invoice draft ready",
};

/** One sentence per type saying when it is raised, for the preference switches. */
export const NOTIFICATION_TYPE_WHEN: Record<NotificationType, string> = {
  suspect_to_review: "When the AI is unsure about one of your leads.",
  proposal_signed: "When a lead signs its proposal.",
  invoice_draft_ready: "When an invoice draft is created after signing.",
};

/**
 * What happened, in one sentence. The ONE place a notification's text is
 * produced, from its type and its lead, so the wording cannot drift and never
 * names a CRM or a third-party service (spec 08, acceptance check 10).
 */
export function notificationText(
  type: NotificationType,
  lead: Notification["lead"],
): string {
  switch (type) {
    case "suspect_to_review":
      return `The AI is unsure about ${lead.name}. Review this suspect.`;
    case "proposal_signed":
      return `${lead.name} signed the proposal.`;
    case "invoice_draft_ready":
      return `An invoice draft is ready for ${lead.name}.`;
  }
}

/** The chip on a notification nobody has opened yet: a word, with its tone. */
export const UNREAD_META: { label: string; tone: Tone } = {
  label: "Unread",
  tone: "brand",
};
