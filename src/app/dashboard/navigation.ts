import {
  BellIcon,
  Building2Icon,
  FileTextIcon,
  LayoutListIcon,
  type LucideIcon,
  PlugIcon,
  PresentationIcon,
  ShieldQuestionIcon,
  UsersIcon,
} from "lucide-react";

import type { Capability } from "@/lib/roles";

/*
 * The one navigation table (spec 04). It drives the sidebar, the navbar's
 * page titles and the placeholder routes, so they cannot disagree. Rep-facing
 * text follows the rule for the whole dashboard: it names no CRM and no
 * third-party service by brand.
 *
 * Every screen listed here is now built. Six of them are MOCKUPS on sample
 * data (docs/specs/README.md, "Mockups"). The placeholder convention stays
 * available for a screen added later: give it `built: false`.
 */

export const PIPELINE_HREF = "/dashboard";
export const SUSPECTS_HREF = "/dashboard/suspects";
export const NOTIFICATIONS_HREF = "/dashboard/notifications";
export const DECK_PRESENTER_HREF = "/dashboard/deck-presenter";
export const PROPOSAL_BUILDER_HREF = "/dashboard/proposal-builder";
export const USERS_HREF = "/dashboard/users";
export const WORKSPACE_SETTINGS_HREF = "/dashboard/settings";
export const INTEGRATIONS_HREF = "/dashboard/integrations";
/** Personal settings: reached from the user menu, not from the sidebar. */
export const ACCOUNT_HREF = "/dashboard/account";

export const leadHref = (leadId: string) =>
  `/dashboard/leads/${encodeURIComponent(leadId)}`;
export const suspectHref = (leadId: string) =>
  `${SUSPECTS_HREF}/${encodeURIComponent(leadId)}`;
/** The lead a deck or a proposal belongs to is kept in the address. */
export const deckHref = (leadId: string) =>
  `${DECK_PRESENTER_HREF}?lead=${encodeURIComponent(leadId)}`;
export const proposalHref = (leadId: string) =>
  `${PROPOSAL_BUILDER_HREF}?lead=${encodeURIComponent(leadId)}`;
/** Where a lead's invoice draft is shown: on Lead detail (spec 15). */
export const INVOICE_ANCHOR = "invoice";
export const invoiceHref = (leadId: string) =>
  `${leadHref(leadId)}#${INVOICE_ANCHOR}`;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** "work" is a rep's own work; "workspace" is managing the Workspace. */
  group: "work" | "workspace";
  /** Shown only to a role that can do this (spec 12). The server refuses too. */
  requires?: Capability;
} & (
  | { built: true }
  | {
      built: false;
      /** One sentence saying what the screen will do. */
      willDo: string;
      waitingOn: string[];
    }
);

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Pipeline",
    href: PIPELINE_HREF,
    icon: LayoutListIcon,
    group: "work",
    built: true,
  },
  {
    label: "Suspect review",
    href: SUSPECTS_HREF,
    icon: ShieldQuestionIcon,
    group: "work",
    built: true,
  },
  {
    label: "Notifications",
    href: NOTIFICATIONS_HREF,
    icon: BellIcon,
    group: "work",
    built: true,
  },
  {
    label: "Deck presenter",
    href: DECK_PRESENTER_HREF,
    icon: PresentationIcon,
    group: "work",
    built: true,
  },
  {
    label: "Proposal builder",
    href: PROPOSAL_BUILDER_HREF,
    icon: FileTextIcon,
    group: "work",
    built: true,
  },
  {
    label: "Users and roles",
    href: USERS_HREF,
    icon: UsersIcon,
    group: "workspace",
    requires: "manage_users",
    built: true,
  },
  {
    label: "Workspace settings",
    href: WORKSPACE_SETTINGS_HREF,
    icon: Building2Icon,
    group: "workspace",
    requires: "manage_workspace",
    built: true,
  },
  {
    label: "Integrations",
    href: INTEGRATIONS_HREF,
    icon: PlugIcon,
    group: "workspace",
    requires: "manage_connections",
    built: true,
  },
];

/** Screens with a title but no sidebar entry. */
const OTHER_TITLES: Record<string, string> = {
  [ACCOUNT_HREF]: "Account settings",
};

/** The nav item a path belongs to. Lead detail has no item: Pipeline stays marked. */
export function navItemFor(pathname: string): NavItem | undefined {
  if (pathname === PIPELINE_HREF || pathname.startsWith("/dashboard/leads/")) {
    return NAV_ITEMS[0];
  }
  return NAV_ITEMS.find(
    (item) =>
      item.href !== PIPELINE_HREF &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

/** The navbar's title for a path, or undefined for an unknown address. */
export function titleFor(pathname: string): string | undefined {
  return navItemFor(pathname)?.label ?? OTHER_TITLES[pathname];
}
