import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { GET as getWebhooks } from "@/app/api/admin/sync-log/webhooks/route";
import { retryWrite } from "@/lib/data/sync-log";
import { AccessError } from "@/lib/data/users";
import type {
  ListSyncLogQuery,
  SyncLogEntry,
  WebhookEventEntry,
} from "@/lib/sync-log/schemas";
import {
  api,
  renderScreen,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

import { SyncLogScreen } from "./sync-log-screen";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/db/client",
  async () => (await import("@/test/server-fakes")).dbModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

/*
 * The screen against the real Route Handlers (guards included); only the two
 * reads of the log tables are replaced, by a store that answers as the
 * data-access functions do: filtered, newest first. Their queries are covered
 * against the database (writes.db.test.ts, the isolation suites).
 */
const store = vi.hoisted(() => ({
  writes: [] as SyncLogEntry[],
  webhooks: [] as WebhookEventEntry[],
}));
const newestFirst = <T extends { createdAt: string }>(rows: T[]) =>
  [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

vi.mock("@/lib/data/sync-log", async () => {
  const { requireAdmin } = await import("@/lib/data/users");
  return {
    listSyncLog: async (query: ListSyncLogQuery) => {
      await requireAdmin();
      return {
        items: newestFirst(
          store.writes.filter(
            (row) =>
              (!query.writeType || row.writeType === query.writeType) &&
              (!query.result || row.result === query.result),
          ),
        ),
        nextCursor: null,
      };
    },
    retryWrite: vi.fn(async (id: string) => {
      await requireAdmin();
      const row = store.writes.find((entry) => entry.id === id);
      if (!row) throw new Error("no such row");
      return { ...row, attempts: row.attempts + 1 };
    }),
  };
});
vi.mock("@/lib/data/webhook-events", async () => {
  const { requireAdmin } = await import("@/lib/data/users");
  return {
    listWebhookEvents: async () => {
      await requireAdmin();
      return { items: newestFirst(store.webhooks), nextCursor: null };
    },
  };
});

const LEAD = "6f1c2a90-0000-4000-8000-000000000001";
const write = (over: Partial<SyncLogEntry>): SyncLogEntry => ({
  id: "00000000-0000-4000-8000-000000000000",
  leadId: LEAD,
  writeType: "w1_verdict",
  idempotencyKey: "key",
  payload: { method: "PUT", path: "/contacts/c-1", body: {} },
  result: "succeeded",
  response: null,
  attempts: 1,
  lastError: null,
  createdAt: "2026-10-07T09:00:00.000Z",
  updatedAt: "2026-10-07T09:00:00.000Z",
  ...over,
});
const FAILED = write({
  id: "00000000-0000-4000-8000-000000000003",
  writeType: "w3_qualification",
  idempotencyKey: `w3_qualification:${LEAD}:qualified:d1`,
  payload: {
    method: "PUT",
    path: "/opportunities/opp-1",
    body: { pipelineStageId: "s" },
  },
  result: "failed",
  attempts: 3,
  lastError: "GHL is unreachable",
  createdAt: "2026-10-07T11:00:00.000Z",
});
const SKIPPED = write({
  id: "00000000-0000-4000-8000-000000000002",
  writeType: "w1_verdict",
  idempotencyKey: `w1_verdict:${LEAD}:valid:r1`,
  result: "skipped",
  attempts: 0,
  lastError: "writes disabled",
  createdAt: "2026-10-07T10:00:00.000Z",
});
const SUCCEEDED = write({
  id: "00000000-0000-4000-8000-000000000001",
  writeType: "w4_mark_spam",
  idempotencyKey: `w4_mark_spam:${LEAD}:spam:d2`,
  createdAt: "2026-10-07T09:00:00.000Z",
});

const webhook = (over: Partial<WebhookEventEntry>): WebhookEventEntry => ({
  id: "10000000-0000-4000-8000-000000000000",
  provider: "ghl",
  eventId: "wh-1",
  type: "stage_changed",
  verified: true,
  payload: { contact_id: "c-1" },
  outcome: "updated",
  createdAt: "2026-10-07T08:00:00.000Z",
  updatedAt: "2026-10-07T08:00:00.000Z",
  ...over,
});

beforeEach(() => {
  startDashboard("/admin/sync-log");
  store.writes = [SUCCEEDED, FAILED, SKIPPED];
  store.webhooks = [
    webhook({}),
    webhook({
      id: "10000000-0000-4000-8000-000000000001",
      eventId: "refused:abc",
      type: "unknown",
      verified: false,
      outcome: "refused",
      createdAt: "2026-10-07T08:30:00.000Z",
    }),
  ];
  vi.mocked(retryWrite).mockClear();
});
afterEach(() => {
  cleanup();
  stopDashboard();
});

/** The desktop table's body rows (the phone cards repeat them below). */
const tableRows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);
const rowWith = (text: string) => {
  const row = tableRows().find((r) => r.textContent?.includes(text));
  if (!row) throw new Error(`no row with ${text}`);
  return within(row);
};
const listCalls = () =>
  api.calls().filter((call) => call.startsWith("GET /api/admin/sync-log"));

async function open() {
  renderScreen(<SyncLogScreen />);
  await screen.findByRole("table");
}

test("a rep gets the 403 panel, and the API refuses them", async () => {
  viewAs("rep");
  renderScreen(<SyncLogScreen />);
  expect(await screen.findByText("You do not have access")).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Go to the dashboard" }),
  ).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();

  const response = await fetch("/api/admin/sync-log");
  expect(response.status).toBe(403);
  const webhooks = await getWebhooks(
    new Request("http://localhost:3000/api/admin/sync-log/webhooks"),
  );
  expect(webhooks.status).toBe(403);
});

test("refused on the server: the 403 panel without asking again", async () => {
  renderScreen(<SyncLogScreen notAllowed />);
  expect(screen.getByText("You do not have access")).toBeDefined();
  expect(listCalls()).toEqual([]);
});

test("an admin sees every write newest first, with its key and attempts", async () => {
  await open();
  const keys = tableRows().map(
    (row) =>
      [FAILED, SKIPPED, SUCCEEDED].find((entry) =>
        row.textContent?.includes(entry.idempotencyKey),
      )?.id,
  );
  expect(keys).toEqual([FAILED.id, SKIPPED.id, SUCCEEDED.id]);
  expect(rowWith(FAILED.idempotencyKey).getByText("3")).toBeDefined();
  expect(rowWith(FAILED.idempotencyKey).getByText("W3 Qualification"));
});

test("filters by write type and result change the query", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Write type"), {
    target: { value: "w3_qualification" },
  });
  await waitFor(() =>
    expect(listCalls()).toContain(
      "GET /api/admin/sync-log?writeType=w3_qualification",
    ),
  );
  fireEvent.change(screen.getByLabelText("Result"), {
    target: { value: "failed" },
  });
  await waitFor(() =>
    expect(listCalls()).toContain(
      "GET /api/admin/sync-log?writeType=w3_qualification&result=failed",
    ),
  );
  await waitFor(() => expect(tableRows()).toHaveLength(1));
});

test("a write skipped because writes are off reads as skipped, not failed", async () => {
  await open();
  const row = rowWith(SKIPPED.idempotencyKey);
  expect(row.getByText("Skipped")).toBeDefined();
  expect(
    row.getByText("Writes to GHL are off. Nothing was sent."),
  ).toBeDefined();
  expect(row.queryByText("Failed")).toBeNull();
  expect(row.queryByRole("button", { name: /^Retry/ })).toBeNull();
  // Only the failed write offers Retry.
  expect(
    rowWith(FAILED.idempotencyKey).getByRole("button", { name: /^Retry/ }),
  ).toBeDefined();
});

test("Retry names the write it will cause, and only then retries", async () => {
  await open();
  fireEvent.click(
    rowWith(FAILED.idempotencyKey).getByRole("button", { name: /^Retry/ }),
  );
  const dialog = within(await screen.findByRole("alertdialog"));
  expect(dialog.getByText("Retry W3 Qualification?")).toBeDefined();
  expect(
    dialog.getByText(
      /sets Qualification Decision on the opportunity, and its stage \(Qualified or Lead Lost\)/,
    ),
  ).toBeDefined();
  expect(dialog.getByText("PUT /opportunities/opp-1")).toBeDefined();
  expect(dialog.getByText(FAILED.idempotencyKey)).toBeDefined();
  // The key never reaches GHL: a failed write may already have landed there.
  const warning = dialog.getByText(/may already have reached GHL/);
  expect(warning.textContent).toMatch(/timeout after GHL made the change/);
  expect(warning.textContent).toMatch(/Check the contact in GHL first/);
  expect(warning.textContent).toMatch(
    /can send the follow-up email from Lee's workflow a second time/,
  );
  expect(dialog.queryByText(/however many times/)).toBeNull();
  expect(retryWrite).not.toHaveBeenCalled();

  fireEvent.click(dialog.getByRole("button", { name: "Retry write" }));
  await waitFor(() => expect(retryWrite).toHaveBeenCalledWith(FAILED.id));
  expect(api.calls()).toContain(`POST /api/admin/sync-log/${FAILED.id}/retry`);
  expect(
    await screen.findByText("W3 Qualification failed again"),
  ).toBeDefined();
});

test("a retry the server refuses says why: replaced by a newer write, or no longer failed", async () => {
  vi.mocked(retryWrite).mockImplementationOnce(async () => {
    throw new AccessError("conflict");
  });
  await open();
  fireEvent.click(
    rowWith(FAILED.idempotencyKey).getByRole("button", { name: /^Retry/ }),
  );
  const dialog = within(await screen.findByRole("alertdialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Retry write" }));
  expect(
    await screen.findByText("This write can no longer be retried"),
  ).toBeDefined();
  expect(
    screen.getByText(
      "A newer write for this lead replaced it, or it is no longer failed. Nothing was sent.",
    ),
  ).toBeDefined();
});

test("Cancel on the retry dialog sends nothing", async () => {
  await open();
  fireEvent.click(
    rowWith(FAILED.idempotencyKey).getByRole("button", { name: /^Retry/ }),
  );
  const dialog = within(await screen.findByRole("alertdialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(retryWrite).not.toHaveBeenCalled();
});

test("the payload opens with the request and the response", async () => {
  await open();
  fireEvent.click(
    rowWith(FAILED.idempotencyKey).getByRole("button", { name: /^Payload/ }),
  );
  const sheet = within(await screen.findByRole("dialog"));
  expect(sheet.getByText("Request")).toBeDefined();
  expect(sheet.getByText(/"path": "\/opportunities\/opp-1"/)).toBeDefined();
  expect(sheet.getByText("Nothing recorded.")).toBeDefined();
  expect(sheet.getByText("GHL is unreachable")).toBeDefined();
});

test("the webhooks tab lists events with their outcome", async () => {
  await open();
  fireEvent.click(screen.getByRole("tab", { name: "Webhooks received" }));
  await waitFor(() =>
    expect(listCalls()).toContain("GET /api/admin/sync-log/webhooks"),
  );
  await waitFor(() =>
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      3,
    ),
  );
  const [refused, applied] = tableRows();
  expect(within(refused).getByText("Refused")).toBeDefined();
  expect(within(refused).getByText("No")).toBeDefined();
  expect(within(applied).getByText("Updated")).toBeDefined();
  expect(within(applied).getByText("Stage changed")).toBeDefined();
});

test("empty: the registry's copy, and a filtered view says it is filtered", async () => {
  store.writes = [];
  store.webhooks = [];
  renderScreen(<SyncLogScreen />);
  expect(await screen.findByText("No writes yet")).toBeDefined();
  expect(
    screen.getByText("Everything the app tells GHL lands here."),
  ).toBeDefined();
  expect(screen.queryByText("Filtered view")).toBeNull();

  fireEvent.change(screen.getByLabelText("Result"), {
    target: { value: "failed" },
  });
  expect(
    await screen.findByText("No writes match these filters"),
  ).toBeDefined();
  expect(screen.getByText("Filtered view")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(await screen.findByText("No writes yet")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Webhooks received" }));
  expect(await screen.findByText("No webhooks received yet")).toBeDefined();
});
