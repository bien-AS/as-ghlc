import type { ImportResult } from "@/lib/connections/schemas";

/*
 * The CRM service: the ONE place the real CRM adapter client will live (spec
 * 11, "one contract, one adapter per CRM behind it"). Server only, and called
 * only by src/lib/data/connections.ts.
 *
 * SAMPLE ONLY. Nothing here opens a network connection, reads an environment
 * variable or keeps what it is given. Going live means replacing each body
 * with a call through the connected CRM's adapter; the signatures are what the
 * data-access layer depends on.
 */

/** Sample stage names, as a CRM pipeline might have them: not the app's own six. */
const SAMPLE_CRM_STAGES = [
  "New Lead",
  "Discovery Session Booked",
  "Qualified",
  "Proposal Review Booked",
  "Proposal Sent",
  "Won",
  "Nurture",
];

/**
 * Spec 11, "Connect": check a credential and say whether the connection is
 * healthy. The real one stores the credential in the secrets store and keeps
 * only a reference. The sample drops the key: it is not stored, logged or
 * returned.
 */
export async function connect(_apiKey: string): Promise<{ healthy: boolean }> {
  return { healthy: true };
}

/** Whether the CRM can be reached now, and when that was checked. */
export async function syncStatus(): Promise<{
  healthy: boolean;
  syncedAt: string;
}> {
  return { healthy: true, syncedAt: new Date().toISOString() };
}

/** The stage names of the connected CRM's pipeline, in its own order. */
export async function listStages(): Promise<string[]> {
  return [...SAMPLE_CRM_STAGES];
}

/**
 * Spec 11, "Import": pull the CRM's leads into the lead store, without
 * duplicates (spec 09, rule 1: source plus external ID). `known` is the leads
 * the app already holds. The sample CRM holds exactly those, so every one is
 * found, every one is already here, and none is added.
 */
export async function importLeads(known: string[]): Promise<ImportResult> {
  return { found: known.length, added: 0, alreadyHere: known.length };
}
