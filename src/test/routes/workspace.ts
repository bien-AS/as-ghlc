import { DELETE as deleteDomain } from "@/app/api/workspace/domains/[domain]/route";
import { POST as postDomain } from "@/app/api/workspace/domains/route";
import {
  GET as getWorkspace,
  PUT as putWorkspace,
} from "@/app/api/workspace/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/workspace$/, getWorkspace],
  ["PUT", /^\/api\/workspace$/, putWorkspace],
  ["POST", /^\/api\/workspace\/domains$/, postDomain],
  ["DELETE", /^\/api\/workspace\/domains\/(?<domain>[^/]+)$/, deleteDomain],
];
