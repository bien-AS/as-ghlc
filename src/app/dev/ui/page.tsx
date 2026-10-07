import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthoritySolutionsLogo } from "@/components/ui/authority-solutions-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FeatureSwitcher } from "@/components/ui/feature-switcher";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { HintLine } from "@/components/ui/hint-line";
import { InView } from "@/components/ui/in-view";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { Marquee } from "@/components/ui/marquee";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PanelSection } from "@/components/ui/panel-section";
import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideFrame } from "@/components/ui/slide-frame";
import {
  EmptyState,
  ErrorState,
  NotAllowedState,
} from "@/components/ui/state-panel";
import { StatusLine } from "@/components/ui/status-line";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VerdictBox } from "@/components/ui/verdict-box";
import { Wordmark } from "@/components/ui/wordmark";

import { RolePreviewDemo } from "./role-preview-demo";

export const metadata: Metadata = { title: "UI foundations · Dealwright" };

// Full class names so Tailwind can see them.
const swatches = [
  ["ground", "bg-ground"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["line", "bg-line"],
  ["ink", "bg-ink"],
  ["ink-2", "bg-ink-2"],
  ["ink-3", "bg-ink-3"],
  ["brand", "bg-brand"],
  ["brand-ink", "bg-brand-ink"],
  ["brand-text", "bg-brand-text"],
  ["brand-soft", "bg-brand-soft"],
  ["ok", "bg-ok"],
  ["ok-soft", "bg-ok-soft"],
  ["warn", "bg-warn"],
  ["warn-soft", "bg-warn-soft"],
  ["crit", "bg-crit"],
  ["crit-soft", "bg-crit-soft"],
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 className="label-caps">{title}</h2>
      {children}
    </section>
  );
}

/** Development only: every foundation in one place, for reviewing both themes. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-10 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">UI foundations</h1>
          <p className="max-w-[65ch] text-muted-foreground">
            Spec 03 tokens and base components. Development only; this route is
            not found in a production build.
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {swatches.map(([name, className]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <span
                className={`h-12 rounded-control border border-line ${className}`}
              />
              <code className="font-mono text-xs text-muted-foreground">
                {name}
              </code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-4xl font-bold tracking-tight">
            Heading 700, Bricolage Grotesque
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight">
            Heading 600, lead names and panel titles
          </p>
          <p className="max-w-[65ch]">
            Body 400, Source Sans 3 at 15px on a 1.5 line height. A rep works
            entirely in the app and never opens the CRM behind it.{" "}
            <span className="font-semibold">Body 600 for emphasis.</span>{" "}
            <a href="#top" className="text-brand-text underline">
              Links use brand-text
            </a>
            .
          </p>
          <p className="text-muted-foreground">
            Secondary text uses ink-2 in both themes.
          </p>
          <p className="label-caps">Label 500, IBM Plex Mono, uppercase</p>
          <p className="font-mono text-xs">Label 400, IBM Plex Mono, 12px</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button>Default</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button disabled>Disabled</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline" />}>
              Hover for tooltip
            </TooltipTrigger>
            <TooltipContent>Tooltip on the ink surface</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="ok">Valid</Badge>
          <Badge variant="warn">Awaiting</Badge>
          <Badge variant="crit">Suspect</Badge>
          <Badge variant="neutral">Sample data</Badge>
        </div>
      </Section>

      <Section title="Form controls">
        <FieldGroup className="max-w-md">
          <Field>
            <FieldLabel htmlFor="dev-email">Email</FieldLabel>
            <Input
              id="dev-email"
              type="email"
              placeholder="rep@example.com"
              aria-describedby="dev-email-hint"
            />
            <FieldDescription id="dev-email-hint">
              The hint sits under the input.
            </FieldDescription>
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="dev-password">Password</FieldLabel>
            <Input
              id="dev-password"
              type="password"
              defaultValue="short"
              aria-invalid="true"
              aria-describedby="dev-password-error"
            />
            <FieldError id="dev-password-error">
              Use at least 8 characters.
            </FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="dev-search">Search</FieldLabel>
            <Input id="dev-search" type="search" placeholder="Search leads" />
          </Field>
          <Field>
            <FieldLabel htmlFor="dev-stage">Stage</FieldLabel>
            <NativeSelect id="dev-stage" defaultValue="Qualified">
              <NativeSelectOption>New lead</NativeSelectOption>
              <NativeSelectOption>Qualified</NativeSelectOption>
              <NativeSelectOption>Proposal Sent</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="dev-disabled">Disabled</FieldLabel>
            <Input id="dev-disabled" disabled defaultValue="Cannot edit" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="dev-check" defaultChecked />
            <FieldLabel htmlFor="dev-check">Checkbox</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id="dev-switch" defaultChecked />
            <FieldLabel htmlFor="dev-switch">Switch</FieldLabel>
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Panel, tabs, skeleton">
        <div className="grid items-start gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Panel title</CardTitle>
              <CardDescription>
                Surface background, line border, 13px radius.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="label-caps">Panel heading</p>
              <p>Panel body text in ink on surface.</p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="primary">Save</Button>
              <Button>Cancel</Button>
            </CardFooter>
          </Card>
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="won">Won</TabsTrigger>
              <TabsTrigger value="exits">Exits</TabsTrigger>
            </TabsList>
            <TabsContent value="open">Open leads.</TabsContent>
            <TabsContent value="won">Won leads.</TabsContent>
            <TabsContent value="exits">
              Spam, Nurture and Lead Lost.
            </TabsContent>
          </Tabs>
        </div>
      </Section>

      <Section title="Wordmark and logo">
        <div className="flex flex-col items-start gap-4">
          <Wordmark />
          <Wordmark endorsed />
          <AuthoritySolutionsLogo height={32} />
          <div className="light rounded-panel bg-surface p-6 ring-1 ring-line">
            <AuthoritySolutionsLogo height={32} surface="light" />
          </div>
          <div className="dark rounded-panel bg-ground p-6">
            <AuthoritySolutionsLogo height={32} surface="dark" />
          </div>
        </div>
      </Section>

      <Section title="Dashboard pieces">
        <div className="grid gap-4 md:grid-cols-3">
          <VerdictBox
            tone="ok"
            word="Valid"
            summary="An established practice with a clear request."
            reasons={["The practice and the person both check out."]}
          />
          <VerdictBox
            tone="warn"
            word="Awaiting"
            summary="The AI is still checking this lead."
          />
          <VerdictBox
            tone="crit"
            word="Suspect"
            summary="The company cannot be found and the budget does not fit the request."
            reasons={[
              "No business with this name is listed at the address given.",
              "The email domain was registered this week.",
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Qualified</Button>
          <Button>Not qualified</Button>
          <LinkButton href="/dev/ui">A link as a button</LinkButton>
          <Button variant="danger">Mark lost</Button>
        </div>
        <HintLine>
          The call is done. Record whether this lead is a fit.
        </HintLine>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <StatusLine tone="warn">Awaiting verdict</StatusLine>
          <StatusLine tone="crit">Flagged suspect</StatusLine>
          <StatusLine tone="ok">Deck ready</StatusLine>
          <StatusLine tone="brand">Needs a decision</StatusLine>
        </div>
        <ul className="max-w-md divide-y divide-border overflow-hidden rounded-panel bg-card ring-1 ring-border">
          <li>
            <ListRow href="/dev/ui">
              <ListRowName>A row in a list</ListRowName>
              <span className="text-muted-foreground">
                Hover uses surface-2
              </span>
            </ListRow>
          </li>
          <li>
            <ListRow href="/dev/ui" selected>
              <ListRowName>The selected row</ListRowName>
              <span className="text-muted-foreground">A brand left edge</span>
            </ListRow>
          </li>
          <li>
            <ListRow href="/dev/ui">
              <ListRowName removed>A lead that has left</ListRowName>
              <span className="text-muted-foreground">
                Left the pipeline: Spam
              </span>
            </ListRow>
          </li>
        </ul>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            title="No leads match"
            description="Nothing in All open matches the search."
            action={<Button>Clear filters</Button>}
          />
          <ErrorState
            title="The leads could not be loaded"
            description="Nothing was changed. Check your connection and try again."
            action={<Button>Try again</Button>}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PanelSection
            title="A panel section"
            actions={<Button size="sm">An action</Button>}
          >
            <p>
              The titled panel a dashboard screen is made of. Lists inside it
              are rows with dividers.
            </p>
          </PanelSection>
          <NotAllowedState />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SlideFrame
            variant="title"
            heading="A deck's opening slide"
            body="Sized from its own width, so it reads the same small and full screen."
            footer="Discovery · 1 of 7"
          />
          <SlideFrame
            heading="A content slide"
            bullets={["A point on the slide.", "A second point."]}
            footer="Discovery · 2 of 7"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RolePreviewDemo />
          <span className="text-muted-foreground">
            The role preview, shown only on sample data.
          </span>
        </div>
        <PlaceholderPanel
          name="A screen that is not built"
          willDo="One sentence saying what the screen will do."
          waitingOn={["What it is waiting on.", "And who decides it."]}
        />
      </Section>

      <Section title="Marketing pieces">
        <p className="max-w-[65ch] text-muted-foreground">
          The pieces of the public site. The nav, the footer and the pinned
          narrative are page-level and are reviewed on{" "}
          <LinkButton href="/" variant="link" className="h-auto p-0">
            the landing page
          </LinkButton>
          .
        </p>
        <div className="flex flex-col items-start gap-2">
          <span className="label-caps">
            A second theme switch on the same page
          </span>
          {/* Its own radio group; it always agrees with the one in the header. */}
          <ThemeSwitch />
        </div>
        <FeatureSwitcher
          items={["First", "Second", "Third"].map((title) => ({
            id: title.toLowerCase(),
            title,
            summary: "One or two sentences that are always visible.",
            visual: (
              <div className="grid h-full min-h-40 place-items-center rounded-4xl bg-surface-2 text-muted-foreground">
                The {title.toLowerCase()} item's picture
              </div>
            ),
          }))}
        />
        <div className="inverse rounded-panel bg-ground py-6 text-ink">
          <p className="px-6 text-muted-foreground">
            An inverse band: the other theme's tokens, in both themes.
          </p>
          <Marquee
            label="Sample marquee"
            items={["One", "Two", "Three", "Four", "Five"].map((label) => ({
              key: label,
              node: (
                <span className="font-heading text-2xl font-semibold whitespace-nowrap">
                  {label}
                </span>
              ),
            }))}
          />
        </div>
        <InView className="flex gap-3">
          {["Revealed", "one", "after", "another"].map((word, index) => (
            <Badge
              key={word}
              data-reveal
              style={{ "--i": index } as React.CSSProperties}
            >
              {word}
            </Badge>
          ))}
        </InView>
      </Section>
    </main>
  );
}
