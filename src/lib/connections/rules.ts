import type { CrmProvider } from "@/lib/connections/providers";
import type {
  ConnectionStatus,
  ConnectionType,
} from "@/lib/connections/schemas";
import type { Tone } from "@/lib/leads/rules";

/*
 * Labels, the one status-to-tone mapping, and the assumed answers the
 * Integrations screen is built on, each behind one name. Pure and client-safe.
 * No brand names here: those live in providers.ts.
 */

export const CONNECTION_TYPE_LABEL: Record<ConnectionType, string> = {
  crm: "CRM",
  proposals: "Proposals",
  invoices: "Invoices",
  decks: "Decks",
};

/** The Word Beside Colour Rule: a status chip takes its word and tone from here. */
export const CONNECTION_STATUS_META: Record<
  ConnectionStatus,
  { label: string; tone: Tone }
> = {
  connected: { label: "Connected", tone: "ok" },
  not_connected: { label: "Not connected", tone: "neutral" },
  syncing: { label: "Syncing", tone: "warn" },
  needs_attention: { label: "Needs attention", tone: "crit" },
};

/** The Planned Label Rule: what is not built carries a `warn` chip reading "Planned". */
export const AVAILABILITY_META: Record<
  CrmProvider["availability"],
  { label: string; tone: Tone }
> = {
  available: { label: "Available", tone: "ok" },
  planned: { label: "Planned", tone: "warn" },
};

/**
 * Question 1 (ASSUMED): the app owns a lead's stage and pushes it out to the
 * CRM. So the mapping reads from the app's six stages to the CRM's, one CRM
 * stage per app stage. If CRM-side changes are to flow back, this becomes
 * "both" and the mapping needs the reverse direction too.
 */
export const STAGE_SYNC_DIRECTION: "app_to_crm" | "both" = "app_to_crm";

/** The direction in one line, shown above the stage table. */
export const stageDirectionText = (crmName: string) =>
  STAGE_SYNC_DIRECTION === "app_to_crm"
    ? `Dealwright owns a lead's stage and pushes it out to ${crmName}. Choose the stage each one becomes there.`
    : `A lead's stage is kept in step between Dealwright and ${crmName}. Choose the stage that matches each one.`;

/**
 * Question 10 (ASSUMED): the proposal, invoice and deck tools are fixed in the
 * first version; only the CRM is an adapter. If they become adapters too, this
 * returns false for them and their panels gain a choice of provider.
 */
export const providerIsFixed = (type: ConnectionType) => type !== "crm";
