import { z } from "zod";

/*
 * The notification contract (spec 08), shaped after spec 09's sketch, whose
 * field lists are assumed. Client-safe: no server-only imports, no fixtures.
 */

/** The three types named in the source documents (spec 08). */
export const NOTIFICATION_TYPES = [
  "suspect_to_review",
  "proposal_signed",
  "invoice_draft_ready",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

/** One row of the Notifications screen. It belongs to one user and links to one lead. */
export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  /** For display and for the link; the lead itself is read through spec 06. */
  lead: z.object({
    id: z.string(),
    name: z.string(),
    company: z.string().nullable(),
  }),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const NOTIFICATIONS_PAGE_SIZE = 10;

/** Query of GET /api/notifications. Every value arrives as text from the address. */
export const listNotificationsQuerySchema = z.strictObject({
  /** Opaque: the `nextCursor` of the page before. */
  cursor: z.string().max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(NOTIFICATIONS_PAGE_SIZE),
});
export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

/** Newest first. */
export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/** What GET /api/notifications/unread-count returns. */
export const unreadCountSchema = z.object({ count: z.number().int().min(0) });
export type UnreadCount = z.infer<typeof unreadCountSchema>;
