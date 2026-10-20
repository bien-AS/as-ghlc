// @vitest-environment node
import "dotenv/config";

import { desc, eq, sql, TransactionRollbackError } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import { estimateResearchCost, getLatestResearch } from "@/lib/data/research";
import type { Completion } from "@/lib/services/llm";

import { researchHandler } from "./research";

/*
 * The research job against the real database, with the website fetch and the
 * model stubbed: no real site or model is ever called. Each test runs in a
 * transaction that is rolled back. The guards are stubbed to let the reader
 * in; who may read is the isolation suite's job (src/test/isolation).
 */

const DIRECT_URL = process.env.DIRECT_URL;
const SUITE = DIRECT_URL
  ? "research brief job (real database, stubbed fetch and model)"
  : "research brief job: SKIPPED, DIRECT_URL is not set";

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

const stubs = vi.hoisted(() => ({
  complete: vi.fn(),
  fetchSite: vi.fn(),
}));
vi.mock("@/lib/services/llm", () => ({ complete: stubs.complete }));
vi.mock("@/lib/services/research-fetch", () => ({
  fetchSite: stubs.fetchSite,
}));
vi.mock("@/lib/data/leads", () => ({
  getLead: async (id: string) => ({ id }),
}));
vi.mock("@/lib/data/users", () => ({ requireProfile: async () => ({}) }));

type Db = NodePgDatabase<typeof schema>;

/** A step that runs each body once, as Inngest would after its retries. */
const step = { run: <T>(_name: string, fn: () => Promise<T>) => fn() };
const run = (leadId: string) =>
  researchHandler({ event: { data: { leadId } }, step });

const BRIEF = {
  summary: "Acme sells roofing in Austin; angle: no reviews on the site.",
  markdown: "## What they sell\n\nRoofing.",
  claims: [
    { claim: "Sells roofing", source: "https://acme.example/" },
    { claim: "Competes with Roofs R Us", source: "model inference" },
  ],
};

const completion = (overrides: Partial<Completion> = {}): Completion => ({
  text: JSON.stringify(BRIEF),
  model: "test/model-2026",
  promptTokens: 1200,
  completionTokens: 300,
  cost: 0.0213,
  ...overrides,
});

describe.skipIf(!DIRECT_URL)(SUITE, () => {
  let client: pg.Client | undefined;
  let root: Db;

  const inRollback = (
    body: (db: Db, leadId: string) => Promise<void>,
    website: string | null = "acme.example",
  ) =>
    root
      .transaction(async (t) => {
        const db = t as unknown as Db;
        tx.db = db;
        const [lead] = await db
          .insert(schema.leads)
          .values({
            ghlContactId: "research-test-contact",
            companyName: "Acme",
            website,
          })
          .returning({ id: schema.leads.id });
        await body(db, lead.id);
        t.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });

  const rows = (db: Db, leadId: string) =>
    db
      .select()
      .from(schema.leadResearch)
      .where(eq(schema.leadResearch.leadId, leadId))
      .orderBy(desc(schema.leadResearch.createdAt));

  beforeAll(async () => {
    vi.stubEnv("OPENROUTER_MODEL", "test/model");
    client = new pg.Client({ connectionString: DIRECT_URL });
    await client.connect();
    root = drizzle({ client, schema });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await client?.end();
  });

  beforeEach(() => {
    stubs.complete.mockReset().mockResolvedValue(completion());
    stubs.fetchSite
      .mockReset()
      .mockResolvedValue([
        { url: "https://acme.example/", text: "Acme Roofing, Austin TX" },
      ]);
  });

  test("a run stores the markdown, facts with their sources, and usage", () =>
    inRollback(async (db, leadId) => {
      expect(await run(leadId)).toMatchObject({ status: "ready" });
      expect(stubs.fetchSite).toHaveBeenCalledWith("acme.example");
      const [row] = await rows(db, leadId);
      expect(row).toMatchObject({
        status: "ready",
        briefMd: BRIEF.markdown,
        facts: { summary: BRIEF.summary, claims: BRIEF.claims },
        model: "test/model-2026",
        inputTokens: 1200,
        outputTokens: 300,
        costUsd: "0.021300",
        error: null,
      });
      const research = await getLatestResearch(leadId);
      expect(research.brief).toMatchObject({
        briefMd: BRIEF.markdown,
        costUsd: 0.0213,
      });
      expect(research.run).toBeNull();
      expect(research.costEstimate).toBe("≈ $0.02 per run");
    }));

  test("cost OpenRouter does not report is stored as null, never 0, and is not in the estimate", () =>
    inRollback(async (db, leadId) => {
      stubs.complete.mockResolvedValue(
        completion({ cost: null, promptTokens: null }),
      );
      await run(leadId);
      const [row] = await rows(db, leadId);
      expect(row).toMatchObject({
        status: "ready",
        costUsd: null,
        inputTokens: null,
      });
      expect(await estimateResearchCost()).toBe("Not measured");
    }));

  test("a failed run is 'failed' with its error, and the previous ready brief is still the one shown", () =>
    inRollback(async (db, leadId) => {
      await run(leadId);
      // Same transaction, same now(): place the first run in the past so the order is real.
      await db
        .update(schema.leadResearch)
        .set({ createdAt: sql`now() - interval '1 hour'` })
        .where(eq(schema.leadResearch.leadId, leadId));

      stubs.complete.mockResolvedValue(
        completion({ text: "Sorry, I can't help with that." }),
      );
      expect(await run(leadId)).toMatchObject({ status: "failed" });

      const [failed, ready] = await rows(db, leadId);
      expect(failed.status).toBe("failed");
      expect(failed.error).toMatch(/JSON/);
      expect(ready.status).toBe("ready");

      const research = await getLatestResearch(leadId);
      expect(research.brief).toMatchObject({
        id: ready.id,
        briefMd: BRIEF.markdown,
      });
      expect(research.run).toMatchObject({
        status: "failed",
        error: failed.error,
      });
    }));

  test("a site that cannot be fetched fails the run with why, and calls no model", () =>
    inRollback(async (db, leadId) => {
      stubs.fetchSite.mockRejectedValue(
        new Error("https://acme.example/ answered 503"),
      );
      await run(leadId);
      const [row] = await rows(db, leadId);
      expect(row).toMatchObject({
        status: "failed",
        error: "https://acme.example/ answered 503",
      });
      expect(stubs.complete).not.toHaveBeenCalled();
    }));

  test("a lead with no website gets a ready brief that says so, with no fetch and no model call", () =>
    inRollback(async (db, leadId) => {
      expect(await run(leadId)).toMatchObject({ status: "ready" });
      expect(stubs.fetchSite).not.toHaveBeenCalled();
      expect(stubs.complete).not.toHaveBeenCalled();
      const [row] = await rows(db, leadId);
      expect(row).toMatchObject({
        status: "ready",
        model: null,
        costUsd: null,
      });
      expect(row.briefMd).toMatch(/No website/);
      expect((await getLatestResearch(leadId)).brief?.facts.claims).toEqual([]);
    }, null));
});
