import { ScaleIcon, SendIcon, UserCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FeatureSwitcher } from "@/components/ui/feature-switcher";
import { InView } from "@/components/ui/in-view";
import { LinkButton } from "@/components/ui/link-button";
import { Marquee } from "@/components/ui/marquee";
import { SectionShell, sectionInner } from "@/components/ui/section-shell";
import { StickyNarrative } from "@/components/ui/sticky-narrative";
import { PRODUCT_NAME } from "@/lib/brand";
import { EXIT_LABEL, STAGE_LABEL } from "@/lib/leads/rules";
import { cn } from "@/lib/utils";

import {
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
} from "./illustrations";

/*
 * The landing page's sections, in the order spec 01 numbers them. Each is
 * static and server-rendered; the client islands they use (InView,
 * StickyNarrative, FeatureSwitcher) live in src/components/ui.
 *
 * Copy rule (spec 01): everything here is true. No customers, metrics or
 * third-party names, and decks, proposals and invoicing are marked Planned.
 */

/** Marketing-scale call to action: 48px tall, so it is a comfortable touch target. */
const cta = "h-12 px-6 text-base";

const sectionHeading =
  "text-[clamp(2rem,4.2vw,3.25rem)] leading-[1.04] tracking-[-0.03em]";

const lede = "text-lg text-pretty text-ink-2";

const step = (index: number) => ({ "--i": index }) as React.CSSProperties;

function Planned({ className }: { className?: string }) {
  return (
    <Badge variant="warn" className={className}>
      Planned
    </Badge>
  );
}

/**
 * Section 2. From `lg` the copy and the picture share one grid (`.hero-stage`
 * in marketing.css): the second headline line, the paragraph and the button
 * start on the same column line, the list of leads fills the space to their
 * left, and the verdict sits in front of it under the button, so the picture
 * and its one-time verdict are in the first screenful.
 */
function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate -mt-16 overflow-clip pt-16"
    >
      <div aria-hidden="true" className="hero-wash" />
      <div className={cn(sectionInner, "pt-12 pb-16 sm:pt-16 lg:pb-24")}>
        <h1
          id="hero-heading"
          className="text-[clamp(2.5rem,4.9vw,4rem)] leading-none tracking-[-0.035em] text-wrap"
        >
          <span className="sm:block sm:whitespace-nowrap">
            From new lead to signed proposal,
          </span>{" "}
          <span className="hero-line-2 sm:block">in one place.</span>
        </h1>
        <div className="hero-stage mt-8 lg:mt-9">
          <div className="hero-copy flex flex-col items-start gap-6">
            <p className={cn(lede, "max-w-xl")}>
              {PRODUCT_NAME} sits on top of the CRM you already use, vets each
              inbound lead with AI, builds the deck and proposal, and drafts the
              invoice the moment it is signed.
            </p>
            <LinkButton
              href="/sign-up"
              variant="primary"
              className={cn(cta, "max-sm:w-full")}
            >
              Sign up
            </LinkButton>
          </div>
          <HeroPicture />
        </div>
      </div>
    </section>
  );
}

/**
 * Section 3: stands where a logo row would, with the product's real shape.
 * From `lg` the six stages sit on one rail from edge to edge, a sample lead
 * travels it once, and a bracket under the stages before the last leads down
 * to the exits: a lead can leave before it is won (GLOSSARY.md, "Exit").
 */
function PipelineStrip() {
  const stages = Object.values(STAGE_LABEL);
  return (
    <SectionShell
      labelledBy="pipeline-heading"
      className="py-16 sm:py-20 lg:py-24"
    >
      <h2
        id="pipeline-heading"
        className="text-center text-2xl tracking-[-0.02em] sm:text-3xl"
      >
        One pipeline, six stages, three exits.
      </h2>
      <InView className="stage-track mt-12 lg:mt-14">
        <span aria-hidden="true" className="stage-line" />
        <span aria-hidden="true" className="stage-marker">
          <Initials>MV</Initials>
        </span>
        <ol aria-label="Stages, in order" className="stage-rail">
          {stages.map((stage, index) => (
            <li
              key={stage}
              data-reveal="light"
              style={step(index)}
              className="stage"
            >
              <span aria-hidden="true" className="stage-node">
                {index + 1}
              </span>
              <span className="stage-label">{stage}</span>
            </li>
          ))}
        </ol>
        <span aria-hidden="true" className="stage-bracket" />
        <div className="stage-exits">
          <h3 id="exits-heading" className="label-caps">
            Exits
          </h3>
          <ul aria-labelledby="exits-heading" className="flex flex-wrap gap-2">
            {Object.values(EXIT_LABEL).map((exit, index) => (
              <li
                key={exit}
                data-reveal
                // After the rail has been travelled and the bracket has appeared.
                style={step(30 + index)}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-base font-semibold"
              >
                {exit}
              </li>
            ))}
          </ul>
          <p className="text-ink-2 sm:ml-auto">
            Before it is won, a lead can leave by one of three exits.
          </p>
        </div>
      </InView>
    </SectionShell>
  );
}

/** Section 4. */
function HowItWorks() {
  return (
    <SectionShell
      id="how-it-works"
      labelledBy="how-heading"
      className="py-12 sm:py-16 lg:py-0"
    >
      <StickyNarrative
        heading={
          <h2 id="how-heading" className={sectionHeading}>
            How a lead becomes a signed proposal.
          </h2>
        }
        steps={[
          {
            title: "A lead comes in",
            body: "A new lead arrives from the CRM you already use. Your forms, calendars and follow-ups stay where they are.",
            visual: <IntakePicture />,
          },
          {
            title: "AI researches it",
            body: `${PRODUCT_NAME} looks into the lead and returns a verdict: valid, suspect or spam, with the reasons behind it.`,
            visual: <ResearchPicture />,
          },
          {
            title: "You work it to a signed proposal",
            body: "The lead moves through the pipeline one stage at a time, and always shows the step that comes next.",
            visual: <WorkPicture />,
          },
        ]}
      />
    </SectionShell>
  );
}

/** Section 5. */
function Features() {
  return (
    <SectionShell id="features" labelledBy="features-heading" className="pb-0!">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <h2 id="features-heading" className={sectionHeading}>
          Built around the lead in front of you.
        </h2>
        <p className={lede}>Four parts of the workspace. Open one to see it.</p>
      </div>
      <FeatureSwitcher
        className="mt-12 lg:mt-16"
        items={[
          {
            id: "pipeline",
            title: "Pipeline",
            summary:
              "Every lead by stage, with a Needs you strip for the ones waiting on a person.",
            visual: <PipelinePicture />,
          },
          {
            id: "verdict",
            title: "Verdict",
            summary: "The AI's summary and its reasons, on every lead.",
            visual: <VerdictPicture />,
          },
          {
            id: "suspect-review",
            title: "Suspect review",
            summary:
              "The lead's form answers beside the AI's reasons, and two decisions: clear it or mark it as spam.",
            visual: <SuspectReviewPicture />,
          },
          {
            id: "next-step",
            title: "One next step",
            summary: (
              <>
                Each lead shows one main action and a line saying why. Steps
                that open a deck, a proposal or an invoice draft:{" "}
                <Planned className="align-[0.1em]" />
              </>
            ),
            visual: <NextStepPicture />,
          },
        ]}
      />
    </SectionShell>
  );
}

const CONTROL_POINTS = [
  {
    Icon: UserCheckIcon,
    title: "A rep decides on every suspect",
    body: "When the AI is unsure it says why, and stops. A rep clears the lead or marks it as spam.",
    planned: false,
  },
  {
    Icon: ScaleIcon,
    title: "A rep, not the app, qualifies a lead",
    body: "After the call, a person records whether the lead is a fit.",
    planned: false,
  },
  {
    Icon: SendIcon,
    title: "Nothing is sent to a lead unreviewed",
    body: "A proposal goes out only after a rep has read it.",
    planned: true,
  },
];

/** Section 6. */
function Control() {
  return (
    <SectionShell id="control" labelledBy="control-heading">
      <h2 id="control-heading" className={cn(sectionHeading, "max-w-3xl")}>
        The AI flags. A person decides.
      </h2>
      <div className="mt-12 grid items-center gap-x-16 gap-y-12 lg:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <ControlPicture />
        <InView>
          <ul className="flex flex-col">
            {CONTROL_POINTS.map(({ Icon, title, body, planned }, index) => (
              <li
                key={title}
                data-reveal
                style={step(index)}
                className="flex gap-4 border-line py-6 not-first:border-t first:pt-0 last:pb-0"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-1 size-6 shrink-0 text-ink"
                  strokeWidth={1.75}
                />
                <div className="flex flex-col gap-1.5">
                  <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl tracking-[-0.01em]">
                    {title}
                    {planned && <Planned />}
                  </h3>
                  <p className={cn(lede, "max-w-md text-base")}>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </InView>
      </div>
    </SectionShell>
  );
}

const CONNECTS_TO = [
  { label: "Your CRM", planned: false },
  { label: "AI research", planned: false },
  { label: "Decks", planned: true },
  { label: "Proposals", planned: true },
  { label: "Invoicing", planned: true },
];

/**
 * Section 7. The page's one tonal break: the band reads the other theme's
 * tokens (`inverse`), so it is dark in the light theme and light in the dark
 * theme. The Authority Solutions logo does not appear here (spec 01).
 */
function WorksOnTop() {
  return (
    <SectionShell
      labelledBy="on-top-heading"
      bleed
      className="inverse bg-ground text-ink lg:py-32"
    >
      <div
        className={cn(
          sectionInner,
          "flex flex-col items-center gap-6 text-center",
        )}
      >
        <h2 id="on-top-heading" className={cn(sectionHeading, "max-w-4xl")}>
          Not a replacement for your CRM. It works on top of it.
        </h2>
        <p className={cn(lede, "max-w-xl")}>
          Keep the system your team already runs. {PRODUCT_NAME} connects to it,
          and to the other tools a deal passes through.
        </p>
      </div>
      <Marquee
        label={`What ${PRODUCT_NAME} connects to`}
        className="mt-10 lg:mt-16"
        items={CONNECTS_TO.map(({ label, planned }) => ({
          key: label,
          node: (
            <span className="flex items-center gap-3 font-heading text-3xl font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-4xl">
              {label}
              {planned && <Planned />}
            </span>
          ),
        }))}
      />
    </SectionShell>
  );
}

const FACTS = [
  { value: "6", label: "stages, in order" },
  { value: "3", label: "exits" },
  { value: "1", label: "next step per lead" },
];

/** Section 8: structural facts, in place of metrics the product does not have. */
function ProductFacts() {
  return (
    <SectionShell labelledBy="facts-heading">
      <InView className="rounded-4xl bg-surface px-6 py-12 ring-1 ring-line sm:px-12 sm:py-16 lg:px-16 lg:py-20">
        <h2 id="facts-heading" className={cn(sectionHeading, "max-w-2xl")}>
          {PRODUCT_NAME} in three numbers.
        </h2>
        <p className={cn(lede, "mt-4 max-w-md")}>
          Not usage figures. Each one is true of the product by design.
        </p>
        <dl className="mt-12 grid gap-y-10 sm:grid-cols-3 lg:mt-16">
          {FACTS.map(({ value, label }, index) => (
            <div
              key={label}
              className="flex flex-col-reverse gap-2 border-line sm:not-first:border-l sm:not-first:pl-8 lg:not-first:pl-12"
            >
              <dt className="text-lg text-ink-2">{label}</dt>
              <dd className="overflow-hidden font-heading text-[clamp(5rem,11vw,9rem)] leading-[0.85] font-bold tracking-[-0.04em] tabular-nums">
                <span
                  data-reveal="settle"
                  style={step(index)}
                  className="block"
                >
                  {value}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </InView>
    </SectionShell>
  );
}

/** Section 10. Still: the decision point is calm. */
function ClosingCta() {
  return (
    <SectionShell
      labelledBy="closing-heading"
      className="pt-0!"
      innerClassName="flex flex-col items-center gap-6 text-center"
    >
      <h2 id="closing-heading" className={sectionHeading}>
        Start with your next lead.
      </h2>
      <p className={lede}>
        Create an account, or sign in if you already have one.
      </p>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <LinkButton href="/sign-up" variant="primary" className={cta}>
          Sign up
        </LinkButton>
        <LinkButton href="/sign-in" className={cta}>
          Sign in
        </LinkButton>
      </div>
    </SectionShell>
  );
}

export {
  ClosingCta,
  Control,
  Features,
  Hero,
  HowItWorks,
  PipelineStrip,
  ProductFacts,
  WorksOnTop,
};
