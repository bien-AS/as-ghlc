import {
  BellIcon,
  FileTextIcon,
  LayoutListIcon,
  type LucideIcon,
  PresentationIcon,
  SettingsIcon,
  ShieldQuestionIcon,
  UsersIcon,
} from "lucide-react";

/*
 * The one navigation table (spec 04). It drives the sidebar, the navbar's
 * page titles and the placeholder routes, so they cannot disagree. A
 * placeholder's text follows the rule for all rep-facing text: it names no CRM
 * and no third-party service by brand.
 */

export const PIPELINE_HREF = "/dashboard";
export const SUSPECTS_HREF = "/dashboard/suspects";
export const NOTIFICATIONS_HREF = "/dashboard/notifications";
export const DECK_PRESENTER_HREF = "/dashboard/deck-presenter";
export const PROPOSAL_BUILDER_HREF = "/dashboard/proposal-builder";
export const leadHref = (leadId: string) =>
  `/dashboard/leads/${encodeURIComponent(leadId)}`;
export const suspectHref = (leadId: string) =>
  `${SUSPECTS_HREF}/${encodeURIComponent(leadId)}`;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
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
  { label: "Pipeline", href: PIPELINE_HREF, icon: LayoutListIcon, built: true },
  {
    label: "Suspect review",
    href: SUSPECTS_HREF,
    icon: ShieldQuestionIcon,
    built: true,
  },
  {
    label: "Notifications",
    href: NOTIFICATIONS_HREF,
    icon: BellIcon,
    built: false,
    willDo: "List what needs you, newest first, each linking to its lead.",
    waitingOn: [
      "Real lead data (the lead store).",
      "The screen itself is specified and ready.",
    ],
  },
  {
    label: "Deck presenter",
    href: DECK_PRESENTER_HREF,
    icon: PresentationIcon,
    built: false,
    willDo:
      "Present a lead's deck full screen on the call, edit its text and download it as a PDF.",
    waitingOn: [
      "A decision on where the deck service runs and which editor reps use (question 2).",
      "The deck templates.",
    ],
  },
  {
    label: "Proposal builder",
    href: PROPOSAL_BUILDER_HREF,
    icon: FileTextIcon,
    built: false,
    willDo:
      "Build a proposal from the lead's details and your prices, review it and send it.",
    waitingOn: [
      "Access to the proposal service.",
      "A decision on how the app learns a proposal was signed (question 6).",
    ],
  },
  {
    label: "Users and roles",
    href: "/dashboard/users",
    icon: UsersIcon,
    built: false,
    willDo: "Show who has access and their role.",
    waitingOn: [
      "Decisions on what each role sees and on the sign-in rule (question 7).",
      "A decision on how workspaces work (question 9).",
    ],
  },
  {
    label: "Settings and integrations",
    href: "/dashboard/settings",
    icon: SettingsIcon,
    built: false,
    willDo: "Connect your CRM and the proposal, invoice and deck services.",
    waitingOn: [
      "A decision on the kind of product (question 9).",
      "A decision on which tools are fixed (question 10).",
      "A decision on which CRMs are supported (question 11).",
    ],
  },
];

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
