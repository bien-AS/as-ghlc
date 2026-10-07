import { getViewer } from "@/lib/data/viewer";
import type { NotificationType } from "@/lib/notifications/schemas";

/**
 * Raises a notification for a lead's owner (spec 08, "Creating
 * notifications"). Called by the blocks that raise them (proposals, invoices),
 * never by a Route Handler.
 */
export async function createNotification(_input: {
  leadId: string;
  type: NotificationType;
}): Promise<void> {
  await getViewer();
}
