"use client";

import { BellIcon, PanelLeftIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Crumb = { label: string; href?: string };

/**
 * Collapses or expands the sidebar; below the `nav` breakpoint it opens the
 * sidebar as a sheet. Says whether the navigation is expanded.
 */
function NavigationToggle() {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Navigation"
      aria-expanded={isMobile ? openMobile : open}
      onClick={toggleSidebar}
    >
      <PanelLeftIcon aria-hidden="true" />
    </Button>
  );
}

function SearchField({
  action,
  onSearch,
  autoFocus,
  className,
}: {
  action: string;
  onSearch: (text: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    // A real form so Enter submits. GET on purpose: its one field is a search
    // term that belongs in the address (a shareable Pipeline view), and a
    // submit before hydration lands on the same filtered Pipeline.
    <form
      role="search"
      method="get"
      action={action}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const field = event.currentTarget.elements.namedItem("q");
        if (field instanceof HTMLInputElement) onSearch(field.value.trim());
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search leads</span>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          name="q"
          placeholder="Search leads"
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: only set when the person has just pressed the search button to reveal this field
          autoFocus={autoFocus}
          className="pl-8"
        />
      </label>
    </form>
  );
}

/**
 * The dashboard's top bar (spec 04): where you are, the lead search, the
 * notifications entry, the Sample data label, the theme switch and the user
 * menu. Below the `nav` breakpoint the search becomes an icon that opens the
 * field, and the theme switch and Sample data label live in the user menu.
 */
function TopNavbar({
  crumbs,
  searchAction,
  onSearch,
  notificationsHref,
  sampleDataNote,
  userMenu,
}: {
  /** The current screen last; earlier entries with an `href` are links. */
  crumbs: Crumb[];
  /** The page the search opens: the Pipeline, which reads `q` from its address. */
  searchAction: string;
  onSearch: (text: string) => void;
  notificationsHref: string;
  /** Set while the dashboard runs on sample data: what the label explains. */
  sampleDataNote?: string;
  userMenu: React.ReactNode;
}) {
  const [searching, setSearching] = useState(false);
  const submit = (text: string) => {
    setSearching(false);
    onSearch(text);
  };

  return (
    <header
      data-slot="top-navbar"
      className="sticky top-0 z-[9] flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2 nav:px-4"
    >
      {searching ? (
        // Small screens: the field takes the whole bar until it is closed.
        <div
          className="flex flex-1 items-center gap-2"
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearching(false);
          }}
        >
          <SearchField
            autoFocus
            action={searchAction}
            onSearch={submit}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => setSearching(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <>
          <NavigationToggle />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${crumb.href ?? ""}`}>
                    <BreadcrumbItem className={last ? "min-w-0" : "shrink-0"}>
                      {last ? (
                        <BreadcrumbPage
                          title={crumb.label}
                          className="truncate font-semibold"
                        >
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : crumb.href ? (
                        <BreadcrumbLink render={<Link href={crumb.href} />}>
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        crumb.label
                      )}
                    </BreadcrumbItem>
                    {!last && <BreadcrumbSeparator />}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>

          <SearchField
            action={searchAction}
            onSearch={submit}
            className="hidden w-44 nav:block wide:w-64"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search leads"
            className="nav:hidden"
            onClick={() => setSearching(true)}
          >
            <SearchIcon aria-hidden="true" />
          </Button>

          {sampleDataNote && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="hidden shrink-0 rounded-full nav:inline-flex"
                  />
                }
              >
                <Badge>Sample data</Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">{sampleDataNote}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <LinkButton
                  variant="ghost"
                  size="icon"
                  aria-label="Notifications"
                  href={notificationsHref}
                />
              }
            >
              <BellIcon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>

          <ThemeSwitch className="hidden nav:inline-flex" />
          {userMenu}
        </>
      )}
    </header>
  );
}

export { TopNavbar };
