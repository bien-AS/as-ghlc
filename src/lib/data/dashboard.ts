import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { db } from "@/db/client";
import {
  decks,
  leadStatusEvents,
  leads,
  profiles,
  statusDefs,
} from "@/db/schema";
import {
  discovery,
  isOpen,
  leadName,
  review,
  toActivity,
} from "@/lib/data/leads";
import { leadScope, requireProfile } from "@/lib/data/users";
import type { Dashboard } from "@/lib/leads/schemas";

/*
 * The dashboard (spec 07): three tiles, "needs you now" and recent activity,
 * all live counts over the viewer's leads (`leadScope`), archived leads left
 * out. The nightly KPI rollup the registry names (schema draft Q11) is
 * DROPPED: at this volume the live counts are cheap, and no table holds a
 * rollup. `db` is the privileged connection (ADR-0007); the guard and the
 * scope are the access check.
 */

/** How many of each list "needs you now" and the activity feed show. */
const LIST_LIMIT = 20;

const count = (condition: SQL | undefined) =>
  sql<number>`count(*) filter (where ${condition})`.mapWith(Number);

/** A booked call in the next 48 hours. */
const within48h = (at: SQL) =>
  sql`${at} between now() and now() + interval '48 hours'`;

export async function getDashboard(query: { tz: string }): Promise<Dashboard> {
  const viewer = await requireProfile();
  const mine = and(leadScope(viewer), isNull(leads.deletedAt));
  const callSoon = or(within48h(discovery), within48h(review)) as SQL;
  const suspect = and(isOpen, eq(leads.verdict, "suspect"));
  const ref = {
    id: leads.id,
    firstName: leads.firstName,
    lastName: leads.lastName,
    email: leads.email,
  };

  const [[tiles], suspects, callsWithoutDeck, pastThreshold, events] =
    await Promise.all([
      db
        .select({
          newThisWeek: count(
            sql`${leads.createdAt} >= date_trunc('week', now() at time zone ${query.tz}) at time zone ${query.tz}`,
          ),
          suspects: count(suspect),
          // A lead can have both calls in the window: each call counts.
          discoveryCalls: count(within48h(discovery)),
          reviewCalls: count(within48h(review)),
        })
        .from(leads)
        .where(mine),
      db
        .select({ ...ref, time: leads.createdAt })
        .from(leads)
        .where(and(mine, suspect))
        .orderBy(asc(leads.createdAt))
        .limit(LIST_LIMIT),
      db
        .select({
          ...ref,
          time: sql<Date>`least(${discovery}, ${review})`.mapWith(
            leads.discoveryBookingAt,
          ),
        })
        .from(leads)
        .where(
          and(
            mine,
            isOpen,
            callSoon,
            notExists(
              db
                .select({ one: sql`1` })
                .from(decks)
                .where(
                  and(
                    eq(decks.leadId, leads.id),
                    isNull(decks.deletedAt),
                    inArray(decks.status, ["generating", "ready"]),
                  ),
                ),
            ),
          ),
        )
        .orderBy(sql`least(${discovery}, ${review})`)
        .limit(LIST_LIMIT),
      // status_defs.threshold_days is null for every status today (spec 14
      // sets them), so this finds none until it is filled in.
      db
        .select({ ...ref, time: leads.lastActivityAt })
        .from(leads)
        .innerJoin(statusDefs, eq(statusDefs.value, leads.leadStatus))
        .where(
          and(
            mine,
            isOpen,
            isNotNull(statusDefs.thresholdDays),
            sql`${leads.lastActivityAt} < now() - ${statusDefs.thresholdDays} * interval '1 day'`,
          ),
        )
        .orderBy(asc(leads.lastActivityAt))
        .limit(LIST_LIMIT),
      db
        .select({
          event: leadStatusEvents,
          actor: { firstName: profiles.firstName, lastName: profiles.lastName },
          lead: ref,
        })
        .from(leadStatusEvents)
        .innerJoin(leads, eq(leads.id, leadStatusEvents.leadId))
        .leftJoin(profiles, eq(profiles.id, leadStatusEvents.actorId))
        .where(mine)
        .orderBy(desc(leadStatusEvents.createdAt))
        .limit(LIST_LIMIT),
    ]);

  const needs = (
    rows: (Parameters<typeof leadName>[0] & {
      id: string;
      time: Date | null;
    })[],
    reason: Dashboard["needsYou"][number]["reason"],
  ) =>
    rows.map((row) => ({
      lead: { id: row.id, name: leadName(row) },
      reason,
      time: row.time?.toISOString() ?? null,
    }));

  return {
    newThisWeek: tiles.newThisWeek,
    suspects: tiles.suspects,
    callsNext48h: tiles.discoveryCalls + tiles.reviewCalls,
    needsYou: [
      ...needs(suspects, "suspect"),
      ...needs(callsWithoutDeck, "call_without_deck"),
      ...needs(pastThreshold, "past_threshold"),
    ],
    activity: events.map((row) => ({
      ...toActivity(row),
      lead: { id: row.lead.id, name: leadName(row.lead) },
    })),
  };
}
