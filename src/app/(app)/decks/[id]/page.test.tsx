import type { DehydratedState } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getLead } from "@/lib/data/leads";
import { getQueryClient } from "@/lib/query-client";
import { startDashboard, stopDashboard, viewAs } from "@/test/dashboard";
import { resetStandIns, standIns } from "@/test/mockup-stand-ins";

import DeckPage from "./page";

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
// Leads live in Postgres; the page reaches them only through these.
vi.mock("@/lib/data/leads", async (original) => ({
  ...(await original<typeof import("@/lib/data/leads")>()),
  ...(await import("@/test/mockup-stand-ins")).mockupLeadsModule,
}));

/*
 * A real lead has no deck yet (spec 09). The sample rep's Stand-in 1 and
 * another rep's Stand-in 3 are given one; Stand-in 5 has none.
 */
const WITH_DECK = "stand-in-1";
const THEIRS = "stand-in-3";
const NO_DECK = "stand-in-5";

beforeEach(() => {
  startDashboard("/decks/stand-in-1");
  resetStandIns();
  for (const id of [WITH_DECK, THEIRS]) {
    standIns.patch.set(id, {
      deck: {
        templateName: "Discovery",
        viewUrl: "https://decks.example/view",
        pdfUrl: "https://decks.example/pdf",
      },
    });
  }
  // In jsdom the page's query client is the browser's one, kept between renders.
  getQueryClient().clear();
});
afterEach(stopDashboard);

/** Renders the page for a lead's deck; gives what it prefetched and what it told the screen. */
async function page(id: string, search: Record<string, string> = {}) {
  const element = await DeckPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(search),
  });
  const state = element.props.state as DehydratedState;
  return {
    missing: element.props.children.props.missing as string | undefined,
    prefetched: state.queries.map((query) => query.queryKey.join("/")),
  };
}

test("with a lead, prefetches the lead, its deck and the call slots, and changes nothing", async () => {
  const leadId = WITH_DECK;
  const before = await getLead(leadId);
  expect(await page(leadId, { slide: "3" })).toEqual({
    missing: undefined,
    prefetched: [
      `leads/detail/${leadId}`,
      `decks/detail/${leadId}`,
      `decks/slots/${leadId}`,
    ],
  });
  // A page must not write during render.
  expect(await getLead(leadId)).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});

test("tells the screen which is missing: the lead, or only its deck", async () => {
  expect((await page("lead-nope")).missing).toBe("lead");

  // A lead without a deck, as every real lead is today.
  expect(await page(NO_DECK)).toEqual({
    missing: "deck",
    prefetched: [`leads/detail/${NO_DECK}`],
  });

  // Another rep's lead does not exist for a rep.
  viewAs("rep");
  expect((await page(THEIRS)).missing).toBe("lead");
});

test("signed out, the page sends the visitor to sign in", async () => {
  const { fake } = await import("@/test/server-fakes");
  fake.claims = null;
  await expect(page("lead-17")).rejects.toThrow(/^redirect:\/login/);
});
