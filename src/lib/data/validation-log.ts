import { listVisibleLeads } from "@/lib/data/leads";
import { AccessError } from "@/lib/data/users";
import { getViewer } from "@/lib/data/viewer";
import type { LeadDetail } from "@/lib/leads/schemas";
import { can } from "@/lib/roles";
import {
  VALIDATION_LOG_PAGE_SIZE,
  type ValidationEntry,
  type ValidationLog,
} from "@/lib/validation/schemas";

/*
 * Data access for the validation log (ADR-0006).
 *
 * THE SEAM. The guard comes first (`getViewer`, then the role), then the log
 * is read. Today it is derived from the sample leads' verdicts, read only
 * through `listVisibleLeads`. Going live means replacing the body with a query
 * on the validation-run table, where each run stores its inputs and cost.
 * Schemas, the Route Handler, query options, hook and screen do not change.
 */

/** The moment of the verdict: its timeline entry, else the lead's last change. */
const verdictTime = (lead: LeadDetail) =>
  lead.activities.find((entry) => entry.type === "Verdict")?.time ??
  lead.updatedAt;

function toEntry(lead: LeadDetail): ValidationEntry | null {
  const record = lead.verdictRecord;
  if (!record) return null;
  const reviewed =
    record.reviewOutcome && record.reviewedBy && record.reviewedAt
      ? {
          outcome: record.reviewOutcome,
          by: record.reviewedBy,
          at: record.reviewedAt,
        }
      : null;
  return {
    id: `val-${lead.id}`,
    at: verdictTime(lead),
    lead: { id: lead.id, name: lead.name, company: lead.company },
    result: record.result,
    summary: record.summary,
    reasons: record.reasons,
    // The sample runs have no measured cost; null, not zero.
    cost: null,
    override: reviewed,
  };
}

/** Every verdict, newest first. For people who can see the logs only. */
export async function listValidationLog(): Promise<ValidationLog> {
  const { role } = await getViewer();
  if (!can(role, "view_logs")) throw new AccessError("forbidden");
  const items = (await listVisibleLeads())
    .map(toEntry)
    .filter((entry): entry is ValidationEntry => entry !== null)
    .sort((a, b) => b.at.localeCompare(a.at));
  return { items: items.slice(0, VALIDATION_LOG_PAGE_SIZE) };
}
