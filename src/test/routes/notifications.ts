import { POST as postRead } from "@/app/api/notifications/[notificationId]/read/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { GET as getUnreadCount } from "@/app/api/notifications/unread-count/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/notifications$/, getNotifications],
  ["GET", /^\/api\/notifications\/unread-count$/, getUnreadCount],
  ["POST", /^\/api\/notifications\/(?<notificationId>[^/]+)\/read$/, postRead],
];
