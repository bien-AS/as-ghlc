import { mutedNotificationTypes } from "@/lib/data/account";
import { listVisibleLeads } from "@/lib/data/leads";
import { sampleStore } from "@/lib/data/sample";
import { AccessError } from "@/lib/data/users";
import { getViewer, type Viewer } from "@/lib/data/viewer";
import type { LeadDetail } from "@/lib/leads/schemas";
import type {
  ListNotificationsQuery,
  Notification,
  NotificationPage,
  NotificationType,
  UnreadCount,
} from "@/lib/notifications/schemas";
import { can } from "@/lib/roles";

/*
 * Data access for notifications (spec 08; ADR-0006).
 *
 * THE SEAM. Every exported function starts with the guard (`getViewer`: the
 * current user, then their role) and then reads or changes the sample store.
 * Going live means replacing the bodies of the exported functions below with
 * queries on the Notification table, filtered by the current user, and
 * deleting `seed`. `createNotification` then also sends the "refetch now"
 * signal (spec 08, Supabase Realtime Broadcast), which is NOT built here.
 * Schemas, Route Handlers, query options, hooks and components do not change.
 *
 * There is no fixtures file: sample notifications are derived from the sample
 * leads, read only through `listVisibleLeads`.
 */

/**
 * Question 7 (ASSUMED; undecided for admins and owners): a notification goes
 * to the lead's owner, and admins and owners also see every lead's. False
 * means only the lead's owner is notified.
 */
const ADMINS_AND_OWNERS_NOTIFIED_FOR_EVERY_LEAD = true;

const isNotified = (viewer: Viewer, lead: LeadDetail) =>
  lead.owner.id === viewer.repId ||
  (ADMINS_AND_OWNERS_NOTIFIED_FOR_EVERY_LEAD &&
    can(viewer.role, "see_all_leads"));

type Stored = {
  id: string;
  type: NotificationType;
  leadId: string;
  read: boolean;
  createdAt: string;
};

// ponytail: one read flag per notification, not per user. Every preview role
// is the same signed-in person, so that is all the sample needs; the real
// table has one row per user.
const store = sampleStore("notifications", () => ({
  /** Leads whose sample notifications have been derived. */
  seeded: new Set<string>(),
  items: [] as Stored[],
}));

const idOf = (leadId: string, type: NotificationType) =>
  `ntf-${leadId}-${type}`;

/** A fixed two in three start unread, chosen by the id so it never changes. */
const startsUnread = (id: string) =>
  [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3 !==
  0;

/** The sample notifications a lead's state implies, timed from its timeline. */
function seed(lead: LeadDetail): Stored[] {
  const at = (activity: string) =>
    lead.activities.find((entry) => entry.type === activity)?.time ??
    lead.updatedAt;
  const raised: [NotificationType, string][] = [];
  if (lead.verdict === "suspect" && !lead.exit) {
    raised.push(["suspect_to_review", at("Verdict")]);
  }
  if (lead.stage === "won" && lead.proposal?.status === "signed") {
    raised.push(["proposal_signed", at("Proposal signed")]);
  }
  if (lead.invoice?.status === "draft") {
    raised.push(["invoice_draft_ready", at("Invoice drafted")]);
  }
  return raised.map(([type, createdAt]) => {
    const id = idOf(lead.id, type);
    return { id, type, leadId: lead.id, read: !startsUnread(id), createdAt };
  });
}

/**
 * The leads the viewer may see, by id, after deriving the notifications of any
 * lead not seen before. `listVisibleLeads` is filtered by role, so the store
 * cannot be built from one call: a Staff preview sees fewer leads than an Owner.
 */
async function visibleLeads() {
  const { seeded, items } = store();
  const leads = new Map<string, LeadDetail>();
  for (const lead of await listVisibleLeads()) {
    if (!seeded.has(lead.id)) {
      seeded.add(lead.id);
      items.push(...seed(lead));
    }
    leads.set(lead.id, lead);
  }
  return leads;
}

/** The viewer's notifications with their leads, newest first. */
async function mine(viewer: Viewer) {
  const leads = await visibleLeads();
  return store()
    .items.flatMap((item, order) => {
      const lead = leads.get(item.leadId);
      return lead && isNotified(viewer, lead) ? [{ item, lead, order }] : [];
    })
    .sort(
      (a, b) =>
        b.item.createdAt.localeCompare(a.item.createdAt) ||
        // Raised at the same moment: the one raised later comes first.
        b.order - a.order,
    );
}

/** Without the types this person has switched off. */
async function shown(viewer: Viewer) {
  const muted = await mutedNotificationTypes();
  return (await mine(viewer)).filter(({ item }) => !muted.has(item.type));
}

const toNotification = ({
  item,
  lead,
}: {
  item: Stored;
  lead: LeadDetail;
}): Notification => ({
  id: item.id,
  type: item.type,
  lead: { id: lead.id, name: lead.name, company: lead.company },
  read: item.read,
  createdAt: item.createdAt,
});

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** A page of the current user's notifications, newest first. */
export async function listNotifications(
  query: ListNotificationsQuery,
): Promise<NotificationPage> {
  const all = await shown(await getViewer());

  // The cursor is the id of the last notification already shown, so a
  // notification that arrives in between moves nothing the user is reading.
  // An id that is no longer in the list starts again from the top.
  const start = query.cursor
    ? all.findIndex(({ item }) => item.id === query.cursor) + 1
    : 0;
  const page = all.slice(start, start + query.limit);
  return {
    items: page.map(toNotification),
    nextCursor:
      start + query.limit < all.length ? (page.at(-1)?.item.id ?? null) : null,
  };
}

/** How many of the current user's notifications are unread. */
export async function getUnreadCount(): Promise<UnreadCount> {
  const all = await shown(await getViewer());
  return { count: all.filter(({ item }) => !item.read).length };
}

/**
 * Marks one notification read. Safe to call twice. An unknown id and another
 * user's notification answer the same: `not_found`.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<Notification> {
  const found = (await mine(await getViewer())).find(
    ({ item }) => item.id === notificationId,
  );
  if (!found) throw new AccessError("not_found");
  found.item.read = true;
  return toNotification(found);
}

/**
 * Raises a notification for a lead's owner (spec 08, "Creating
 * notifications"). Called by the blocks that raise them (proposals, invoices),
 * never by a Route Handler. Written idempotently: a lead has at most one
 * notification of each type, so raising it again changes nothing.
 */
export async function createNotification(input: {
  leadId: string;
  type: NotificationType;
}): Promise<void> {
  await getViewer();
  // Deriving first means a lead seen here for the first time is not given the
  // same notification twice (once from its state, once from this call).
  const leads = await visibleLeads();
  if (!leads.has(input.leadId)) throw new AccessError("not_found");

  const id = idOf(input.leadId, input.type);
  const { items } = store();
  if (items.some((item) => item.id === id)) return;
  items.push({
    id,
    type: input.type,
    leadId: input.leadId,
    read: false,
    createdAt: new Date().toISOString(),
  });
}
