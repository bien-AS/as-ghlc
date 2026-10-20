import { requireProfile } from "@/lib/data/users";
import {
  EXITS,
  type LeadDetail,
  NEEDS,
  type PipelineSummary,
  STAGES,
} from "@/lib/leads/schemas";
import { SAMPLE_REP } from "@/test/server-fakes";

/*
 * Leads live in Postgres (spec 07), which the jsdom tests do not have. A test
 * that only needs some leads to exist (the shell's suspect count, the sample
 * notifications derived from leads) reads these six suspects instead, two of
 * them the sample rep's. Wire them in with
 *   vi.mock("@/lib/data/leads", async (original) => ({
 *     ...(await original<typeof import("@/lib/data/leads")>()),
 *     ...(await import("@/test/lead-stand-ins")).leadsModule,
 *   }));
 * Who may see which lead is proven on the real database (src/test/isolation).
 */

const TIME = "2026-10-01T09:00:00.000Z";

const suspect = (n: number, ownerId: string): LeadDetail => ({
  id: `stand-in-${n}`,
  name: `Stand-in ${n}`,
  company: `Company ${n}`,
  email: null,
  stage: "new",
  exit: null,
  status: null,
  verdict: "suspect",
  owner: { id: ownerId, name: ownerId },
  nextBooking: null,
  createdAt: TIME,
  lastActivityAt: TIME,
  archivedAt: null,
  lastSync: null,
  phone: null,
  website: null,
  source: null,
  budget: null,
  archivedReason: null,
  formAnswers: [],
  updatedAt: TIME,
  verdictRecord: null,
  bookings: [],
  deck: null,
  proposal: null,
  invoice: null,
  activities: [],
  syncLog: [],
});

const LEADS = [1, 2, 3, 4, 5, 6].map((n) =>
  suspect(n, n <= 2 ? SAMPLE_REP.id : "another-rep"),
);

/** The stand-ins the signed-in person may see: an admin all six, the sample rep two. */
async function listVisibleLeads(): Promise<LeadDetail[]> {
  const viewer = await requireProfile();
  return structuredClone(
    LEADS.filter(
      (lead) => viewer.role === "admin" || lead.owner?.id === viewer.id,
    ),
  );
}

const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

async function getPipelineSummary(): Promise<PipelineSummary> {
  const count = (await listVisibleLeads()).length;
  return {
    open: count,
    stages: { ...zero(STAGES), new: count },
    exits: zero(EXITS),
    needs: { ...zero(NEEDS), suspects: count },
    owners: [],
  };
}

export const leadsModule = { listVisibleLeads, getPipelineSummary };
