"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Whole seconds remaining until a moment set by `start(seconds)`. Counts from
 * the clock, not from ticks, so a throttled background tab cannot stretch it.
 */
export function useCountdown(initialSeconds = 0) {
  // Both values come from ONE clock reading. Reading the clock twice lets a
  // millisecond pass in between, which rounds 60 seconds up to "61".
  const [{ now, endsAt }, setClock] = useState(() => {
    const at = Date.now();
    return { now: at, endsAt: at + initialSeconds * 1000 };
  });
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0) return;
    const id = setInterval(
      () => setClock((clock) => ({ ...clock, now: Date.now() })),
      250,
    );
    return () => clearInterval(id);
  }, [remaining]);

  const start = useCallback((seconds: number) => {
    const at = Date.now();
    setClock({ now: at, endsAt: at + seconds * 1000 });
  }, []);

  return [remaining, start] as const;
}
