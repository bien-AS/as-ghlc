import type { AccountPreferences } from "@/lib/account/schemas";
import { sampleStore } from "@/lib/data/sample";
import { requireUser } from "@/lib/data/users";
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/lib/notifications/schemas";

/*
 * Data access for account preferences: what one person has chosen for
 * themselves. (Their name is on the User row: `updateProfile` in users.ts.)
 *
 * THE SEAM. Every exported function starts with the guard (`requireUser`) and
 * then reads or changes the sample store, which is keyed by user id, so a
 * person only ever reaches their own preferences. Going live means replacing
 * the bodies of the exported functions below with queries on a preferences
 * row. Schemas, Route Handlers, query options, hooks and components do not
 * change.
 */

const store = sampleStore("account-preferences", () => {
  return new Map<string, AccountPreferences>();
});

/** Until a person chooses otherwise, every notification type is on. */
const defaults = (): AccountPreferences => ({
  notifications: Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, true]),
  ) as Record<NotificationType, boolean>,
});

// ---------------------------------------------------------------------------
// The functions whose bodies change when real data arrives.
// ---------------------------------------------------------------------------

/** The current user's preferences. */
export async function getAccountPreferences(): Promise<AccountPreferences> {
  const user = await requireUser();
  return structuredClone(store().get(user.id) ?? defaults());
}

/** Replaces the current user's preferences. */
export async function updateAccountPreferences(
  input: AccountPreferences,
): Promise<AccountPreferences> {
  const user = await requireUser();
  store().set(user.id, structuredClone(input));
  return structuredClone(input);
}

/**
 * MOCK CHOICE (spec 08 lists notification preferences as out of scope): a
 * person can switch a notification type off, and a type switched off is left
 * out of their list and their unread count. This is the one function the
 * notifications module asks; to drop the idea, return an empty set here and
 * remove the panel from the Account settings screen.
 */
export async function mutedNotificationTypes(): Promise<Set<NotificationType>> {
  const { notifications } = await getAccountPreferences();
  return new Set(NOTIFICATION_TYPES.filter((type) => !notifications[type]));
}
