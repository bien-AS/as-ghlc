"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

/** Read by the dashboard layout so the server renders times as the viewer will. */
export const TIME_ZONE_COOKIE = "tz";

const TimeZoneContext = createContext("UTC");

const subscribe = () => () => {};
const browserZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/**
 * The viewer's time zone, for "calls today" and for every time on screen.
 * The server renders with `initial` (the zone this browser reported last time,
 * or UTC on a first visit); the browser's own zone takes over after hydration
 * and is remembered in a cookie for the next server render.
 */
export function TimeZoneProvider({
  initial,
  children,
}: {
  initial: string;
  children: React.ReactNode;
}) {
  const zone = useSyncExternalStore(subscribe, browserZone, () => initial);

  useEffect(() => {
    if (zone !== initial) {
      // biome-ignore lint/suspicious/noDocumentCookie: a one-line preference cookie; the Cookie Store API is not in every supported browser
      document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [zone, initial]);

  return <TimeZoneContext value={zone}>{children}</TimeZoneContext>;
}

/** "UTC" outside a provider, which keeps tests independent of the machine. */
export function useTimeZone() {
  return useContext(TimeZoneContext);
}
