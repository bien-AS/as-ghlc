"use client";

import { useSyncExternalStore } from "react";

const KEY = "dealwright:pipeline-search";
const PIPELINE = "/dashboard";
const subscribe = () => () => {};

/** Called by the Pipeline whenever its filters change. */
export function rememberPipelineSearch(search: string) {
  try {
    sessionStorage.setItem(KEY, search);
  } catch {
    // Storage blocked: "back" goes to the unfiltered Pipeline.
  }
}

/**
 * The way back to the Pipeline with the filters the rep last had there
 * (spec 06). Per tab; the plain Pipeline on the server and on a first visit.
 */
export function usePipelineHref() {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        const search = sessionStorage.getItem(KEY);
        return search ? `${PIPELINE}?${search}` : PIPELINE;
      } catch {
        return PIPELINE;
      }
    },
    () => PIPELINE,
  );
}
