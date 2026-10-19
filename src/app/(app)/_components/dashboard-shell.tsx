"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppSidebar } from "@/components/ui/app-sidebar";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { type Crumb, TopNavbar } from "@/components/ui/top-navbar";
import { UserMenu } from "@/components/ui/user-menu";
import { useCurrentUser, useSignOut } from "@/hooks/use-auth";
import { useLoadedLeadName, usePipelineSummary } from "@/hooks/use-leads";
import { useUnreadCount } from "@/hooks/use-notifications";
import { usePipelineHref } from "@/hooks/use-pipeline-href";
import { TimeZoneProvider } from "@/hooks/use-time-zone";
import { useViewer } from "@/hooks/use-viewer";
import { isLive } from "@/lib/flags";
import { can } from "@/lib/roles";

import {
  DASHBOARD_HREF,
  LEADS_HREF,
  NAV_ITEMS,
  NOTIFICATIONS_HREF,
  navItemFor,
  PROFILE_SETTINGS_HREF,
  REVIEW_QUEUE_HREF,
  titleFor,
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isMobile } = useSidebar();
  const me = useCurrentUser();
  const summary = usePipelineSummary();
  // No count rather than a zero or an error when it is unavailable.
  const unread = useUnreadCount() || undefined;
  const signOut = useSignOut();
  const viewer = useViewer();
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
  // /leads/{id}, and /review-queue?lead={id}
  const [, section, id] = pathname.split("/");
  const leadId =
    section === "leads"
      ? id
      : section === "review-queue"
        ? (searchParams.get("lead") ?? undefined)
        : undefined;
  const leadName = useLoadedLeadName(leadId);
  // A crumb links only to a live screen (spec 01, phase flags).
  const crumb = (label: string, href: string, screen: string): Crumb =>
    isLive(screen) ? { label, href } : { label };
  const title = titleFor(pathname);
  const crumbs: Crumb[] = !title
    ? [{ label: "Page not found" }]
    : section === "leads" && leadId
      ? [
          crumb("Leads", pipelineHref, "lead-list"),
          { label: leadName ?? "Lead" },
        ]
      : section === "review-queue" && leadId
        ? [
            crumb("Review Queue", REVIEW_QUEUE_HREF, "suspect-review-queue"),
            { label: leadName ?? "Lead" },
          ]
        : [{ label: title }];

  // Hiding is not the control (spec 12): the server refuses a role that types
  // the address. Until the role is known, only what every role has is listed.
  // An entry is listed only while its screen is live (spec 01, phase flags).
  const role = viewer.data?.role;
  const group = (name: "work" | "admin") =>
    NAV_ITEMS.filter(
      (entry) =>
        entry.group === name &&
        isLive(entry.screen) &&
        (!entry.requires || (role !== undefined && can(role, entry.requires))),
    ).map(({ label, href, icon }) => ({
      label,
      href,
      icon,
      built: true,
      // No count rather than a zero or an error when it is unavailable.
      ...(href === REVIEW_QUEUE_HREF && {
        count: summary.data?.needs.suspects,
      }),
      ...(href === NOTIFICATIONS_HREF && {
        count: unread,
        countLabel: "unread",
      }),
    }));

  const name = me.data ? `${me.data.firstName} ${me.data.lastName}` : "Account";
  const searchable = isLive("lead-list");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-card px-3 py-2 font-semibold ring-1 ring-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar
        homeHref={DASHBOARD_HREF}
        currentHref={item?.href}
        groups={[
          { items: group("work") },
          { label: "Admin", items: group("admin") },
        ]}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          crumbs={crumbs}
          searchAction={searchable ? LEADS_HREF : undefined}
          onSearch={(text) =>
            router.push(
              text ? `${LEADS_HREF}?q=${encodeURIComponent(text)}` : LEADS_HREF,
            )
          }
          notificationsHref={
            isLive("notifications-center") ? NOTIFICATIONS_HREF : undefined
          }
          unreadCount={unread}
          sampleDataNote={sampleData ? SAMPLE_DATA_NOTE : undefined}
          userMenu={
            <UserMenu
              name={name}
              email={me.data?.email ?? ""}
              settingsHref={
                isLive("profile-settings") ? PROFILE_SETTINGS_HREF : undefined
              }
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
