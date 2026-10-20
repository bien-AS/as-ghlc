// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  checkGhlIds,
  ghlConfig,
  ghlRequest,
  leadFromGhl,
  searchPipelineOpportunities,
} from "@/lib/services/ghl";
import { TEST_IDS } from "@/test/ghl-ids";

const TOKEN = "pit-test-token-0123456789";

/** What the location holds: every id above. */
function location() {
  return {
    contact: Object.entries(TEST_IDS.contactFields).map(([key, id]) => ({
      id,
      fieldKey: `contact.${key}`,
    })),
    opportunity: Object.entries(TEST_IDS.opportunityFields).map(
      ([key, id]) => ({ id, fieldKey: `opportunity.${key}` }),
    ),
    pipelines: [
      {
        id: "pipe",
        stages: Object.values(TEST_IDS.stages).map((id) => ({ id })),
      },
    ],
    calendars: [{ id: "cal-ds" }, { id: "cal-pr" }, { id: "cal-other" }],
  };
}

function stubGhl(held = location()) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith("/customFields")) {
      const model = searchParams.get("model") as "contact" | "opportunity";
      return Response.json({ customFields: held[model] });
    }
    if (pathname === "/opportunities/pipelines") {
      return Response.json({ pipelines: held.pipelines });
    }
    if (pathname === "/calendars/") {
      return Response.json({ calendars: held.calendars });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("GHL_PRIVATE_TOKEN", TOKEN);
  vi.stubEnv("GHL_LOCATION_ID", "loc-1");
  vi.stubEnv("GHL_IDS", JSON.stringify(TEST_IDS));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("the startup check resolves every configured id", async () => {
  const fetchMock = stubGhl();
  expect(await checkGhlIds()).toEqual([]);
  // Opportunity fields are only visible with ?model=opportunity.
  expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
    "https://services.leadconnectorhq.com/locations/loc-1/customFields?model=opportunity",
  );
});

test("the startup check names the id that is wrong", async () => {
  stubGhl();
  vi.stubEnv(
    "GHL_IDS",
    JSON.stringify({
      ...TEST_IDS,
      opportunityFields: {
        ...TEST_IDS.opportunityFields,
        lead_status: "of-gone",
      },
      stages: { ...TEST_IDS.stages, Qualified: "s-gone" },
    }),
  );
  expect(await checkGhlIds()).toEqual([
    "opportunityFields.lead_status (of-gone)",
    "stages.Qualified (s-gone)",
  ]);
});

test("a field id configured under the wrong key is caught", async () => {
  stubGhl();
  vi.stubEnv(
    "GHL_IDS",
    JSON.stringify({
      ...TEST_IDS,
      contactFields: {
        ...TEST_IDS.contactFields,
        validation_status: "cf-validation_summary",
      },
    }),
  );
  expect(await checkGhlIds()).toEqual([
    "contactFields.validation_status (cf-validation_summary)",
  ]);
});

test("GHL_IDS missing a stage fails naming it", () => {
  const { Nurturing: _, ...stages } = TEST_IDS.stages;
  vi.stubEnv("GHL_IDS", JSON.stringify({ ...TEST_IDS, stages }));
  expect(() => ghlConfig()).toThrow(/Nurturing/);
});

test("every request sends the token, the API version and an explicit user agent", async () => {
  const fetchMock = stubGhl();
  await checkGhlIds();
  const headers = fetchMock.mock.calls[0][1]?.headers;
  expect(headers).toMatchObject({
    Authorization: `Bearer ${TOKEN}`,
    Version: "2021-07-28",
    "User-Agent": "as-sales-app/1.0",
  });
});

test("a 429 is retried after the window GHL asks for, then succeeds", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("slow down", {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Interval-Milliseconds": "10000",
        },
      }),
    )
    .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);

  const result = ghlRequest("/anything");
  await vi.advanceTimersByTimeAsync(9_999);
  expect(fetchMock).toHaveBeenCalledTimes(1); // the 10s window, not the 1s floor
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(2_000); // then exponential: 2s
  expect(await result).toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test("check 11: an error never carries the token, even when GHL echoes it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(`{"message":"bad token Bearer ${TOKEN}"}`, {
          status: 401,
        }),
    ),
  );
  const error = await ghlRequest("/contacts/x").catch((e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("GHL 401 on GET /contacts/x");
  expect((error as Error).message).not.toContain(TOKEN);
  expect(JSON.stringify(error)).not.toContain(TOKEN);
});

test("search pages with startAfter / startAfterId and stops on a short page", async () => {
  const full = Array.from({ length: 100 }, (_, i) => ({
    id: `opp-${i}`,
    contactId: `c-${i}`,
    pipelineId: "pipe",
    pipelineStageId: "s-new",
  }));
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        opportunities: full,
        meta: { startAfter: 111, startAfterId: "opp-99" },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        opportunities: full.slice(0, 3),
        meta: { startAfter: 222, startAfterId: "opp-2" },
      }),
    );
  vi.stubGlobal("fetch", fetchMock);

  const first = await searchPipelineOpportunities(null);
  expect(first.next).toEqual({ startAfter: 111, startAfterId: "opp-99" });
  const second = await searchPipelineOpportunities(first.next);
  expect(second.next).toBeNull();
  const url = new URL(fetchMock.mock.calls[1][0]);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    location_id: "loc-1",
    pipeline_id: "pipe",
    limit: "100",
    startAfter: "111",
    startAfterId: "opp-99",
  });
});

test("the copy mirrors GHL's names: stage by id, Lead Status by value", () => {
  const copy = leadFromGhl(
    {
      id: "opp-1",
      contactId: "c-1",
      pipelineId: "pipe",
      pipelineStageId: "s-qual",
      assignedTo: null,
      updatedAt: "2026-10-01T00:00:00.000Z",
      customFields: [
        { id: "of-lead_status", fieldValueString: "Qualified - Negotiating" },
      ],
    },
    {
      id: "c-1",
      firstName: "Ada",
      customFields: [{ id: "cf-lead_source", value: "Get Started form" }],
    },
  );
  expect(copy).toMatchObject({
    stage: "Qualified",
    leadStatus: "Qualified - Negotiating",
    leadSource: "Get Started form",
    ghlAssignedUserId: null,
    lastName: null,
    lastActivityAt: new Date("2026-10-01T00:00:00.000Z"),
  });
});
