// @vitest-environment node
import "dotenv/config";

import { eq, like, TransactionRollbackError } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import * as schema from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import type { GhlContact, GhlOpportunity } from "@/lib/services/ghl";
import { TEST_IDS } from "@/test/ghl-ids";

import {
  applyWebhookEvent,
  markWebhookFailed,
  recordWebhookEvent,
  type WebhookType,
} from "./ghl-webhook";
import {
  appointment,
  contactCreated,
  stageChanged,
} from "./ghl-webhook.fixtures";

/*
 * The webhook job against a stubbed GHL (GET only) and the real database, each
 * test in a transaction that is rolled back (as ghl-sync.db.test.ts does).
 */

const DIRECT_URL = process.env.DIRECT_URL;
const SUITE = DIRECT_URL
  ? "GHL webhook job (real database, stubbed GHL)"
  : "GHL webhook job: SKIPPED, DIRECT_URL is not set";

const tx = vi.hoisted(() => ({ db: undefined as unknown as object }));
vi.mock("@/db/client", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const value = Reflect.get(tx.db, key);
        return typeof value === "function" ? value.bind(tx.db) : value;
      },
    },
  ),
}));

const ghl = vi.hoisted(() => ({
  opportunities: new Map<string, GhlOpportunity>(),
  contacts: new Map<string, GhlContact>(),
}));
vi.mock("@/lib/services/ghl", async (original) => ({
  ...(await original<typeof import("@/lib/services/ghl")>()),
  findContactOpportunity: async (id: string) =>
    ghl.opportunities.get(id) ?? null,
  getContact: async (id: string) => ghl.contacts.get(id),
}));

const send = vi.spyOn(inngest, "send");

const STATUSES = [
  "New - Contacted",
  "Booked - Discovery",
  "No Show - Recovery",
];

/** The stubbed GHL's opportunity for contact n. */
const setOpportunity = (
  n: number,
  stage: keyof typeof TEST_IDS.stages,
  leadStatus: string,
) =>
  ghl.opportunities.set(`hook-test-contact-${n}`, {
    id: `hook-test-opp-${n}`,
    contactId: `hook-test-contact-${n}`,
    pipelineId: TEST_IDS.pipelineId,
    pipelineStageId: TEST_IDS.stages[stage],
    assignedTo: null,
    updatedAt: "2026-10-20T14:00:00.000Z",
    customFields: [
      {
        id: TEST_IDS.opportunityFields.lead_status,
        fieldValueString: leadStatus,
      },
    ],
  });

type Db = NodePgDatabase<typeof schema>;

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let root: Db;

  const inRollback = (body: (db: Db) => Promise<void>) =>
    root
      .transaction(async (t) => {
        const db = t as unknown as Db;
        tx.db = db;
        await db
          .insert(schema.statusDefs)
          .values(
            STATUSES.map((value, position) => ({
              value,
              groupName: value.split(" - ")[0],
              position,
              stages: ["New Lead" as const],
              tone: "neutral",
            })),
          )
          .onConflictDoNothing();
        ghl.opportunities.clear();
        ghl.contacts = new Map([
          [
            "hook-test-contact-1",
            {
              id: "hook-test-contact-1",
              firstName: "Hook 1",
              lastName: "Test",
              email: "hook-1@example.com",
              customFields: [],
            },
          ],
        ]);
        send.mockReset().mockResolvedValue({ ids: ["e-1"] });
        await body(db);
        t.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });

  /** Records the fixture as the route would and applies it. */
  const deliver = async (type: WebhookType, payload: { webhookId: string }) => {
    const id = await recordWebhookEvent({
      eventId: payload.webhookId,
      type,
      verified: true,
      payload,
    });
    if (!id) throw new Error("duplicate");
    return { id, outcome: await applyWebhookEvent(id) };
  };
  const lead = async (db: Db) => {
    const [row] = await db
      .select()
      .from(schema.leads)
      .where(like(schema.leads.ghlContactId, "hook-test-%"));
    return row;
  };
  const events = (db: Db, leadId: string) =>
    db
      .select()
      .from(schema.leadStatusEvents)
      .where(eq(schema.leadStatusEvents.leadId, leadId))
      .orderBy(schema.leadStatusEvents.createdAt);
  const outcomeOf = async (db: Db, id: string) =>
    (
      await db.query.webhookEvents.findFirst({
        where: eq(schema.webhookEvents.id, id),
      })
    )?.outcome;

  beforeAll(async () => {
    vi.stubEnv("GHL_LOCATION_ID", "loc-test");
    vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    root = drizzle({ client, schema });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await client?.end();
  });

  test("the same webhookId is recorded once", () =>
    inRollback(async () => {
      const event = {
        eventId: "wh-once",
        type: "contact_created",
        verified: true,
        payload: contactCreated(),
      };
      expect(await recordWebhookEvent(event)).toEqual(expect.any(String));
      expect(await recordWebhookEvent(event)).toBeNull();
    }));

  test("contact created: the lead, stage New Lead, status from Lead Status, validation requested (check 2)", () =>
    inRollback(async (db) => {
      setOpportunity(1, "New Lead", "New - Contacted");
      const { id, outcome } = await deliver(
        "contact_created",
        contactCreated(),
      );
      expect(outcome).toBe("created");
      expect(await outcomeOf(db, id)).toBe("created");

      const created = await lead(db);
      expect(created).toMatchObject({
        ghlContactId: "hook-test-contact-1",
        ghlOpportunityId: "hook-test-opp-1",
        firstName: "Hook 1",
        email: "hook-1@example.com",
        stage: "New Lead",
        leadStatus: "New - Contacted",
      });
      expect(await events(db, created.id)).toMatchObject([
        { actor: "webhook", toStage: "New Lead", note: "created" },
      ]);
      expect(send).toHaveBeenCalledExactlyOnceWith({
        id: `validation-${created.id}`,
        name: "lead/validation.requested",
        data: { leadId: created.id },
      });
    }));

  test("booked, cancelled and no-show each update the booking and status, with a timeline event (check 3)", () =>
    inRollback(async (db) => {
      setOpportunity(1, "New Lead", "New - Contacted");
      await deliver("contact_created", contactCreated());

      setOpportunity(1, "Discovery Call Booked", "Booked - Discovery");
      await deliver("appointment_booked", appointment(1, "wh-booked"));
      expect(await lead(db)).toMatchObject({
        stage: "Discovery Call Booked",
        leadStatus: "Booked - Discovery",
        discoveryBookingAt: new Date("2026-10-22T19:00:00.000Z"),
        discoveryBookingStatus: "booked",
        reviewBookingStatus: null,
      });

      setOpportunity(1, "Discovery Call Booked", "No Show - Recovery");
      await deliver(
        "appointment_no_show",
        appointment(1, "wh-noshow", TEST_IDS.calendars.discovery, "noshow"),
      );
      expect(await lead(db)).toMatchObject({
        leadStatus: "No Show - Recovery",
        discoveryBookingStatus: "no_show",
      });

      await deliver(
        "appointment_cancelled",
        appointment(
          1,
          "wh-cancel",
          TEST_IDS.calendars.proposalReview,
          "cancelled",
        ),
      );
      const after = await lead(db);
      expect(after).toMatchObject({
        discoveryBookingStatus: "no_show",
        reviewBookingStatus: "cancelled",
      });

      const timeline = await events(db, after.id);
      expect(timeline.map((e) => e.actor)).toEqual(Array(4).fill("webhook"));
      expect(timeline.slice(1)).toMatchObject([
        {
          fromStage: "New Lead",
          toStage: "Discovery Call Booked",
          fromStatus: "New - Contacted",
          toStatus: "Booked - Discovery",
        },
        {
          fromStatus: "Booked - Discovery",
          toStatus: "No Show - Recovery",
          note: "corrected: leadStatus, discoveryBookingStatus",
        },
        { note: "corrected: reviewBookingAt, reviewBookingStatus" },
      ]);
    }));

  test("stage changed: the stage follows GHL with one 'webhook' event (check 4)", () =>
    inRollback(async (db) => {
      setOpportunity(1, "New Lead", "New - Contacted");
      await deliver("contact_created", contactCreated());
      setOpportunity(1, "Nurturing", "New - Contacted");
      const { outcome } = await deliver("stage_changed", stageChanged());
      expect(outcome).toBe("updated");

      const moved = await lead(db);
      expect(moved.stage).toBe("Nurturing");
      const changes = (await events(db, moved.id)).slice(1);
      expect(changes).toMatchObject([
        {
          actor: "webhook",
          fromStage: "New Lead",
          toStage: "Nurturing",
          note: "corrected: stage",
        },
      ]);

      // Delivered again under a new webhookId, nothing has changed: no event.
      expect(
        (await deliver("stage_changed", stageChanged(1, "wh-stage-again")))
          .outcome,
      ).toBe("unchanged");
      expect(await events(db, moved.id)).toHaveLength(2);
    }));

  test("a booked event applied after a later cancel (an Inngest retry) leaves the booking cancelled", () =>
    inRollback(async (db) => {
      setOpportunity(1, "New Lead", "New - Contacted");
      await deliver("contact_created", contactCreated());
      const record = (
        type: WebhookType,
        payload: { webhookId: string },
        at: string,
      ) =>
        recordWebhookEvent({
          eventId: payload.webhookId,
          type,
          verified: true,
          payload,
          createdAt: new Date(at),
        }) as Promise<string>;
      const booked = await record(
        "appointment_booked",
        appointment(1, "wh-late-booked"),
        "2026-10-20T15:00:00Z",
      );
      const cancelled = await record(
        "appointment_cancelled",
        appointment(1, "wh-cancel-first"),
        "2026-10-20T15:05:00Z",
      );
      await applyWebhookEvent(cancelled);
      expect((await lead(db)).discoveryBookingStatus).toBe("cancelled");
      await applyWebhookEvent(booked);
      expect((await lead(db)).discoveryBookingStatus).toBe("cancelled");

      // A booking received after the cancel still applies (a rebooking).
      await applyWebhookEvent(
        await record(
          "appointment_booked",
          appointment(1, "wh-rebooked"),
          "2026-10-20T15:10:00Z",
        ),
      );
      expect((await lead(db)).discoveryBookingStatus).toBe("booked");
    }));

  test("a lead first created by stage changed is sent to validation", () =>
    inRollback(async (db) => {
      setOpportunity(1, "New Lead", "New - Contacted");
      const { outcome } = await deliver("stage_changed", stageChanged());
      expect(outcome).toBe("created");
      const created = await lead(db);
      expect(send).toHaveBeenCalledExactlyOnceWith({
        id: `validation-${created.id}`,
        name: "lead/validation.requested",
        data: { leadId: created.id },
      });
    }));

  test("a contact with no opportunity yet: the job throws for a retry, and the failure is recorded", () =>
    inRollback(async (db) => {
      const id = await recordWebhookEvent({
        eventId: "wh-early",
        type: "contact_created",
        verified: true,
        payload: contactCreated(),
      });
      const error = await applyWebhookEvent(id as string).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      await markWebhookFailed(id as string, error);
      expect(await outcomeOf(db, id as string)).toMatch(/^failed: Contact /);
      expect(await lead(db)).toBeUndefined();
      expect(send).not.toHaveBeenCalled();
    }));
});
