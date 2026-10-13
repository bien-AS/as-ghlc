"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { AuthoritySolutionsLogo } from "@/components/ui/authority-solutions-logo";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
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
  /** What the count counts, for assistive technology and the tooltip. */
  countLabel?: string;
};

export type AppSidebarGroup = {
  /** A heading for the group; the first group usually has none. */
  label?: string;
  items: AppSidebarItem[];
};

/**
 * The dashboard's left navigation (spec 04): the logo, then groups of
 * screens with a divider between them. A screen that is still a placeholder is
 * marked "Soon". Collapses to icons, with each label as a tooltip, and becomes
 * a sheet below the `nav` breakpoint.
 */
function AppSidebar({
  groups,
  currentHref,
  homeHref,
}: {
  /** Empty groups are left out, with their divider. */
  groups: AppSidebarGroup[];
  /** The `href` of the item for the current screen. */
  currentHref?: string;
  homeHref: string;
}) {
  const { setOpenMobile } = useSidebar();
  const closeSheet = () => setOpenMobile(false);

  const item = ({
    label,
    href,
    icon: Icon,
    built,
    count,
    countLabel = "waiting",
  }: AppSidebarItem) => {
    const current = href === currentHref;
    const waiting = count ? `${count} ${countLabel}` : "";
    return (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          isActive={current}
          // Vantage's current row: a quieter ground than hover, bold, with a
          // 3px accent rail and an accent icon.
          className="relative data-active:bg-[var(--bg-dark-active)] data-active:font-bold data-active:before:absolute data-active:before:top-1/2 data-active:before:left-0 data-active:before:h-[18px] data-active:before:w-[3px] data-active:before:-translate-y-1/2 data-active:before:rounded-r data-active:before:bg-sidebar-primary data-active:hover:bg-sidebar-accent data-active:[&_svg]:text-sidebar-primary"
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
          <SidebarMenuBadge
            aria-hidden="true"
            className="rounded-full bg-sidebar-accent px-1.5 font-mono text-nano font-bold peer-data-active/menu-button:bg-sidebar-primary peer-data-active/menu-button:text-sidebar-primary-foreground"
          >
            {count}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  const shown = groups.filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href={homeHref}
          aria-label="Go to the Pipeline"
          onClick={closeSheet}
          // Collapsed to icons, the link clips the lockup to its shield.
          className="flex h-8 items-center overflow-hidden rounded-md px-1 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:px-0"
        >
          {/* The sidebar is dark in both themes, so the logo is always the white one. */}
          <AuthoritySolutionsLogo height={24} surface="dark" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          {shown.map((group, index) => (
            <div key={group.label ?? "main"}>
              {index > 0 && <SidebarSeparator />}
              <SidebarGroup>
                {group.label && (
                  <SidebarGroupLabel className="text-nano font-bold tracking-[0.08em] text-ink-on-dark-3 uppercase">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarMenu className="gap-0.5">
                  {group.items.map(item)}
                </SidebarMenu>
              </SidebarGroup>
            </div>
          ))}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}

export { AppSidebar };
