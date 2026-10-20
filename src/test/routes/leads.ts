import { POST as postArchive } from "@/app/api/leads/[leadId]/archive/route";
import { POST as postAssign } from "@/app/api/leads/[leadId]/assign/route";
import {
  GET as getResearch,
  POST as postResearch,
} from "@/app/api/leads/[leadId]/research/route";
import { POST as postStatus } from "@/app/api/leads/[leadId]/status/route";
import { GET as getStatusDefs } from "@/app/api/status-defs/route";
import type { TestRoute } from "@/test/dashboard";

/** The lead routes src/test/dashboard.tsx does not list itself, and the Lead Status picklist. */
export const routes: TestRoute[] = [
  ["GET", /^\/api\/status-defs$/, getStatusDefs],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/status$/, postStatus],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/assign$/, postAssign],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/archive$/, postArchive],
  ["GET", /^\/api\/leads\/(?<leadId>[^/]+)\/research$/, getResearch],
  ["POST", /^\/api\/leads\/(?<leadId>[^/]+)\/research$/, postResearch],
];
