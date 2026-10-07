import {
  ArrowDownIcon,
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InView } from "@/components/ui/in-view";
import {
  ACTION_LABEL,
  STAGE_LABEL,
  STATUS_META,
  VERDICT_META,
} from "@/lib/leads/rules";
import { cn } from "@/lib/utils";

/*
 * The landing page's pictures (spec 01). They are drawn from the design
 * tokens and the product's own chips, labels and wording, so they follow the
 * theme and cannot drift from the app. Every name in them is made up, and
 * each picture that shows a lead says "Sample data". None is a screenshot.
 *
 * Each picture is one image to assistive technology, described by its label.
 * They are composed in two planes: a panel behind and a panel in front that
 * overlaps it, on a softly tinted ground. Motion hooks (`hero-rise`,
 * `swap-*`, `data-step`, `step-*`) are styled in src/app/marketing.css;
 * without them every picture is complete and still.
 */

const panel = "rounded-panel bg-surface ring-1 ring-line";
/** The front plane: a panel with a band of the ground around it, so it reads as lying on top. */
const front = cn(panel, "picture-front relative z-10");

const delay = (index: number) => ({ "--i": index }) as React.CSSProperties;

type Wash = "brand" | "ok" | "warn" | "crit";

function Picture({
  label,
  wash,
  className,
  children,
}: {
  label: string;
  /** The tone of the soft wash across the picture's ground. */
  wash: Wash;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      role="img"
      aria-label={label}
      data-wash={wash}
      className={cn(
        "picture relative isolate overflow-hidden rounded-4xl bg-surface-2 p-4 text-left sm:p-6",
        className,
      )}
    >
      {children}
    </figure>
  );
}

function Initials({ children }: { children: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text">
      {children}
    </span>
  );
}

function Lead({
  initials,
  name,
  company,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "name"> & {
  initials: string;
  name: string;
  company: string;
}) {
  return (
    // `children` sits at the row's end, usually a chip.
    <div
      className={cn("flex items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      <Initials>{initials}</Initials>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        <span className="block truncate text-xs text-ink-2">{company}</span>
      </span>
      {children}
    </div>
  );
}

/** A lead's name as the heading of its own panel. */
function LeadHeading({
  name,
  company,
  children,
}: {
  name: string;
  company: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block truncate font-heading text-lg leading-tight font-semibold">
          {name}
        </span>
        <span className="block truncate text-ink-2">{company}</span>
      </span>
      {children}
    </span>
  );
}

const VERDICT_TONES = {
  ok: {
    box: "border-ok/30 bg-ok-soft",
    word: "text-ok",
    Icon: CircleCheckIcon,
  },
  warn: {
    box: "border-warn/30 bg-warn-soft",
    word: "text-warn",
    Icon: CircleDashedIcon,
  },
  crit: {
    box: "border-crit/30 bg-crit-soft",
    word: "text-crit",
    Icon: TriangleAlertIcon,
  },
} as const;

/** The verdict box as the app draws it, without its heading semantics. */
function Verdict({
  tone,
  word,
  summary,
  reasons = [],
  className,
  ...props
}: React.ComponentProps<"div"> & {
  tone: keyof typeof VERDICT_TONES;
  word: string;
  summary?: string;
  reasons?: string[];
}) {
  const { box, word: wordClass, Icon } = VERDICT_TONES[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-box border p-4",
        box,
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-base font-semibold",
          wordClass,
        )}
      >
        <Icon className="size-4 shrink-0" />
        {word}
      </span>
      {summary && <span className="text-pretty">{summary}</span>}
      {reasons.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {reasons.map((reason) => (
            <li key={reason} className="text-pretty">
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Hint({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex items-start gap-1.5 text-pretty text-ink-2",
        className,
      )}
    >
      <InfoIcon className="mt-[3px] size-4 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

function FakeButton({
  variant,
  children,
}: {
  variant?: "primary" | "danger";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(buttonVariants({ variant }), "pointer-events-none w-fit")}
    >
      {children}
    </span>
  );
}

/** Two states of one spot, stacked: the picture rests on the second. */
function Swap({
  from,
  to,
  kind = "swap",
  className,
}: {
  from: React.ReactNode;
  to: React.ReactNode;
  /** "swap" plays once when the picture is seen; "step" when its narrative step is current. */
  kind?: "swap" | "step";
  className?: string;
}) {
  return (
    <span className={cn("grid *:col-start-1 *:row-start-1", className)}>
      <span className={`${kind}-out`}>{from}</span>
      <span className={`${kind}-in`}>{to}</span>
    </span>
  );
}

const SAMPLE = {
  marisol: {
    initials: "MV",
    name: "Marisol Vega",
    company: "Vega Roofing Co.",
  },
  tobias: {
    initials: "TL",
    name: "Tobias Lindqvist",
    company: "Northlight Dental",
  },
  priya: {
    initials: "PR",
    name: "Priya Raman",
    company: "Raman & Lowe Architects",
  },
  dale: {
    initials: "DO",
    name: "Dale Okafor",
    company: "Okafor Heating & Air",
  },
} as const;

const VALID_REASONS = [
  "The website matches the company name.",
  "The phone number is a local business line.",
  "The request describes a real project.",
];

const SUSPECT_REASONS = [
  "The email domain does not match the company.",
  "No website was found for this business.",
];

function VerdictChip({ verdict }: { verdict: keyof typeof VERDICT_META }) {
  const { label, tone } = VERDICT_META[verdict];
  return <Badge variant={tone}>{label}</Badge>;
}

/**
 * Section 2: leads in the pipeline, and in front of them one lead receiving
 * its verdict. From `lg` the hero's grid places the two planes (see
 * `.hero-stage` in marketing.css); the swap plays once when the picture is seen.
 */
function HeroPicture() {
  return (
    <InView
      role="img"
      aria-label="A sample of Dealwright: a list of leads, each with the AI's verdict, and in front of it one lead's verdict with the reasons for it."
      className="hero-picture text-left"
    >
      <div aria-hidden="true" className="hero-plane" />
      <div
        className={cn(panel, "hero-list hero-rise overflow-hidden")}
        style={delay(0)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="font-heading text-base font-semibold">Pipeline</span>
          <Badge>Sample data</Badge>
        </div>
        {/* As in the app, the stage tabs run on past the edge and scroll sideways. */}
        <div className="fade-right flex gap-5 overflow-hidden border-b border-line px-4 whitespace-nowrap text-ink-2">
          <span className="border-b-2 border-ink py-2 font-semibold text-ink">
            All open
          </span>
          {Object.values(STAGE_LABEL).map((stage) => (
            <span key={stage} className="py-2">
              {stage}
            </span>
          ))}
        </div>
        <Lead
          {...SAMPLE.marisol}
          className="hero-rise bg-surface-2 shadow-[inset_2px_0_0_var(--brand)]"
          style={delay(2)}
        >
          <Swap
            className="justify-items-end"
            from={<VerdictChip verdict="awaiting" />}
            to={<VerdictChip verdict="valid" />}
          />
        </Lead>
        <Lead
          {...SAMPLE.tobias}
          className="hero-rise border-t border-line"
          style={delay(3)}
        >
          <VerdictChip verdict="valid" />
        </Lead>
        <Lead
          {...SAMPLE.priya}
          className="hero-rise border-t border-line"
          style={delay(4)}
        >
          <VerdictChip verdict="suspect" />
        </Lead>
        <Lead
          {...SAMPLE.dale}
          className="hero-rise border-t border-line max-sm:hidden"
          style={delay(5)}
        >
          <VerdictChip verdict="valid" />
        </Lead>
      </div>

      <div
        className={cn(front, "hero-verdict hero-rise flex flex-col gap-3 p-4")}
        style={delay(4)}
      >
        <LeadHeading {...SAMPLE.marisol} />
        <Swap
          from={
            <Verdict
              tone="warn"
              word={STATUS_META.awaiting_verdict.label}
              summary="The AI is researching this lead."
              className="h-full"
            />
          }
          to={
            <Verdict
              tone="ok"
              word={VERDICT_META.valid.label}
              summary="A genuine roofing company asking about a real job."
              reasons={VALID_REASONS.slice(0, 2)}
            />
          }
        />
      </div>
    </InView>
  );
}

/** Step 1: a form submission in the customer's CRM becomes a new lead. */
function IntakePicture() {
  return (
    <Picture
      wash="warn"
      label="A web form filled in inside your CRM becomes a new lead in Dealwright."
      className="w-full sm:p-8"
    >
      <div
        className="rounded-panel border border-dashed border-ink-3 p-4 sm:w-[76%] sm:pb-12"
        data-step
        style={delay(0)}
      >
        <span className="label-caps">Your CRM</span>
        <span className="mt-3 block font-semibold">Web form submitted</span>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-2">
          <dt>Name</dt>
          <dd className="text-ink">{SAMPLE.marisol.name}</dd>
          <dt>Company</dt>
          <dd className="text-ink">{SAMPLE.marisol.company}</dd>
          <dt>Asked for</dt>
          <dd className="text-ink">A quote for a new roof</dd>
        </dl>
      </div>
      <div
        className={cn(
          front,
          "mt-3 overflow-hidden sm:-mt-8 sm:ml-auto sm:w-[80%]",
        )}
        data-step
        style={delay(2)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <span className="flex items-center gap-2 font-heading text-base font-semibold">
            <ArrowDownIcon className="size-4 text-ink-2" />
            {STAGE_LABEL.new}
          </span>
          <Badge>Sample data</Badge>
        </div>
        <Lead {...SAMPLE.marisol} data-step style={delay(4)}>
          <VerdictChip verdict="awaiting" />
        </Lead>
        <Hint className="border-t border-line px-4 py-3">
          Waiting for the lead to book a call. Your CRM is following up.
        </Hint>
      </div>
    </Picture>
  );
}

/** Step 2: the AI checks the lead, and the verdict resolves to one of three. */
function ResearchPicture() {
  const checks = [
    "Company website",
    "Phone number",
    "Email domain",
    "What they asked for",
  ];
  return (
    <Picture
      wash="ok"
      label="The AI checks a lead's website, phone number, email and request, then returns a verdict: valid, suspect or spam. This one is valid."
      className="w-full sm:p-8"
    >
      <div
        className={cn(panel, "overflow-hidden sm:w-[84%] sm:pb-8")}
        data-step
        style={delay(0)}
      >
        <Lead {...SAMPLE.marisol}>
          <Badge>Sample data</Badge>
        </Lead>
        <ul className="grid gap-2 border-t border-line px-4 py-3 sm:grid-cols-2">
          {checks.map((check, index) => (
            <li
              key={check}
              className="flex items-center gap-2"
              data-step
              style={delay(index + 1)}
            >
              <span className="grid size-5 place-items-center rounded-full bg-ok-soft text-ok">
                <CheckIcon className="size-3.5" />
              </span>
              {check}
            </li>
          ))}
        </ul>
      </div>
      <div
        className={cn(
          front,
          "mt-3 flex flex-col gap-3 p-4 sm:-mt-6 sm:ml-auto sm:w-[78%]",
        )}
        data-step
        style={delay(5)}
      >
        <span className="label-caps">Verdict</span>
        <span className="grid grid-cols-3 gap-2">
          {(["valid", "suspect", "spam"] as const).map((verdict) => (
            <span
              key={verdict}
              className={cn(
                "rounded-control border border-line px-3 py-1.5 text-center font-semibold text-ink-2",
                verdict === "valid" && "step-lit",
              )}
            >
              {VERDICT_META[verdict].label}
            </span>
          ))}
        </span>
        <Swap
          kind="step"
          from={
            <Verdict
              tone="warn"
              word={STATUS_META.awaiting_verdict.label}
              summary="The AI is researching this lead."
              className="h-full"
            />
          }
          to={
            <Verdict
              tone="ok"
              word={VERDICT_META.valid.label}
              reasons={VALID_REASONS}
            />
          }
        />
      </div>
    </Picture>
  );
}

/** Step 3: the lead moves stage by stage; the next step changes as it does. */
function WorkPicture() {
  const stages = Object.values(STAGE_LABEL);
  const last = stages.length - 1;
  return (
    <Picture
      wash="brand"
      label="A lead's progress through the six stages, from New lead to Lead Won. In front, the lead's one next step: first waiting for a signature, then signed."
      className="w-full sm:p-8"
    >
      <ol className={cn(panel, "flex flex-col gap-3 p-4 sm:w-[58%] sm:pb-6")}>
        {stages.map((stage, index) => (
          <li
            key={stage}
            className="flex items-center gap-2.5 font-semibold"
            data-step
            style={delay(index)}
          >
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full",
                index < last
                  ? "bg-ink text-ground"
                  : "bg-ok-soft text-ok ring-1 ring-ok/40",
                index === last && "step-in",
              )}
            >
              <CheckIcon className="size-3.5" />
            </span>
            {stage}
          </li>
        ))}
      </ol>
      <div
        className={cn(
          front,
          "mt-3 flex flex-col gap-3 p-4 sm:-mt-28 sm:ml-auto sm:w-[60%]",
        )}
        data-step
        style={delay(6)}
      >
        <LeadHeading {...SAMPLE.marisol}>
          <Badge>Sample data</Badge>
        </LeadHeading>
        <Swap
          kind="step"
          className="justify-items-start"
          from={<Badge>{STAGE_LABEL.proposal_sent}</Badge>}
          to={<Badge variant="ok">{STAGE_LABEL.won}</Badge>}
        />
        <Swap
          kind="step"
          from={
            <Hint>
              Proposal sent. Waiting for the lead to view and sign it.
            </Hint>
          }
          to={<Hint>Signed. This lead is won.</Hint>}
        />
      </div>
    </Picture>
  );
}

/** Feature: every lead by stage, with a "needs you" strip. */
function PipelinePicture() {
  return (
    <Picture
      wash="brand"
      label="The Pipeline: a Needs you strip counting suspects to review and calls today, above leads listed by stage."
      className="flex h-full flex-col justify-center gap-3"
    >
      <span className="label-caps">Needs you</span>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["2", "Suspects to review"],
          ["3", "Calls today"],
        ].map(([count, label]) => (
          <span
            key={label}
            className="flex min-h-14 flex-col justify-center gap-0.5 rounded-control border border-line bg-surface px-3 py-2"
          >
            <span className="font-heading text-xl leading-none font-bold tabular-nums">
              {count}
            </span>
            <span className="text-ink-2">{label}</span>
          </span>
        ))}
      </div>
      <div className={cn(panel, "overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <span className="font-semibold">{STAGE_LABEL.discovery_booked}</span>
          <Badge>Sample data</Badge>
        </div>
        <Lead {...SAMPLE.tobias}>
          <VerdictChip verdict="valid" />
        </Lead>
        <Lead {...SAMPLE.priya} className="border-t border-line">
          <VerdictChip verdict="suspect" />
        </Lead>
        <Lead {...SAMPLE.dale} className="border-t border-line">
          <VerdictChip verdict="valid" />
        </Lead>
      </div>
    </Picture>
  );
}

/** Feature: the AI's summary and reasons on a lead. */
function VerdictPicture() {
  return (
    <Picture
      wash="crit"
      label="A lead's verdict: Suspect, with a one-line summary and the AI's two reasons, and the next step: decide whether it is genuine."
      className="flex h-full flex-col justify-center"
    >
      <div className={cn(panel, "sm:w-[88%] sm:pb-6")}>
        <Lead {...SAMPLE.priya}>
          <Badge>Sample data</Badge>
        </Lead>
        <span className="flex items-center gap-2 border-t border-line px-4 py-3 text-ink-2">
          Status
          <Badge variant={STATUS_META.flagged_suspect.tone}>
            {STATUS_META.flagged_suspect.label}
          </Badge>
        </span>
      </div>
      <div
        className={cn(
          front,
          "mt-3 flex flex-col gap-3 p-4 sm:-mt-4 sm:ml-auto sm:w-[92%]",
        )}
      >
        <Verdict
          tone="crit"
          word={VERDICT_META.suspect.label}
          summary="The AI is unsure this is a real enquiry."
          reasons={SUSPECT_REASONS}
        />
        <Hint>
          The AI is unsure about this lead. Decide whether it is genuine.
        </Hint>
      </div>
    </Picture>
  );
}

/** Feature: the lead's answers beside the AI's reasons, and two decisions. */
function SuspectReviewPicture() {
  return (
    <Picture
      wash="warn"
      label="Suspect review: what the lead said on the form beside why the AI is unsure, with two decisions, Clear as valid and Mark as spam."
      className="flex h-full flex-col justify-center"
    >
      <div className={cn(panel, "flex flex-col gap-4 p-4")}>
        <LeadHeading {...SAMPLE.priya}>
          <Badge>Sample data</Badge>
        </LeadHeading>
        <span className="flex flex-col gap-2">
          <span className="label-caps">What the lead said</span>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-2">
            <dt>Email</dt>
            <dd className="truncate text-ink">priya@example.com</dd>
            <dt>Website</dt>
            <dd className="text-ink">Not given</dd>
          </dl>
        </span>
        <span className="flex flex-col gap-2">
          <span className="label-caps">Why the AI is unsure</span>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {SUSPECT_REASONS.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </span>
        <span className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <FakeButton variant="primary">Clear as valid</FakeButton>
          <FakeButton variant="danger">Mark as spam</FakeButton>
        </span>
      </div>
    </Picture>
  );
}

/** Feature: one main action per lead and a line saying why. */
function NextStepPicture() {
  const stages = Object.values(STAGE_LABEL);
  const current = stages.indexOf(STAGE_LABEL.discovery_booked);
  return (
    <Picture
      wash="ok"
      label="A lead in the Discovery Call Booked stage with one main action, Qualified, and a line under it saying why: the call is done, record whether this lead is a fit."
      className="flex h-full flex-col justify-center"
    >
      <div className={cn(panel, "flex flex-col gap-3 p-4 sm:w-[90%] sm:pb-8")}>
        <LeadHeading {...SAMPLE.tobias}>
          <Badge>Sample data</Badge>
        </LeadHeading>
        <span className="flex items-center gap-1.5">
          {stages.map((stage, index) => (
            <span
              key={stage}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index <= current ? "bg-ink" : "bg-line",
              )}
            />
          ))}
        </span>
        <span className="font-semibold">{STAGE_LABEL.discovery_booked}</span>
      </div>
      <div
        className={cn(
          front,
          "mt-3 flex flex-col gap-3 p-4 sm:-mt-4 sm:ml-auto sm:w-[90%]",
        )}
      >
        <span className="label-caps">Next step</span>
        <span className="flex flex-wrap items-center gap-3">
          <FakeButton variant="primary">{ACTION_LABEL.qualify}</FakeButton>
          <FakeButton>{ACTION_LABEL.not_qualify}</FakeButton>
        </span>
        <Hint>The call is done. Record whether this lead is a fit.</Hint>
      </div>
    </Picture>
  );
}

/** Section 6: the AI flags, a rep decides. */
function ControlPicture({ className }: { className?: string }) {
  return (
    <Picture
      wash="crit"
      label="The AI flags a lead as suspect with its reasons. In front of it, a rep's decision clears the lead as valid."
      className={cn("sm:p-8", className)}
    >
      <div className={cn(panel, "flex flex-col gap-3 p-4 sm:w-[86%] sm:pb-10")}>
        <span className="flex items-center justify-between gap-3">
          <span className="label-caps">The AI flags</span>
          <Badge>Sample data</Badge>
        </span>
        <Lead {...SAMPLE.priya} className="px-0 py-0" />
        <Verdict
          tone="crit"
          word={VERDICT_META.suspect.label}
          reasons={SUSPECT_REASONS}
        />
      </div>
      <div
        className={cn(
          front,
          "mt-3 flex flex-col gap-3 p-4 sm:-mt-6 sm:ml-auto sm:w-[72%]",
        )}
      >
        <span className="label-caps">A rep decides</span>
        <span className="flex flex-wrap items-center gap-3">
          <FakeButton variant="primary">Clear as valid</FakeButton>
          <FakeButton variant="danger">Mark as spam</FakeButton>
        </span>
        <span className="flex items-center gap-2 text-ink-2">
          <ArrowRightIcon className="size-4" />
          Cleared by a rep.
          <VerdictChip verdict="valid" />
        </span>
      </div>
    </Picture>
  );
}

export {
  ControlPicture,
  HeroPicture,
  Initials,
  IntakePicture,
  NextStepPicture,
  PipelinePicture,
  ResearchPicture,
  SuspectReviewPicture,
  VerdictPicture,
  WorkPicture,
};
