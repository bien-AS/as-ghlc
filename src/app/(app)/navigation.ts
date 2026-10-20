import {
  BellIcon,
  FileTextIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  PlugIcon,
  PresentationIcon,
  ReceiptIcon,
  ScrollTextIcon,
  ShieldQuestionIcon,
  TagsIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";

import { isLive } from "@/lib/flags";

/*
 * The one navigation table: the registry's nav gating matrix
 * (`screen-registry.json`, `nav_gating`), in its order. It drives the sidebar
 * and the navbar's page titles, so they cannot disagree. An entry is rendered
 * only while its screen is live (`src/lib/flags.ts`), and the Admin group only
 * for an admin. Rep-facing text names no CRM and no third-party service by
 * brand.
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
  /**
   * "work" is every role's; "admin" is the Admin group, which is left out of
   * the page for a rep (the matrix's "hidden"). The server refuses a rep too.
   */
  group: "work" | "admin";
};

const work = (
  label: string,
  href: string,
  icon: LucideIcon,
  screen: string,
): NavItem => ({ label, href, icon, screen, group: "work" });
const admin = (
  label: string,
  href: string,
  icon: LucideIcon,
  screen: string,
): NavItem => ({ label, href, icon, screen, group: "admin" });

export const NAV_ITEMS: NavItem[] = [
  work("Dashboard", DASHBOARD_HREF, LayoutDashboardIcon, "dashboard"),
  work("Leads", LEADS_HREF, LayoutListIcon, "lead-list"),
  work(
    "Review Queue",
    REVIEW_QUEUE_HREF,
    ShieldQuestionIcon,
    "suspect-review-queue",
  ),
  work("Pipeline", "/pipeline", KanbanIcon, "pipeline-board"),
  work("Decks", DECKS_HREF, PresentationIcon, "deck-library"),
  work("Proposals", PROPOSALS_HREF, FileTextIcon, "proposal-list"),
  work("Invoices", "/invoices", ReceiptIcon, "invoice-approvals"),
  work("Recordings", "/recordings", VideoIcon, "meeting-recordings"),
  work("Notifications", NOTIFICATIONS_HREF, BellIcon, "notifications-center"),
  admin("Reps", REPS_HREF, UsersIcon, "team-reps"),
  admin("Integrations", INTEGRATIONS_HREF, PlugIcon, "admin-integrations"),
  admin("Templates", "/admin/templates", LayoutTemplateIcon, "admin-templates"),
  admin("Statuses", "/admin/statuses", TagsIcon, "admin-statuses"),
  // The matrix's one "Logs" entry opens the sync log, the audit surface; the
  // validation log is reached from there when both are built.
  admin("Logs", "/admin/sync-log", ScrollTextIcon, "sync-log"),
];

/** The live entries a role sees, in order. Until the role is known, no Admin group. */
export function navItemsFor(role: "admin" | "rep" | undefined): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      isLive(item.screen) && (item.group === "work" || role === "admin"),
  );
}

/** Screens with a title of their own: settings, and one deck or proposal. */
const OTHER_TITLES: [prefix: string, title: string][] = [
  [PROFILE_SETTINGS_HREF, "Account settings"],
  [`${DECKS_HREF}/`, "Deck presenter"],
  [`${PROPOSALS_HREF}/`, "Proposal builder"],
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
    OTHER_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ??
    navItemFor(pathname)?.label
  );
}
