import {
  CONNECTION_TYPES,
  type ConnectInput,
  type Connection,
  type ConnectionType,
  type ImportResult,
  type StageMapping,
  type StageMappingInput,
} from "@/lib/connections/schemas";
import {
  buildSampleConnections,
  type ConnectionRecord,
  type ConnectionStore,
} from "@/lib/data/fixtures/connections";
import { listVisibleLeads } from "@/lib/data/leads";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { requireCapability } from "@/lib/data/viewer";
import * as crm from "@/lib/services/crm";

/*
 * Data access for Connections (spec 09's Connection row; spec 16; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard
 * (`requireCapability("manage_connections")`: the current user, then their
 * role) and then reads or changes the sample store. Going live means replacing
 * the bodies of the exported functions below with queries on the viewer's
 * Workspace's Connection rows, replacing the bodies in
 * `src/lib/services/crm.ts` with the real adapter client, and deleting
 * `fixtures/connections.ts`. Schemas, Route Handlers, query options, hooks and
 * the screen do not change.
 *
 * This is the only module, with its tests, that imports the fixture, and the
 * only caller of the CRM service. `toConnection` is the one place a stored row
 * becomes a response: it names every field it returns, so a credential
 * reference cannot leak by being added to the row (spec 09, rule 6).
 */

const store = sampleStore<ConnectionStore>("connections", () =>
  buildSampleConnections(Date.now()),
);

const find = (type: ConnectionType) =>
  store().connections.find(
    (record) => record.type === type,
  ) as ConnectionRecord;

const isConnected = (record: ConnectionRecord) =>
  record.status !== "not_connected";

/** The CRM Connection, or a refusal when there is nothing connected to act on. */
function connectedCrm(): ConnectionRecord {
  const record = find("crm");
  if (!isConnected(record)) throw new AccessError("conflict");
  return record;
}

async function readStageMapping(): Promise<StageMapping> {
  return {
    crmStages: await crm.listStages(),
    mapping: { ...store().stageMapping },
  };
}

async function toConnection(record: ConnectionRecord): Promise<Connection> {
  return {
    type: record.type,
    provider: { ...record.provider },
    status: record.status,
    lastSyncedAt: record.lastSyncedAt,
    stageMapping:
      record.type === "crm" && isConnected(record)
        ? await readStageMapping()
        : null,
  };
}

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** One Connection per type, in the order CRM, proposals, invoices, decks. */
export async function listConnections(): Promise<Connection[]> {
  await requireCapability("manage_connections");
  return Promise.all(CONNECTION_TYPES.map((type) => toConnection(find(type))));
}

/**
 * Connects a service. MOCK: the key has been checked as non-empty by the
 * schema; here it is handed to the service once (the CRM's sample drops it)
 * and otherwise not read. It is not stored, logged or returned.
 */
export async function connect(
  type: ConnectionType,
  input: ConnectInput,
): Promise<Connection> {
  await requireCapability("manage_connections");
  const record = find(type);
  if (isConnected(record)) throw new AccessError("conflict");

  // The proposal, invoice and deck services each get a module of their own
  // under src/lib/services with their specs (13 to 15); only the CRM has one.
  const healthy =
    type === "crm" ? (await crm.connect(input.apiKey)).healthy : true;
  record.status = healthy ? "connected" : "needs_attention";
  record.lastSyncedAt = new Date().toISOString();
  record.credentialRef = `sample-vault/${type}`;
  return toConnection(record);
}

/** Disconnects a service and forgets where its credential was kept. */
export async function disconnect(type: ConnectionType): Promise<Connection> {
  await requireCapability("manage_connections");
  const record = find(type);
  if (!isConnected(record)) throw new AccessError("conflict");

  record.status = "not_connected";
  record.lastSyncedAt = null;
  record.credentialRef = null;
  return toConnection(record);
}

/** Checks the CRM now and records when. Only the CRM syncs. */
export async function syncNow(_type: "crm"): Promise<Connection> {
  await requireCapability("manage_connections");
  const record = connectedCrm();

  const { healthy, syncedAt } = await crm.syncStatus();
  record.status = healthy ? "connected" : "needs_attention";
  if (healthy) record.lastSyncedAt = syncedAt;
  return toConnection(record);
}

/**
 * Imports the CRM's leads and reports the counts. A lead imported twice does
 * not duplicate (spec 09, rule 1), so it can be run again safely.
 */
export async function importLeads(): Promise<ImportResult> {
  await requireCapability("manage_connections");
  connectedCrm();

  const known = (await listVisibleLeads()).map((lead) => lead.id);
  return crm.importLeads(known);
}

/** The CRM's stage names and which one each of the app's stages becomes. */
export async function getStageMapping(): Promise<StageMapping> {
  await requireCapability("manage_connections");
  connectedCrm();
  return readStageMapping();
}

/** Saves the mapping. A stage name the CRM does not have is a conflict: its stages changed. */
export async function saveStageMapping(
  input: StageMappingInput,
): Promise<StageMapping> {
  await requireCapability("manage_connections");
  connectedCrm();

  const crmStages = await crm.listStages();
  if (Object.values(input).some((name) => !crmStages.includes(name))) {
    throw new AccessError("conflict");
  }
  store().stageMapping = { ...input };
  return readStageMapping();
}
