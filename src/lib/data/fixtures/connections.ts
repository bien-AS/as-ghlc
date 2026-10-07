import {
  DEFAULT_CRM_PROVIDER,
  FIXED_PROVIDERS,
} from "@/lib/connections/providers";
import type {
  ConnectionStatus,
  ConnectionType,
  Provider,
  StageMappingInput,
} from "@/lib/connections/schemas";

/*
 * The sample Connections. Imported only by src/lib/data/connections.ts and
 * its tests; deleted when real data arrives (ADR-0006).
 */

/** A Connection as the store holds it (spec 09's row). */
export type ConnectionRecord = {
  type: ConnectionType;
  provider: Provider;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  /**
   * Where the credential is kept, never the credential (spec 09). Server
   * only: data access strips it, and no response carries it (rule 6).
   */
  credentialRef: string | null;
};

export type ConnectionStore = {
  connections: ConnectionRecord[];
  /** The CRM Connection's stage mapping; kept while it is disconnected. */
  stageMapping: StageMappingInput;
};

const MINUTE = 60 * 1000;

/** Both states are visible: three connected, the invoice service not. */
export function buildSampleConnections(now: number): ConnectionStore {
  const ago = (minutes: number) =>
    new Date(now - minutes * MINUTE).toISOString();
  return {
    connections: [
      {
        type: "crm",
        provider: DEFAULT_CRM_PROVIDER,
        status: "connected",
        lastSyncedAt: ago(4),
        credentialRef: "sample-vault/crm",
      },
      {
        type: "proposals",
        provider: FIXED_PROVIDERS.proposals,
        status: "connected",
        lastSyncedAt: ago(38),
        credentialRef: "sample-vault/proposals",
      },
      {
        type: "invoices",
        provider: FIXED_PROVIDERS.invoices,
        status: "not_connected",
        lastSyncedAt: null,
        credentialRef: null,
      },
      {
        type: "decks",
        provider: FIXED_PROVIDERS.decks,
        status: "connected",
        lastSyncedAt: ago(26 * 60),
        credentialRef: "sample-vault/decks",
      },
    ],
    stageMapping: {
      new: "New Lead",
      discovery_booked: "Discovery Session Booked",
      qualified: "Qualified",
      review_booked: "Proposal Review Booked",
      proposal_sent: "Proposal Sent",
      won: "Won",
    },
  };
}
