import { z } from "zod";

import { notificationTypeSchema } from "@/lib/notifications/schemas";

/*
 * The account preferences contract: what one person has chosen for themselves.
 * Client-safe: no server-only imports. The theme is not here; it is kept in
 * the browser (spec 03).
 */

/**
 * Body of PUT /api/account/preferences and what GET returns. Every
 * notification type is present; true means it is shown in the app.
 */
export const accountPreferencesSchema = z.strictObject({
  notifications: z.record(notificationTypeSchema, z.boolean()),
});
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
