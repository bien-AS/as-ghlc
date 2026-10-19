import {
  BellIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  type LucideIcon,
  PlugIcon,
  ShieldQuestionIcon,
  UsersIcon,
} from "lucide-react";

import type { Capability } from "@/lib/roles";

/*
 * The one navigation table. It drives the sidebar and the navbar's page
 * titles, so they cannot disagree. Routes are the screen registry's
 * (`screen-registry.json`); an entry is rendered only while its screen is live
 * (`src/lib/flags.ts`). Rep-facing text names no CRM and no third-party
 * service by brand.
 */

export const DASHBOARD_HREF = "/dashboard";
export const LEADS_HREF = "/leads";
export const REVIEW_QUEUE_HREF = "/review-queue";
export const NOTIFICATIONS_HREF = "/notifications";
/** Deck library and proposal list: registered, not built (flags keep their links hidden). */
export const DECKS_HREF = "/decks";
export const PROPOSALS_HREF = "/proposals";
export const REPS_HREF = "/admin/reps";
export const INTEGRATIONS_HREF = "/admin/integrations";
/** Personal settings: reached from the user menu, not from the sidebar. */
export const PROFILE_SETTINGS_HREF = "/settings/profile";

export const leadHref = (leadId: string) =>
  `${LEADS_HREF}/${encodeURIComponent(leadId)}`;
export const suspectHref = (leadId: string) =>
  `${REVIEW_QUEUE_HREF}?lead=${encodeURIComponent(leadId)}`;
/** A deck and a proposal are keyed by their lead while they are mockups. */
export const deckHref = (leadId: string) =>
  `${DECKS_HREF}/${encodeURIComponent(leadId)}`;
export const proposalHref = (leadId: string) =>
  `${PROPOSALS_HREF}/${encodeURIComponent(leadId)}`;
/** Where a lead's invoice draft is shown: on Lead detail (spec 15). */
export const INVOICE_ANCHOR = "invoice";
export const invoiceHref = (leadId: string) =>
  `${leadHref(leadId)}#${INVOICE_ANCHOR}`;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The registry id of the destination, for the phase flags. */
  screen: string;
  /** "work" is a rep's own work; "admin" is the Admin group. */
  group: "work" | "admin";
  /** Shown only to a role that can do this (spec 12). The server refuses too. */
  requires?: Capability;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: DASHBOARD_HREF,
    icon: LayoutDashboardIcon,
    screen: "dashboard",
    group: "work",
  },
  {
    label: "Leads",
    href: LEADS_HREF,
    icon: LayoutListIcon,
    screen: "lead-list",
    group: "work",
  },
  {
    label: "Review Queue",
    href: REVIEW_QUEUE_HREF,
    icon: ShieldQuestionIcon,
    screen: "suspect-review-queue",
    group: "work",
  },
  {
    label: "Notifications",
    href: NOTIFICATIONS_HREF,
    icon: BellIcon,
    screen: "notifications-center",
    group: "work",
  },
  {
    label: "Reps",
    href: REPS_HREF,
    icon: UsersIcon,
    screen: "team-reps",
    group: "admin",
    requires: "manage_users",
  },
  {
    label: "Integrations",
    href: INTEGRATIONS_HREF,
    icon: PlugIcon,
    screen: "admin-integrations",
    group: "admin",
    requires: "manage_connections",
  },
];

/** Screens with a title but no sidebar entry. */
const OTHER_TITLES: [prefix: string, title: string][] = [
  [PROFILE_SETTINGS_HREF, "Account settings"],
  [DECKS_HREF, "Deck presenter"],
  [PROPOSALS_HREF, "Proposal builder"],
];

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** The nav item a path belongs to. Lead detail belongs to Leads. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => under(pathname, item.href));
}

/** The navbar's title for a path, or undefined for an unknown address. */
export function titleFor(pathname: string): string | undefined {
  return (
    navItemFor(pathname)?.label ??
    OTHER_TITLES.find(([prefix]) => under(pathname, prefix))?.[1]
  );
}
