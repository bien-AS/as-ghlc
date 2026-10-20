import type { DehydratedState } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getLead } from "@/lib/data/leads";
import { getQueryClient } from "@/lib/query-client";
import {
  leadIdOf,
  startDashboard,
  stopDashboard,
  viewAs,
} from "@/test/dashboard";

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

beforeEach(() => {
  startDashboard("/decks/lead-01");
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
  const leadId = await leadIdOf("Hannah Kowalczyk");
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

  const noDeck = await leadIdOf("Imogen Vasquez");
  expect(await page(noDeck)).toEqual({
    missing: "deck",
    prefetched: [`leads/detail/${noDeck}`],
  });

  // Another rep's lead does not exist for a rep.
  const theirs = await leadIdOf("Reuben Castellanos");
  viewAs("rep");
  expect((await page(theirs)).missing).toBe("lead");
});

test("signed out, the page sends the visitor to sign in", async () => {
  const { fake } = await import("@/test/server-fakes");
  fake.claims = null;
  await expect(page("lead-17")).rejects.toThrow(/^redirect:\/login/);
});
