import { POST as postViewerRole } from "@/app/api/viewer/role/route";
import { GET as getViewer } from "@/app/api/viewer/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/viewer$/, getViewer],
  ["POST", /^\/api\/viewer\/role$/, postViewerRole],
];
