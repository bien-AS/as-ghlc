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

import DeckPresenterPage from "./page";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);
vi.mock(
  "next/navigation",
  async () => (await import("@/test/navigation")).navigationModule,
);

beforeEach(() => {
  startDashboard("/dashboard/deck-presenter");
  // In jsdom the page's query client is the browser's one, kept between renders.
  getQueryClient().clear();
});
afterEach(stopDashboard);

/** Renders the page for an address; gives what it prefetched and what it told the screen. */
async function page(search: Record<string, string> = {}) {
  const element = await DeckPresenterPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(search),
  });
  const state = element.props.state as DehydratedState;
  return {
    missing: element.props.children.props.missing as string | undefined,
    prefetched: state.queries.map((query) => query.queryKey.join("/")),
  };
}

test("with no lead in the address, prefetches the picker", async () => {
  expect(await page()).toEqual({
    missing: undefined,
    prefetched: ["decks/list"],
  });
});

test("with a lead, prefetches the lead, its deck and the call slots, and changes nothing", async () => {
  const leadId = await leadIdOf("Hannah Kowalczyk");
  const before = await getLead(leadId);
  expect(await page({ lead: leadId, slide: "3" })).toEqual({
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
  expect((await page({ lead: "lead-nope" })).missing).toBe("lead");

  const noDeck = await leadIdOf("Imogen Vasquez");
  expect(await page({ lead: noDeck })).toEqual({
    missing: "deck",
    prefetched: [`leads/detail/${noDeck}`],
  });

  // Another rep's lead does not exist for a staff member.
  const theirs = await leadIdOf("Reuben Castellanos");
  viewAs("staff");
  expect((await page({ lead: theirs })).missing).toBe("lead");
});

test("signed out, the page sends the visitor to sign in", async () => {
  const { fake } = await import("@/test/server-fakes");
  fake.claims = null;
  await expect(page({ lead: "lead-17" })).rejects.toThrow(
    /^redirect:\/sign-in/,
  );
});
