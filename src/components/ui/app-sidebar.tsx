"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

export type AppSidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** False for a screen that is still a placeholder: marked "Soon". */
  built: boolean;
  /** How many things wait behind this item. Left out when unknown. */
  count?: number;
};

/**
 * The dashboard's left navigation (spec 04): the wordmark, the built screens,
 * a divider, then the unbuilt ones marked "Soon". Collapses to icons, with
 * each label as a tooltip, and becomes a sheet below the `nav` breakpoint.
 */
function AppSidebar({
  items,
  currentHref,
  homeHref,
}: {
  items: AppSidebarItem[];
  /** The `href` of the item for the current screen. */
  currentHref?: string;
  homeHref: string;
}) {
  const { setOpenMobile } = useSidebar();
  const closeSheet = () => setOpenMobile(false);

  const group = (built: boolean) => (
    <SidebarGroup>
      <SidebarMenu className="gap-0.5">
        {items
          .filter((item) => item.built === built)
          .map(({ label, href, icon: Icon, count }) => {
            const current = href === currentHref;
            const waiting = count ? `${count} waiting` : "";
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={current}
                  tooltip={
                    built
                      ? [label, waiting].filter(Boolean).join(", ")
                      : `${label} (not built yet)`
                  }
                  render={
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      onClick={closeSheet}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {waiting && <span className="sr-only">, {waiting}</span>}
                  {!built && (
                    <>
                      <Badge
                        aria-hidden="true"
                        className="group-data-[collapsible=icon]:hidden"
                      >
                        Soon
                      </Badge>
                      <span className="sr-only">, not built yet</span>
                      {/* Collapsed to icons, the chip becomes a dot; the tooltip carries the words. */}
                      <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 hidden size-1.5 rounded-full bg-muted-foreground group-data-[collapsible=icon]:block"
                      />
                    </>
                  )}
                </SidebarMenuButton>
                {waiting && (
                  <SidebarMenuBadge aria-hidden="true">
                    {count}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
      </SidebarMenu>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href={homeHref}
          aria-label="Dealwright, go to the Pipeline"
          onClick={closeSheet}
          className="flex h-8 items-center rounded-md px-1 font-heading text-xl font-bold tracking-tight group-data-[collapsible=icon]:justify-center"
        >
          D
          <span className="group-data-[collapsible=icon]:hidden">
            ealwright
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          {group(true)}
          <SidebarSeparator />
          {group(false)}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}

export { AppSidebar };
