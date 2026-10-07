import {
  GET as getPreferences,
  PUT as putPreferences,
} from "@/app/api/account/preferences/route";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/account\/preferences$/, getPreferences],
  ["PUT", /^\/api\/account\/preferences$/, putPreferences],
  ["PATCH", /^\/api\/profile$/, patchProfile],
];
