"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server's HTML and until React has attached its handlers, true
 * from then on. A form's submit control is disabled while this is false, so a
 * press before hydration cannot trigger the browser's own submit, which would
 * bypass `onSubmit` entirely.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
