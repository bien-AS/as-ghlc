/*
 * GHL's Lead Status picklist (status_defs, seeded by
 * drizzle/0002_webhook_events_and_status_defs.sql), in its order, for the
 * lead list's group filter and the Change status modal. The server checks
 * every value against status_defs, so a stale entry here is refused, never
 * written.
 * ponytail: a copy of the seed because no route reads status_defs yet; read
 * them from an API when spec 14 lets admins edit statuses.
 */

const GROUPS = {
  New: ["New - Contacted", "New - Uncontacted"],
  Engaging: [
    "Engaging - Welcome Sequence",
    "Engaging - Responded",
    "Engaging - Hot Lead",
  ],
  Appointment: [
    "Appointment - Scheduled",
    "Appointment - Awaiting Confirmation",
    "Appointment - Confirmed",
    "Appointment - Completed",
    "Appointment - No Show",
    "Appointment - Rescheduled",
    "Appointment - Cancelled",
  ],
  Qualified: [
    "Qualified - Pending Proposal",
    "Qualified - Proposal Sent",
    "Qualified - Negotiating",
  ],
  Nurturing: [
    "Nurturing - Long Term",
    "Nurturing - Passive",
    "Nurturing - Re-engaged",
  ],
  Won: ["Won - Customer"],
  Lost: [
    "Lost - Not Qualified",
    "Lost - No Response",
    "Lost - Unsubscribed",
    "Lost - Competitor",
    "Lost - Cancelled No Reschedule",
    "Lost - No Decision",
    "Lost - Proposal No Win",
    "Lost - Spam",
    "Lost - Other",
  ],
} as const;

export const LEAD_STATUS_GROUPS = Object.keys(
  GROUPS,
) as (keyof typeof GROUPS)[];
export const LEAD_STATUS_OPTIONS = Object.entries(GROUPS) as [
  string,
  readonly string[],
][];
