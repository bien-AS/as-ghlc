import { eq, ne, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import { ghlSyncLog, type writeType } from "@/db/schema";

import { GhlError, getContact, getOpportunity, ghlRequest } from "./index";

/*
 * THE write path to GHL (spec 06, "Writes out"). Every write W1 to W6 is one
 * planned request run through `runWrite`, which logs it in ghl_sync_log under
 * its idempotency key. Server only.
 *
 * `db` is the privileged connection (ADR-0007): ghl_sync_log has RLS on and no
 * policies, and the runner is reached from guarded data access and Inngest
 * jobs, never straight from a request.
 */

export type WriteType = (typeof writeType.enumValues)[number];
export type SyncLogEntry = typeof ghlSyncLog.$inferSelect;

/** One GHL request, stored as the row's payload so "Retry" re-sends exactly it. */
export type WritePlan = {
  method: "POST" | "PUT";
  path: string;
  body: Record<string, unknown>;
  /**
   * What GHL must hold afterwards, read back after the request, or the write
   * is recorded failed (check 9: never a silent success): the opportunity's
   * stage, or the contact's custom field values (field id to value).
   */
  expect:
    | { opportunityId: string; pipelineStageId: string }
    | { contactId: string; customFields: Record<string, string> };
};

export type Write = {
  leadId: string | null;
  writeType: WriteType;
  idempotencyKey: string;
  plan: WritePlan;
};

/** Anything stored from GHL, with the token taken out should GHL ever echo it. */
function redact<T>(value: T): T {
  const token = process.env.GHL_PRIVATE_TOKEN;
  if (!token || value == null) return value;
  return JSON.parse(JSON.stringify(value).replaceAll(token, "[redacted]"));
}

async function send(plan: WritePlan): Promise<unknown> {
  const check = plan.expect as unknown;
  // A payload logged before every plan had a read-back is never re-sent.
  if (!check || typeof check !== "object") {
    throw new Error("The logged request has no read-back, so it is not sent");
  }
  const response = await ghlRequest(plan.path, {
    method: plan.method,
    body: JSON.stringify(plan.body),
  });
  if ("opportunityId" in plan.expect) {
    const { opportunityId, pipelineStageId } = plan.expect;
    const { pipelineStageId: actual } = await getOpportunity(opportunityId);
    if (actual !== pipelineStageId) {
      throw new Error(
        `Read-back: opportunity ${opportunityId} is in stage ${actual}, not ${pipelineStageId}`,
      );
    }
  } else {
    const { contactId, customFields: expected } = plan.expect;
    const { customFields } = await getContact(contactId);
    for (const [id, value] of Object.entries(expected)) {
      const actual = customFields.find((field) => field.id === id)?.value;
      if (actual !== value) {
        throw new Error(
          `Read-back: contact ${contactId} field ${id} is ${JSON.stringify(actual)}, not ${JSON.stringify(value)}`,
        );
      }
    }
  }
  return response;
}

/**
 * Runs one write: skips it if its key already succeeded; records it skipped
 * ("writes disabled") with no call unless GHL_WRITES_ENABLED is exactly
 * "true"; otherwise sends it (429 backoff is ghlRequest's), counts the
 * attempt and records succeeded or failed. Never throws for a GHL failure: the
 * app's decision stands and the failed row is retried from the sync log.
 *
 * ponytail: two concurrent runs of the same key can both send. GHL writes are
 * set-to-a-value, so a double send changes nothing; add an Inngest
 * concurrency key per idempotency key if a write ever stops being idempotent.
 */
export async function runWrite(write: Write): Promise<SyncLogEntry> {
  // Insert, or refresh the payload of a key that has not succeeded yet. No row
  // back means the key already succeeded.
  const [row] = await db
    .insert(ghlSyncLog)
    .values({
      leadId: write.leadId,
      writeType: write.writeType,
      idempotencyKey: write.idempotencyKey,
      payload: write.plan,
    })
    .onConflictDoUpdate({
      target: ghlSyncLog.idempotencyKey,
      set: { payload: write.plan },
      setWhere: ne(ghlSyncLog.result, "succeeded"),
    })
    .returning();
  if (!row) {
    const done = await db.query.ghlSyncLog.findFirst({
      where: eq(ghlSyncLog.idempotencyKey, write.idempotencyKey),
    });
    if (!done) throw new Error(`No sync log row for ${write.idempotencyKey}`);
    return done;
  }

  const record = async (values: PgUpdateSetSource<typeof ghlSyncLog>) =>
    (
      await db
        .update(ghlSyncLog)
        .set(values)
        .where(eq(ghlSyncLog.id, row.id))
        .returning()
    )[0];

  if (process.env.GHL_WRITES_ENABLED !== "true") {
    return record({ result: "skipped", lastError: "writes disabled" });
  }

  const attempts = sql`${ghlSyncLog.attempts} + 1`;
  try {
    const response = await send(write.plan);
    return record({
      result: "succeeded",
      attempts,
      response: redact(response),
      lastError: null,
    });
  } catch (error) {
    return record({
      result: "failed",
      attempts,
      response: error instanceof GhlError ? { status: error.status } : null,
      lastError: redact(
        error instanceof Error ? error.message : String(error),
      ).slice(0, 1000),
    });
  }
}
