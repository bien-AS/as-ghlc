"use client";

import { WifiOffIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** The browser's connectivity, from its online and offline events. Online on the server. */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The offline banner (error-state-library): a full-width strip while the
 * browser reports no connection. The live region is always in the page, so
 * the message is announced when it appears. Amber ink on amber soft (RULES.md,
 * section 3); the icon and the words carry it, not the colour.
 */
function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  return (
    <div role="status" data-slot="offline-banner" className={className}>
      {!online && (
        <p
          className={cn(
            "flex items-center gap-2 border-b border-border bg-amber-soft px-4 py-2 text-small text-amber-ink nav:px-6",
            // Settles 4px down into place: it arrives under the navbar.
            "animate-in duration-200 ease-out fade-in slide-in-from-top-[4px]",
          )}
        >
          <WifiOffIcon size={16} aria-hidden="true" className="shrink-0" />
          <span>
            <span className="font-bold">You are offline.</span> Changes cannot
            be saved until the connection is back.
          </span>
        </p>
      )}
    </div>
  );
}

export { OfflineBanner };
