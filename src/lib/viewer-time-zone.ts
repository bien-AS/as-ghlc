import { cookies } from "next/headers";

import { TIME_ZONE_COOKIE } from "@/hooks/use-time-zone";
import { leadFiltersSchema } from "@/lib/leads/schemas";

/**
 * The viewer's time zone as their browser last reported it (a cookie written
 * by TimeZoneProvider), so a Server Component prefetches "calls today" and
 * prints times for the right day. UTC on a first visit or for a bad value.
 */
export async function getViewerTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return leadFiltersSchema.shape.tz.parse(value);
}
