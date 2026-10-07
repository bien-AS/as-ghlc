"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { type Crumb, TopNavbar } from "@/components/ui/top-navbar";
import { UserMenu } from "@/components/ui/user-menu";
import { useCurrentUser, useSignOut } from "@/hooks/use-auth";
import { useLoadedLeadName, usePipelineSummary } from "@/hooks/use-leads";
import { usePipelineHref } from "@/hooks/use-pipeline-href";
import { TimeZoneProvider } from "@/hooks/use-time-zone";

import {
  NAV_ITEMS,
  NOTIFICATIONS_HREF,
  navItemFor,
  PIPELINE_HREF,
  SUSPECTS_HREF,
} from "../navigation";

const SAMPLE_DATA_NOTE =
  "The leads shown are examples. Changes are not kept: they reset when the server restarts.";

/** Below this width the sidebar starts collapsed to icons (spec 04; the `wide` breakpoint). */
const WIDE = 1080;

/**
 * The frame around every dashboard screen (spec 04). This is the one place
 * that connects the reusable sidebar, navbar and user menu to the current
 * route and to data; none of them fetch anything themselves.
 */
export function DashboardShell({
  sidebarOpen,
  timeZone,
  sampleData,
  children,
}: {
  /** The remembered choice, or undefined when this browser has not made one. */
  sidebarOpen: boolean | undefined;
  timeZone: string;
  sampleData: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(sidebarOpen ?? true);

  useEffect(() => {
    // No remembered choice: the default depends on the width, which only the
    // browser knows. ponytail: on a first visit between 720px and 1080px the
    // sidebar is drawn expanded for one frame before this collapses it.
    if (sidebarOpen === undefined && window.innerWidth < WIDE) setOpen(false);
  }, [sidebarOpen]);

  return (
    <TimeZoneProvider initial={timeZone}>
      {/* SidebarProvider remembers a choice the person makes in a cookie. */}
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <Frame sampleData={sampleData}>{children}</Frame>
      </SidebarProvider>
    </TimeZoneProvider>
  );
}

function Frame({
  sampleData,
  children,
}: {
  sampleData: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const me = useCurrentUser();
  const summary = usePipelineSummary();
  const signOut = useSignOut();
  const pipelineHref = usePipelineHref();
  const main = useRef<HTMLElement>(null);

  // After moving to another screen, focus goes to its heading (or to the main
  // area while the screen is still loading). Not on the first load.
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const heading = main.current?.querySelector<HTMLElement>("h1");
    (heading ?? main.current)?.focus();
  }, [pathname]);

  const item = navItemFor(pathname);
  // /dashboard/leads/{id} and /dashboard/suspects/{id}
  const [, , section, leadId] = pathname.split("/");
  const leadName = useLoadedLeadName(
    section === "leads" || section === "suspects" ? leadId : undefined,
  );
  const crumbs: Crumb[] = !item
    ? [{ label: "Page not found" }]
    : section === "leads"
      ? [
          { label: "Pipeline", href: pipelineHref },
          { label: leadName ?? "Lead" },
        ]
      : section === "suspects" && leadId
        ? [
            { label: "Suspect review", href: SUSPECTS_HREF },
            { label: leadName ?? "Lead" },
          ]
        : [{ label: item.label }];

  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : "Account";

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-card px-3 py-2 font-semibold ring-1 ring-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar
        homeHref={PIPELINE_HREF}
        currentHref={item?.href}
        items={NAV_ITEMS.map(({ label, href, icon, built }) => ({
          label,
          href,
          icon,
          built,
          // No count rather than a zero or an error when it is unavailable.
          count:
            href === SUSPECTS_HREF ? summary.data?.needs.suspects : undefined,
        }))}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          crumbs={crumbs}
          searchAction={PIPELINE_HREF}
          onSearch={(text) =>
            router.push(
              text
                ? `${PIPELINE_HREF}?q=${encodeURIComponent(text)}`
                : PIPELINE_HREF,
            )
          }
          notificationsHref={NOTIFICATIONS_HREF}
          sampleDataNote={sampleData ? SAMPLE_DATA_NOTE : undefined}
          userMenu={
            <UserMenu
              name={name}
              email={me.data?.email ?? ""}
              compact={isMobile}
              sampleDataNote={sampleData ? SAMPLE_DATA_NOTE : undefined}
              signingOut={signOut.isPending || signOut.isSuccess}
              onSignOut={() => signOut.mutate()}
            />
          }
        />
        <main
          ref={main}
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6 outline-none nav:px-6"
        >
          {children}
        </main>
      </div>
    </>
  );
}
