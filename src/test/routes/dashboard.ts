import { GET as getDashboard } from "@/app/api/dashboard/route";
import type { TestRoute } from "@/test/dashboard";

export const routes: TestRoute[] = [
  ["GET", /^\/api\/dashboard$/, getDashboard],
];
