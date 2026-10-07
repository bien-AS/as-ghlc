import type {
  Booking,
  Exit,
  LeadDetail,
  Stage,
  Status,
} from "@/lib/leads/schemas";

/*
 * Sample leads (spec 04, "Sample data"; ADR-0006). Imported by the data-access
 * layer and its tests only. Every person and company is invented; emails and
 * websites use reserved example domains and phone numbers use the reserved
 * 555-01xx range.
 *
 * Times are relative to `now`, so "calls today" always has entries.
 * ponytail: `now` is fixed when the server instance first reads the store, so a
 * server left running past midnight shows yesterday's calls. A restart resets it.
 */

/** A lead as stored. The effective verdict and the next call are derived on read. */
export type LeadRecord = Omit<LeadDetail, "verdict" | "nextBooking">;

export const SAMPLE_REPS = [
  { id: "rep-maya", name: "Maya Okafor" },
  { id: "rep-daniel", name: "Daniel Reyes" },
  { id: "rep-priya", name: "Priya Nair" },
  { id: "rep-tom", name: "Tom Lindqvist" },
] as const;

type Call = [
  kind: Booking["kind"],
  hoursFromNow: number,
  state: Booking["state"],
];

type Seed = {
  name: string;
  company?: string;
  /** false leaves the field empty, to cover leads that arrive with little. */
  email?: false;
  phone?: false;
  website?: false;
  budget?: string;
  source?: string;
  rep: 0 | 1 | 2 | 3;
  stage: Stage;
  exit?: Exit;
  status: Status;
  /** Omitted: awaiting a verdict. */
  verdict?: "valid" | "suspect" | "spam";
  summary?: string;
  reasons?: string[];
  review?: "cleared" | "spam";
  calls?: Call[];
  deck?: true;
  proposal?: NonNullable<LeadDetail["proposal"]>["status"];
  invoice?: string;
  /** Days since the form came in, and hours since anything last happened. */
  age: number;
  idle: number;
  /** Index into ANSWERS, a custom list, or false for a lead with no answers. */
  answers?: number | [string, string][] | false;
  /** Why the lead left, for the exit activity. */
  note?: string;
  /** Extra CRM follow-ups, to make a long timeline. */
  followUps?: number;
};

const Q = {
  service: "What service are you interested in?",
  budget: "What is your monthly marketing budget?",
  challenge: "What is your biggest challenge right now?",
  heard: "How did you hear about us?",
} as const;

const ANSWERS: [string, string][][] = [
  [
    [Q.service, "Local SEO and a new website"],
    [Q.challenge, "We rank on page two for everything and the phone is quiet."],
    [Q.heard, "A colleague recommended you"],
  ],
  [
    [Q.service, "Paid search"],
    [Q.budget, "Between $2,000 and $4,000"],
    [Q.challenge, "Our ads spend more every month and bring fewer calls."],
    [Q.heard, "Search"],
  ],
  [
    [Q.service, "Reputation management"],
    [Q.challenge, "Two bad reviews are the first thing people see."],
    [Q.heard, "A podcast"],
  ],
  [
    [Q.service, "Full marketing retainer"],
    [Q.budget, "Above $8,000"],
    [
      Q.challenge,
      "We are opening a third location in the spring and need a plan that covers all three without tripling what we spend. The last agency reported on impressions and nothing else.",
    ],
    [Q.heard, "Saw a talk at a trade show"],
  ],
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

const SEEDS: Seed[] = [
  // New lead: awaiting a verdict.
  {
    name: "Imogen Vasquez",
    company: "Fernbrook Veterinary",
    rep: 0,
    stage: "new",
    status: "awaiting_verdict",
    age: 0.02,
    idle: 0.4,
    answers: 0,
  },
  {
    name: "Callum Adeyemi",
    rep: 1,
    stage: "new",
    status: "awaiting_verdict",
    age: 0.05,
    idle: 1,
    phone: false,
    website: false,
    answers: false,
  },

  // Suspects waiting for a rep. Two already have a call booked (question 4).
  {
    name: "Rex Thornbury",
    company: "Thornbury Global Holdings",
    rep: 0,
    stage: "discovery_booked",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 3,
    idle: 70,
    summary:
      "The company cannot be found and the budget does not fit the request.",
    reasons: [
      "No business with this name is listed at the address given.",
      "The stated budget is far above what the requested service costs.",
      "The email domain was registered this week.",
    ],
    calls: [["discovery", 5, "confirmed"]],
    budget: "$250,000 a month",
    answers: [
      [Q.service, "SEO"],
      [Q.budget, "$250,000 a month"],
      [Q.challenge, "Need results fast, will pay upfront."],
    ],
  },
  {
    name: "Lena Marchetti",
    company: "Marchetti & Daughters Bakery",
    rep: 2,
    stage: "new",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 2.5,
    idle: 58,
    summary:
      "Probably genuine, but the form was filled in twice with different phone numbers.",
    reasons: [
      "Two submissions from the same address within a minute.",
      "The two phone numbers do not match.",
    ],
    answers: 2,
  },
  {
    name: "Anonymous Buyer",
    rep: 1,
    stage: "new",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 2,
    idle: 47,
    phone: false,
    website: false,
    summary: "No real name or company was given.",
    reasons: [
      "The name field reads as a placeholder.",
      "No company, phone or website.",
    ],
    answers: [
      [Q.service, "everything"],
      [Q.challenge, "call me"],
    ],
  },
  {
    name: "Dr. Oluwaseun Fitzgerald-Abernathy",
    company: "The Greater Riverside Orthopaedic & Sports Medicine Partnership",
    rep: 3,
    stage: "discovery_booked",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 1.5,
    idle: 30,
    summary: "A real practice, but the person may not work there.",
    reasons: [
      "The email is a personal address, not the practice's domain.",
      "The practice's site lists no one with this name.",
    ],
    calls: [["discovery", 52, "confirmed"]],
    answers: 3,
  },
  {
    name: "Mitra Dalgaard",
    company: "Dalgaard Imports",
    rep: 2,
    stage: "new",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 1,
    idle: 22,
    summary: "The message reads like a sales pitch rather than an enquiry.",
    reasons: [],
    answers: [
      [Q.service, "Partnership"],
      [
        Q.challenge,
        "We offer guest posts on high-authority sites at competitive rates.",
      ],
    ],
  },
  {
    name: "Bao Trinh",
    company: "Trinh Auto Glass",
    rep: 0,
    stage: "new",
    status: "flagged_suspect",
    verdict: "suspect",
    age: 0.6,
    idle: 13,
    summary: "",
    reasons: [],
    answers: false,
  },

  // New lead: valid, not booked yet. The busiest stage, for the high-volume case.
  {
    name: "Sofia Lindgren",
    company: "Lindgren Family Dental",
    rep: 0,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "An established practice with a clear request.",
    reasons: ["The practice and the person both check out."],
    age: 1,
    idle: 20,
    answers: 0,
  },
  {
    name: "Marcus Bellweather",
    company: "Bellweather Roofing Co.",
    rep: 1,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "A local roofer asking about paid search.",
    reasons: ["Licensed contractor with a matching address."],
    age: 2,
    idle: 26,
    answers: 1,
  },
  {
    name: "Aiko Tanabe",
    company: "Tanabe Physiotherapy",
    rep: 2,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "A small clinic, modest budget, genuine.",
    reasons: ["Business registration matches."],
    age: 3,
    idle: 40,
    answers: 2,
  },
  {
    name: "Gareth Powell",
    company: "Powell & Sons Plumbing",
    rep: 3,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "Genuine trade business.",
    reasons: ["Phone number matches the listed business."],
    age: 4,
    idle: 52,
    answers: 1,
  },
  {
    name: "Nadia Rahimi",
    company: "Cedar Court Orthodontics",
    rep: 0,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Practice site lists her as the manager."],
    age: 5,
    idle: 60,
    answers: 0,
  },
  {
    name: "Tobias Engel",
    company: "Engel Landscaping",
    rep: 1,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Matches a registered business."],
    age: 6,
    idle: 75,
    answers: 2,
    email: false,
  },
  {
    name: "Yara Haddad",
    company: "Haddad Legal",
    rep: 2,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "A two-partner firm asking about local search.",
    reasons: ["Bar listing matches."],
    age: 6,
    idle: 90,
    answers: 3,
  },
  {
    name: "Felix Oyelaran",
    company: "Brightwater Pools",
    rep: 3,
    stage: "new",
    status: "drip_chasing",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Business address confirmed."],
    age: 7,
    idle: 100,
    answers: 1,
  },
  {
    name: "Hannah Kowalczyk",
    company: "Kowalczyk Eye Care",
    rep: 0,
    stage: "new",
    status: "deck_ready",
    verdict: "valid",
    summary: "Genuine practice.",
    reasons: ["Practice confirmed."],
    deck: true,
    age: 2,
    idle: 30,
    answers: 0,
  },
  {
    name: "Reuben Castellanos",
    company: "Castellanos HVAC",
    rep: 1,
    stage: "new",
    status: "deck_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Licence number matches."],
    deck: true,
    age: 3,
    idle: 44,
    answers: 1,
  },
  // A suspect a rep has cleared: valid everywhere, and the record says who decided.
  {
    name: "Odette Blackwood",
    company: "Blackwood Interiors",
    rep: 2,
    stage: "new",
    status: "drip_chasing",
    verdict: "suspect",
    review: "cleared",
    summary: "The email domain is new.",
    reasons: ["The domain was registered last month."],
    age: 8,
    idle: 96,
    answers: 2,
  },

  // Discovery Call Booked.
  {
    name: "Priscilla Nwosu",
    company: "Nwosu Paediatrics",
    rep: 0,
    stage: "discovery_booked",
    status: "deck_ready",
    verdict: "valid",
    summary: "Genuine practice with two sites.",
    reasons: ["Both sites are listed."],
    deck: true,
    calls: [["discovery", 0.5, "confirmed"]],
    age: 4,
    idle: 8,
    answers: 3,
  },
  {
    name: "Henrik Solberg",
    company: "Solberg Marine Services",
    rep: 1,
    stage: "discovery_booked",
    status: "deck_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Harbour listing matches."],
    deck: true,
    calls: [["discovery", 2, "confirmed"]],
    age: 5,
    idle: 12,
    answers: 1,
  },
  {
    name: "Camille Fontaine",
    company: "Fontaine Dermatology",
    rep: 2,
    stage: "discovery_booked",
    status: "deck_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Practice confirmed."],
    deck: true,
    calls: [
      ["discovery", -200, "no_show"],
      ["discovery", 30, "confirmed"],
    ],
    age: 12,
    idle: 18,
    answers: 0,
  },
  {
    name: "Desmond Achterberg",
    company: "Achterberg Flooring",
    rep: 3,
    stage: "discovery_booked",
    status: "needs_decision",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Showroom address confirmed."],
    deck: true,
    calls: [["discovery", -20, "completed"]],
    age: 9,
    idle: 19,
    answers: 1,
  },
  {
    name: "Rosalind Mbeki",
    company: "Mbeki Family Law",
    rep: 0,
    stage: "discovery_booked",
    status: "needs_decision",
    verdict: "valid",
    summary: "Genuine firm.",
    reasons: ["Bar listing matches."],
    deck: true,
    calls: [["discovery", -44, "completed"]],
    age: 10,
    idle: 43,
    answers: 3,
  },
  {
    name: "Ignatius Petrov",
    company: "Petrov Tree Care",
    rep: 1,
    stage: "discovery_booked",
    status: "needs_decision",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Insured contractor."],
    deck: true,
    calls: [
      ["discovery", -70, "rescheduled"],
      ["discovery", -5, "completed"],
    ],
    age: 11,
    idle: 4,
    answers: 2,
  },

  // Qualified.
  {
    name: "Beatrix Olander",
    company: "Olander Chiropractic",
    rep: 2,
    stage: "qualified",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Practice confirmed."],
    deck: true,
    calls: [["discovery", -96, "completed"]],
    age: 14,
    idle: 60,
    answers: 0,
  },
  {
    name: "Kwame Asante",
    company: "Asante Solar",
    rep: 3,
    stage: "qualified",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Installer registration matches."],
    deck: true,
    proposal: "draft",
    calls: [["discovery", -120, "completed"]],
    age: 15,
    idle: 30,
    answers: 1,
  },
  {
    name: "Liesel Hartmann",
    company: "Hartmann Kitchens",
    rep: 0,
    stage: "qualified",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Showroom confirmed."],
    deck: true,
    calls: [["discovery", -150, "completed"]],
    age: 16,
    idle: 100,
    answers: 3,
  },

  // Proposal Review Booked.
  {
    name: "Emeka Obi",
    company: "Obi Dental Group",
    rep: 1,
    stage: "review_booked",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine group practice.",
    reasons: ["Four sites listed."],
    deck: true,
    calls: [
      ["discovery", -240, "completed"],
      ["proposal_review", -0.2, "confirmed"],
    ],
    age: 20,
    idle: 26,
    answers: 3,
  },
  {
    name: "Saoirse Flanagan",
    company: "Flanagan Pest Control",
    rep: 2,
    stage: "review_booked",
    status: "proposal_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Licence confirmed."],
    deck: true,
    proposal: "draft",
    calls: [
      ["discovery", -260, "completed"],
      ["proposal_review", 28, "confirmed"],
    ],
    age: 21,
    idle: 14,
    answers: 1,
  },
  {
    name: "Viktor Novak",
    company: "Novak Garage Doors",
    rep: 3,
    stage: "review_booked",
    status: "proposal_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Business confirmed."],
    deck: true,
    proposal: "draft",
    calls: [
      ["discovery", -300, "completed"],
      ["proposal_review", 75, "confirmed"],
    ],
    age: 22,
    idle: 40,
    answers: 1,
  },

  // Proposal Sent.
  {
    name: "Anneliese Brandt",
    company: "Brandt Hearing Centre",
    rep: 0,
    stage: "proposal_sent",
    status: "proposal_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Clinic confirmed."],
    deck: true,
    proposal: "sent",
    calls: [
      ["discovery", -400, "completed"],
      ["proposal_review", -100, "completed"],
    ],
    age: 28,
    idle: 96,
    answers: 0,
  },
  {
    name: "Thaddeus Okonkwo",
    company: "Okonkwo Moving & Storage",
    rep: 1,
    stage: "proposal_sent",
    status: "proposal_ready",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Carrier number matches."],
    deck: true,
    proposal: "viewed",
    calls: [
      ["discovery", -420, "completed"],
      ["proposal_review", -130, "completed"],
    ],
    age: 30,
    idle: 20,
    answers: 1,
  },

  // Lead Won.
  {
    name: "Marguerite Delacroix",
    company: "Delacroix Veterinary Hospital",
    rep: 2,
    stage: "won",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Hospital confirmed."],
    deck: true,
    proposal: "signed",
    invoice: "draft",
    calls: [
      ["discovery", -600, "completed"],
      ["proposal_review", -300, "completed"],
    ],
    age: 40,
    idle: 28,
    answers: 3,
  },
  {
    name: "Jonas Whitlock",
    company: "Whitlock Electrical",
    rep: 3,
    stage: "won",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Licence confirmed."],
    deck: true,
    proposal: "signed",
    invoice: "draft",
    calls: [
      ["discovery", -650, "completed"],
      ["proposal_review", -320, "completed"],
    ],
    age: 42,
    idle: 50,
    answers: 1,
  },
  {
    name: "Ingrid Aaltonen",
    company: "Aaltonen Orthodontics",
    rep: 0,
    stage: "won",
    status: "qualified",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Practice confirmed."],
    deck: true,
    proposal: "signed",
    invoice: "sent",
    calls: [
      ["discovery", -700, "completed"],
      ["proposal_review", -380, "completed"],
    ],
    age: 45,
    idle: 200,
    answers: 0,
  },

  // Exit: Spam.
  {
    name: "Best SEO Deals",
    rep: 1,
    stage: "new",
    exit: "spam",
    status: "removed",
    verdict: "spam",
    summary: "An automated pitch, not an enquiry.",
    reasons: [
      "The same text was submitted from several addresses.",
      "The message contains only links.",
    ],
    age: 6,
    idle: 140,
    phone: false,
    answers: [[Q.challenge, "Rank number one in 24 hours, guaranteed."]],
    note: "The AI marked this lead as spam.",
  },
  {
    name: "Crypto Growth Team",
    company: "CGT Ventures",
    rep: 2,
    stage: "new",
    exit: "spam",
    status: "removed",
    verdict: "spam",
    summary: "Unrelated to any service offered.",
    reasons: ["The message promotes an investment scheme."],
    age: 9,
    idle: 210,
    website: false,
    answers: false,
    note: "The AI marked this lead as spam.",
  },
  // A suspect a rep rejected: spam everywhere, with its booking cancelled.
  {
    name: "Wendell Krause",
    company: "Krause Consulting",
    rep: 3,
    stage: "discovery_booked",
    exit: "spam",
    status: "removed",
    verdict: "suspect",
    review: "spam",
    summary: "The company cannot be found.",
    reasons: ["No listing for this company."],
    calls: [["discovery", 20, "cancelled"]],
    age: 7,
    idle: 80,
    answers: 1,
    note: "Marked as spam after review.",
  },

  // Exit: Nurture.
  {
    name: "Philippa Ashdown",
    company: "Ashdown Florists",
    rep: 0,
    stage: "new",
    exit: "nurture",
    status: "removed",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Shop confirmed."],
    age: 30,
    idle: 300,
    answers: 2,
    note: "No booking or activity for two weeks.",
    followUps: 24,
  },
  {
    name: "Lucian Barros",
    company: "Barros Tiling",
    rep: 1,
    stage: "discovery_booked",
    exit: "nurture",
    status: "removed",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Business confirmed."],
    deck: true,
    calls: [["discovery", -500, "cancelled"]],
    age: 35,
    idle: 340,
    answers: 1,
    note: "No booking or activity for two weeks.",
  },

  // Exit: Lead Lost.
  {
    name: "Cordelia Vance",
    company: "Vance Boutique Hotel",
    rep: 2,
    stage: "discovery_booked",
    exit: "lost",
    status: "not_a_fit",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Hotel confirmed."],
    deck: true,
    calls: [["discovery", -260, "completed"]],
    age: 18,
    idle: 250,
    answers: 3,
    note: "Not qualified after the discovery call.",
  },
  {
    name: "Barnaby Okafor-Lindqvist",
    company: "Lindqvist Custom Cabinetry",
    rep: 3,
    stage: "discovery_booked",
    exit: "lost",
    status: "not_a_fit",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Workshop confirmed."],
    deck: true,
    calls: [["discovery", -180, "completed"]],
    age: 15,
    idle: 170,
    answers: 1,
    note: "Not qualified after the discovery call.",
  },
  {
    name: "Seraphina Duarte",
    company: "Duarte Wellness Studio",
    rep: 0,
    stage: "proposal_sent",
    exit: "lost",
    status: "removed",
    verdict: "valid",
    summary: "Genuine.",
    reasons: ["Studio confirmed."],
    deck: true,
    proposal: "lost",
    calls: [
      ["discovery", -500, "completed"],
      ["proposal_review", -330, "completed"],
    ],
    age: 33,
    idle: 120,
    answers: 2,
    note: "Marked lost. Reason: Chose another agency.",
  },
];

function build(seed: Seed, index: number, now: number): LeadRecord {
  const id = `lead-${String(index + 1).padStart(2, "0")}`;
  const owner = SAMPLE_REPS[seed.rep];
  const iso = (hoursFromNow: number) =>
    new Date(now + hoursFromNow * HOUR).toISOString();
  const created = now - seed.age * DAY;
  // Nothing can have happened before the form came in.
  const updated = Math.max(created, now - seed.idle * HOUR);
  const domain = `${slug(seed.company ?? seed.name)}.example`;

  const crm = { kind: "crm", name: "CRM" } as const;
  const system = { kind: "system", name: "System" } as const;
  const rep = { kind: "user", name: owner.name } as const;
  const verdictWord = { valid: "Valid", suspect: "Suspect", spam: "Spam" };

  // Oldest first here; spread between created and updated, then reversed.
  const happened: Omit<LeadRecord["activities"][number], "id" | "time">[] = [
    {
      actor: crm,
      type: "Form submitted",
      detail: `Came in from ${seed.source ?? "the website form"}.`,
    },
  ];
  if (seed.verdict) {
    happened.push({
      actor: system,
      type: "Verdict",
      detail: `AI verdict: ${verdictWord[seed.verdict]}.`,
    });
  }
  for (let n = 1; n <= (seed.followUps ?? 0); n++) {
    happened.push({
      actor: crm,
      type: "Follow-up sent",
      detail: `Follow-up email ${n} of the booking sequence.`,
    });
  }
  if (seed.review) {
    happened.push({
      actor: rep,
      type: "Suspect reviewed",
      detail:
        seed.review === "cleared" ? "Cleared as valid." : "Marked as spam.",
    });
  }
  if (seed.deck) {
    happened.push({
      actor: system,
      type: "Deck generated",
      detail: "The deck is ready to present.",
    });
  }
  for (const [kind] of seed.calls ?? []) {
    happened.push({
      actor: crm,
      type: "Call booked",
      detail:
        kind === "discovery"
          ? "The lead booked a discovery call."
          : "The lead booked a proposal review.",
    });
  }
  if (
    ["qualified", "review_booked", "proposal_sent", "won"].includes(seed.stage)
  ) {
    happened.push({
      actor: rep,
      type: "Qualified",
      detail: "Marked qualified after the discovery call.",
    });
  }
  if (seed.proposal && seed.proposal !== "draft") {
    happened.push({
      actor: rep,
      type: "Proposal sent",
      detail: "The proposal was sent to the lead.",
    });
  }
  if (seed.stage === "won") {
    happened.push({
      actor: system,
      type: "Proposal signed",
      detail: "The lead signed the proposal.",
    });
  }
  if (seed.exit) {
    happened.push({
      actor: seed.exit === "lost" || seed.review ? rep : system,
      type: "Left the pipeline",
      detail: seed.note ?? "Removed from the pipeline.",
    });
  }
  const span = updated - created;
  const last = Math.max(1, happened.length - 1);

  return {
    id,
    name: seed.name,
    company: seed.company ?? null,
    email:
      seed.email === false
        ? null
        : `${slug(seed.name.split(" ")[0])}@${domain}`,
    phone:
      seed.phone === false
        ? null
        : `(555) 555-01${String(index).padStart(2, "0")}`,
    website: seed.website === false ? null : `https://${domain}`,
    source: seed.source ?? "Website form",
    budget: seed.budget ?? null,
    formAnswers: (seed.answers === false
      ? []
      : typeof seed.answers === "object"
        ? seed.answers
        : ANSWERS[seed.answers ?? 0]
    ).map(([question, answer]) => ({ question, answer })),
    owner: { ...owner },
    stage: seed.stage,
    exit: seed.exit ?? null,
    status: seed.status,
    createdAt: new Date(created).toISOString(),
    updatedAt: new Date(updated).toISOString(),
    verdictRecord: seed.verdict
      ? {
          result: seed.verdict,
          summary: seed.summary ?? "",
          reasons: seed.reasons ?? [],
          reviewOutcome: seed.review ?? null,
          reviewedBy: seed.review ? owner.name : null,
          reviewedAt: seed.review ? new Date(updated).toISOString() : null,
        }
      : null,
    bookings: (seed.calls ?? []).map(([kind, hours, state]) => ({
      kind,
      time: iso(hours),
      state,
    })),
    deck: seed.deck
      ? {
          templateName: "Growth plan",
          viewUrl: `https://decks.example/${id}`,
          pdfUrl: `https://decks.example/${id}.pdf`,
        }
      : null,
    proposal: seed.proposal ? { status: seed.proposal } : null,
    invoice: seed.invoice ? { status: seed.invoice } : null,
    activities: happened
      .map((activity, n) => ({
        ...activity,
        id: `${id}-a${n + 1}`,
        time: new Date(created + (span * n) / last).toISOString(),
      }))
      .reverse(),
  };
}

/** A fresh copy of the sample leads, with every time placed relative to `now`. */
export function buildSampleLeads(now: number): LeadRecord[] {
  return SEEDS.map((seed, index) => build(seed, index, now));
}
