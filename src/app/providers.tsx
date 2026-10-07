"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect } from "react";

import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyTheme, useTheme } from "@/hooks/use-theme";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  // Subscribing here keeps the app following the device setting and other tabs
  // on every page, whether or not a theme switch is on screen.
  useTheme();
  // The inline script in layout.tsx sets the theme before paint. React's dev
  // Strict Mode remount resets <html>'s class, so re-apply; a no-op in production.
  useLayoutEffect(() => applyTheme(), []);

  return (
    <QueryClientProvider client={getQueryClient()}>
      <TooltipProvider delay={300}>
        <Toaster>{children}</Toaster>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
