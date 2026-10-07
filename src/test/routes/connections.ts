import { POST as postImport } from "@/app/api/connections/[type]/import/route";
import {
  DELETE as deleteConnection,
  POST as postConnection,
} from "@/app/api/connections/[type]/route";
import {
  GET as getStageMapping,
  PUT as putStageMapping,
} from "@/app/api/connections/[type]/stage-mapping/route";
import { POST as postSync } from "@/app/api/connections/[type]/sync/route";
import { GET as getConnections } from "@/app/api/connections/route";
import type { TestRoute } from "@/test/dashboard";

const one = "^\\/api\\/connections\\/(?<type>[^/]+)";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/connections$/, getConnections],
  ["POST", new RegExp(`${one}$`), postConnection],
  ["DELETE", new RegExp(`${one}$`), deleteConnection],
  ["POST", new RegExp(`${one}\\/sync$`), postSync],
  ["POST", new RegExp(`${one}\\/import$`), postImport],
  ["GET", new RegExp(`${one}\\/stage-mapping$`), getStageMapping],
  ["PUT", new RegExp(`${one}\\/stage-mapping$`), putStageMapping],
];
