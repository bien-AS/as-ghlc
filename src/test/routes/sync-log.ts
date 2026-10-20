import { POST as postRetry } from "@/app/api/admin/sync-log/[id]/retry/route";
import { GET as getSyncLog } from "@/app/api/admin/sync-log/route";
import { GET as getWebhooks } from "@/app/api/admin/sync-log/webhooks/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/admin\/sync-log$/, getSyncLog],
  ["GET", /^\/api\/admin\/sync-log\/webhooks$/, getWebhooks],
  ["POST", /^\/api\/admin\/sync-log\/(?<id>[^/]+)\/retry$/, postRetry],
];
