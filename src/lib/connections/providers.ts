import type { ConnectionType, Provider } from "@/lib/connections/schemas";

/*
 * THE PROVIDER TABLE. The one file in the app (outside spec 11's adapters)
 * that names an outside service by brand. The Integrations screen is for
 * admins, who must know what they are connecting, so it shows these names;
 * every other screen stays brand-free ("your CRM", "the proposal service").
 * Do not write a brand name in any other file's code or copy: read it from
 * here. Client-safe.
 */

export type CrmProvider = Provider & {
  /** "planned" is listed on the screen and cannot be connected. */
  availability: "available" | "planned";
};

/**
 * Question 11 (ASSUMED): which CRMs, in what order. The first is available,
 * the next is planned, and there is no automation service in between. The
 * answer to question 11 is a change to this list.
 */
export const CRM_PROVIDERS: readonly CrmProvider[] = [
  { id: "gohighlevel", name: "GoHighLevel", availability: "available" },
  { id: "zoho", name: "Zoho", availability: "planned" },
];

/** The CRM a Workspace connects to today: the first available one. */
export const DEFAULT_CRM_PROVIDER: Provider = {
  id: CRM_PROVIDERS[0].id,
  name: CRM_PROVIDERS[0].name,
};

/**
 * Question 10 (ASSUMED): the proposal, invoice and deck tools are fixed in the
 * first version, one provider each, with no choice offered. See
 * `providerIsFixed` in rules.ts for the flag the screen reads.
 */
export const FIXED_PROVIDERS: Record<
  Exclude<ConnectionType, "crm">,
  Provider
> = {
  proposals: { id: "smartpricingtable", name: "SmartPricingTable" },
  invoices: { id: "invoice-ninja", name: "Invoice Ninja" },
  decks: { id: "presenton", name: "Presenton" },
};
