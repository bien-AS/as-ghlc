"use client";

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { HintLine } from "@/components/ui/hint-line";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { ListRow, ListRowName } from "@/components/ui/list-row";
import { LocalTime } from "@/components/ui/local-time";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideFrame } from "@/components/ui/slide-frame";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  useDeck,
  useDeckSlots,
  useDecks,
  useSwitchTemplate,
  useUpdateSlide,
} from "@/hooks/use-decks";
import { useHydrated } from "@/hooks/use-hydrated";
import { useLead } from "@/hooks/use-leads";
import { ApiError } from "@/lib/api/client";
import { DECK_EDITOR, DECK_TEMPLATE_LABEL } from "@/lib/decks/rules";
import {
  type BookingSlot,
  DECK_TEMPLATES,
  type Deck,
  type DeckTemplate,
  parseDeckAddress,
  type Slide,
  slideFormSchema,
  type UpdateSlideInput,
} from "@/lib/decks/schemas";
import { clearErrorOnEdit, type FieldErrors, readForm } from "@/lib/forms";
import { cn } from "@/lib/utils";

import {
  DECK_PRESENTER_HREF,
  deckHref,
  leadHref,
  PIPELINE_HREF,
} from "../navigation";

/** What the server already knows is not there: the lead, or only its deck. */
export type DeckScreenMissing = "lead" | "deck" | undefined;

/** The 44px Touch Rule: taller controls below `nav` and on a coarse pointer. */
const TOUCH = "max-nav:min-h-11 pointer-coarse:min-h-11";

/** A slide's place in the address. The first slide needs no number. */
const slideHref = (leadId: string, number: number) =>
  `${deckHref(leadId)}${number > 1 ? `&slide=${number}` : ""}`;

const is404 = (error: unknown) =>
  error instanceof ApiError && error.status === 404;

/**
 * The deck presenter (spec 13, a MOCKUP: the spec is blocked on question 2).
 * With no lead in the address it is the picker; with `?lead=<id>` it is that
 * lead's deck, and `&slide=<n>` is the slide on screen, so a reload or a
 * shared link lands on the same slide.
 */
export function DeckScreen({ missing }: { missing?: DeckScreenMissing }) {
  const { lead: leadId, slide } = parseDeckAddress(
    Object.fromEntries(useSearchParams()),
  );
  return leadId ? (
    // Keyed by lead: another lead's deck starts with nothing left over.
    <DeckPresenter
      key={leadId}
      leadId={leadId}
      slideNumber={slide}
      missing={missing}
    />
  ) : (
    <DeckPicker />
  );
}

// --- the picker --------------------------------------------------------------

function DeckPicker() {
  const decks = useDecks();
  const headingId = useId();
  const header = (
    <PageHeader
      title="Deck presenter"
      description="Choose a lead to present their deck, change its text or download it."
    />
  );

  if (decks.isPending) {
    return (
      <>
        {header}
        <output aria-label="Loading decks" className="flex flex-col gap-2">
          {["a", "b", "c", "d", "e"].map((row) => (
            <Skeleton key={row} className="h-14 w-full" />
          ))}
        </output>
      </>
    );
  }
  if (decks.isError && !decks.data) {
    return (
      <>
        {header}
        <ErrorState
          title="The decks could not be loaded"
          description="Nothing was changed. Check your connection and try again."
          retrying={decks.isFetching}
          onRetry={() => decks.refetch()}
        />
      </>
    );
  }
  if (decks.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No decks yet"
          description="Decks generate on their own for valid leads. When one of your leads has a deck, it is listed here."
          action={
            <LinkButton href={PIPELINE_HREF}>Go to the Pipeline</LinkButton>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <section
        aria-labelledby={headingId}
        className="flex flex-col overflow-hidden rounded-panel bg-card ring-1 ring-border"
      >
        <h2
          id={headingId}
          className="border-b border-border px-4 py-2.5 label-caps"
        >
          Decks <span className="tabular-nums">({decks.data.length})</span>
        </h2>
        <ul className="divide-y divide-border">
          {decks.data.map(({ lead, template }) => (
            <li key={lead.id}>
              <ListRow
                href={deckHref(lead.id)}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5"
              >
                <span className="flex min-w-0 flex-col">
                  <ListRowName>{lead.name}</ListRowName>
                  <span className="truncate text-muted-foreground">
                    {lead.company ?? "No company given"}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {DECK_TEMPLATE_LABEL[template]} template
                </span>
              </ListRow>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// --- the presenter -----------------------------------------------------------

type Mode = "off" | "native" | "fallback";

function DeckPresenter({
  leadId,
  slideNumber,
  missing,
}: {
  leadId: string;
  slideNumber: number;
  missing: DeckScreenMissing;
}) {
  const lead = useLead(missing === "lead" ? undefined : leadId);
  const deck = useDeck(missing ? undefined : leadId);

  const allDecks = (
    <LinkButton href={DECK_PRESENTER_HREF}>See all decks</LinkButton>
  );
  if (missing === "lead" || is404(lead.error)) {
    return (
      <EmptyState
        title="This lead does not exist"
        description="It may have been removed, or the link may be wrong."
        action={allDecks}
      />
    );
  }
  if (missing === "deck" || is404(deck.error)) {
    if (lead.isPending) return <DeckSkeleton />;
    return (
      <EmptyState
        title={`${lead.data?.name ?? "This lead"} has no deck yet`}
        description="Decks generate on their own for valid leads. There is nothing to start by hand: when this lead's deck is ready, it opens here."
        action={
          <span className="flex flex-wrap justify-center gap-3">
            <LinkButton href={leadHref(leadId)}>Open the lead</LinkButton>
            {allDecks}
          </span>
        }
      />
    );
  }
  if (deck.isPending) return <DeckSkeleton />;
  if (deck.isError && !deck.data) {
    return (
      <ErrorState
        title="This deck could not be loaded"
        description="Nothing was changed. Check your connection and try again."
        retrying={deck.isFetching}
        onRetry={() => deck.refetch()}
        action={allDecks}
      />
    );
  }
  return <Presenter deck={deck.data} slideNumber={slideNumber} />;
}

function Presenter({ deck, slideNumber }: { deck: Deck; slideNumber: number }) {
  const router = useRouter();
  const leadId = deck.lead.id;
  const slots = useDeckSlots(leadId);
  const update = useUpdateSlide(leadId);
  const switchTemplate = useSwitchTemplate(leadId);
  const templateId = useId();
  const slidesId = useId();

  const count = deck.slides.length;
  // A number past the end (a pasted link, or a shorter template) is the last slide.
  const number = Math.min(slideNumber, count);
  const slide = deck.slides[number - 1] as Slide;

  const [mode, setMode] = useState<Mode>("off");
  const presenting = mode !== "off";
  const [editingId, setEditingId] = useState<string>();
  // Leaving the slide leaves its editor: `editing` is tied to the slide's id.
  const editing = editingId === slide.id && !presenting;

  const stageRef = useRef<HTMLDivElement>(null);
  const presentRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);

  // --- full screen -----------------------------------------------------------

  const present = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (!document.fullscreenEnabled) throw new Error("unavailable");
      await stage.requestFullscreen();
      setMode("native");
    } catch {
      // Unavailable or refused (an embedded page, some phones): the same
      // layout as a fixed layer over the whole window.
      setMode("fallback");
    }
  };
  const stopPresenting = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setMode("off");
  };

  // The browser's own Escape (or its exit control) leaves native full screen.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setMode((current) => (current === "native" ? "off" : current));
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Focus goes into the full-screen layer, and back to the control that opened it.
  const wasPresenting = useRef(false);
  useEffect(() => {
    if (presenting) stageRef.current?.focus();
    else if (wasPresenting.current) presentRef.current?.focus();
    wasPresenting.current = presenting;
  }, [presenting]);

  // --- keys ------------------------------------------------------------------

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey) return;
      if (event.metaKey || event.shiftKey) return;
      if (event.key === "Escape" && mode === "fallback") {
        setMode("off");
        return;
      }
      // Arrow keys belong to a field, a select or a menu while one has focus.
      const target = event.target as Element | null;
      if (
        editing ||
        target?.closest?.(
          "input, textarea, select, [contenteditable], [role=menu], [role=dialog], [role=alertdialog]",
        )
      ) {
        return;
      }
      const step =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      const next = number + step;
      if (!step || next < 1 || next > count) return;
      event.preventDefault();
      router.replace(slideHref(leadId, next), { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, leadId, number, count, mode, editing]);

  // Replace, not push: Back leaves the deck instead of walking the slides.
  const go = (to: number) =>
    router.replace(slideHref(leadId, to), { scroll: false });

  // --- edits -----------------------------------------------------------------

  const closeEditor = () => {
    setEditingId(undefined);
    update.reset();
    // The editor is gone on the next paint; its opener takes focus back.
    requestAnimationFrame(() => editRef.current?.focus());
  };
  const save = (input: UpdateSlideInput) =>
    update.mutate(
      { slideId: slide.id, input },
      {
        onSuccess: () => {
          closeEditor();
          toast.add({ title: "Slide saved", type: "success" });
        },
      },
    );

  const changeTemplate = (template: DeckTemplate) =>
    switchTemplate.mutate(template, {
      onSuccess: () =>
        toast.add({
          title: `The deck now uses the ${DECK_TEMPLATE_LABEL[template]} template`,
          type: "success",
        }),
    });

  const templateName = DECK_TEMPLATE_LABEL[deck.template];

  return (
    <>
      <Link
        href={DECK_PRESENTER_HREF}
        className="inline-flex items-center gap-1 self-start rounded-md font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        All decks
      </Link>

      <PageHeader
        title={`Deck for ${deck.lead.name}`}
        description={deck.lead.company ?? undefined}
        actions={
          <LinkButton href={leadHref(leadId)} className={TOUCH}>
            Open the lead
          </LinkButton>
        }
      />

      <section
        aria-label="Deck actions"
        // Behind the full-screen layer: out of reach of the keyboard too.
        // ponytail: the shell's own controls are not made inert by the
        // fallback layer; native full screen (the usual case) hides them.
        inert={presenting}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={templateId}>Template</Label>
            <NativeSelect
              id={templateId}
              value={deck.template}
              disabled={switchTemplate.isPending || editing || presenting}
              onChange={(event) =>
                changeTemplate(event.target.value as DeckTemplate)
              }
              className="min-w-40 max-nav:[&_select]:min-h-11 pointer-coarse:[&_select]:min-h-11"
            >
              {DECK_TEMPLATES.map((template) => (
                <NativeSelectOption key={template} value={template}>
                  {DECK_TEMPLATE_LABEL[template]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-wrap items-center gap-3 nav:ml-auto">
            {DECK_EDITOR === "ours" && (
              <Button
                ref={editRef}
                className={TOUCH}
                // Not while presenting: the editor is not part of the show.
                disabled={editing || presenting || switchTemplate.isPending}
                onClick={() => setEditingId(slide.id)}
              >
                Edit text
              </Button>
            )}
            {/* A plain link: the browser downloads the file from our own route. */}
            <a
              href={deck.pdfUrl}
              download
              className={cn(buttonVariants(), TOUCH)}
            >
              <DownloadIcon aria-hidden="true" />
              Download PDF
            </a>
            <Button
              ref={presentRef}
              // One primary at a time: while the editor is open, Save is it.
              variant={editing ? "default" : "primary"}
              className={TOUCH}
              disabled={editing || presenting}
              onClick={present}
            >
              <MaximizeIcon aria-hidden="true" />
              Present full screen
            </Button>
          </div>
        </div>

        {switchTemplate.isError && !switchTemplate.isPending && (
          <Alert variant="destructive">
            <AlertDescription>
              The template could not be changed. The deck is as it was. Choose
              the template again to retry.
            </AlertDescription>
          </Alert>
        )}

        <HintLine>
          Sample data: these slides are examples and do not come from the deck
          service. Changes last until the sample data resets, and the PDF is a
          sample.
        </HintLine>
      </section>

      <div className="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_260px]">
        {/* The stage is what goes full screen, so its controls come with it. */}
        <div
          ref={stageRef}
          tabIndex={-1}
          data-presenting={presenting || undefined}
          className={cn(
            "flex min-w-0 flex-col gap-3 outline-none",
            presenting &&
              "overflow-auto bg-background p-4 nav:p-6 [&:not(:fullscreen)]:fixed [&:not(:fullscreen)]:inset-0 [&:not(:fullscreen)]:z-50",
          )}
        >
          {editing ? (
            <SlideEditor
              key={slide.id}
              slide={slide}
              saving={update.isPending}
              failed={update.isError}
              onSave={save}
              onCancel={closeEditor}
            />
          ) : (
            <SlideFrame
              aria-label={`Slide ${number} of ${count}: ${slide.heading}`}
              variant={slide.kind === "title" ? "title" : "content"}
              heading={slide.heading}
              body={slide.body}
              bullets={slide.bullets}
              footer={
                <>
                  <span>{templateName}</span>
                  <span className="tabular-nums">
                    {number} / {count}
                  </span>
                </>
              }
              className={cn(
                // Full screen: as large as fits above the controls.
                presenting && "m-auto max-w-[calc((100dvh-8rem)*16/9)]",
              )}
            >
              {slide.kind === "booking" && (
                <BookingCalendarStandIn
                  slots={slots.data}
                  failed={slots.isError}
                />
              )}
            </SlideFrame>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              className={TOUCH}
              aria-label="Previous slide"
              disabled={number <= 1 || editing}
              onClick={() => go(number - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
              Previous
            </Button>
            <output className="min-w-16 text-center tabular-nums">
              {number} of {count}
            </output>
            <Button
              className={TOUCH}
              aria-label="Next slide"
              disabled={number >= count || editing}
              onClick={() => go(number + 1)}
            >
              Next
              <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
            </Button>
            {presenting && (
              <Button className={TOUCH} onClick={stopPresenting}>
                <MinimizeIcon aria-hidden="true" />
                Exit full screen
              </Button>
            )}
          </div>
        </div>

        <nav
          aria-labelledby={slidesId}
          inert={presenting}
          className="flex flex-col overflow-hidden rounded-panel bg-card ring-1 ring-border"
        >
          <h2
            id={slidesId}
            className="border-b border-border px-4 py-2.5 label-caps"
          >
            Slides
          </h2>
          <ol className="divide-y divide-border">
            {deck.slides.map((item, index) => (
              <li key={item.id}>
                <ListRow
                  href={slideHref(leadId, index + 1)}
                  replace
                  scroll={false}
                  selected={index + 1 === number}
                  className="flex gap-2 py-2"
                >
                  <span className="w-5 shrink-0 text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 wrap-break-word">
                    {item.heading}
                  </span>
                </ListRow>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </>
  );
}

/**
 * MOCK CHOICE (question 2, part 3: whether a CRM calendar can be embedded on
 * the last slide; untested, no assumed answer). This stands in for that
 * calendar: sample call slots that cannot be chosen. The real answer replaces
 * this one component, with an embed or with a link to the booking page.
 */
function BookingCalendarStandIn({
  slots,
  failed,
}: {
  slots: BookingSlot[] | undefined;
  failed: boolean;
}) {
  return (
    <div className="flex flex-col gap-[max(0.5rem,1.6cqw)]">
      {failed ? (
        <p className="text-muted-foreground">
          The sample call times could not be loaded.
        </p>
      ) : (
        <ul
          aria-label="Sample call times"
          className="grid grid-cols-2 gap-[max(0.375rem,1.2cqw)] @2xl:grid-cols-3"
        >
          {(slots ?? []).map((slot) => (
            <li
              key={slot.id}
              className="rounded-control border border-dashed border-border px-[max(0.5rem,1.6cqw)] py-[max(0.25rem,0.9cqw)] text-muted-foreground"
            >
              <LocalTime value={slot.time} />
              <span className="sr-only">, {slot.minutes} minutes</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[length:max(0.8125rem,2cqw)] text-muted-foreground">
        Sample data: this stands in for the booking calendar. Nothing is booked.
      </p>
    </div>
  );
}

/**
 * The slide's text as fields (MOCK CHOICE, question 2, part 2; see
 * `DECK_EDITOR`). Text only: nothing about the slide's layout can change.
 */
function SlideEditor({
  slide,
  saving,
  failed,
  onSave,
  onCancel,
}: {
  slide: Slide;
  saving: boolean;
  failed: boolean;
  onSave: (input: UpdateSlideInput) => void;
  onCancel: () => void;
}) {
  // The submit control is inert until `onSubmit` is attached.
  const hydrated = useHydrated();
  const [errors, setErrors] = useState<FieldErrors>({});
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);

  // Opened by a press: the first field takes focus, ready to type.
  useEffect(() => {
    formRef.current?.querySelector("input")?.focus();
  }, []);

  const area = (
    name: "body" | "bullets",
    label: string,
    value: string,
    hint?: string,
  ) => (
    <Field data-invalid={errors[name] ? true : undefined}>
      <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
      <Textarea
        id={`${id}-${name}`}
        name={name}
        defaultValue={value}
        readOnly={saving}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={
          errors[name]
            ? `${id}-${name}-error`
            : hint
              ? `${id}-${name}-hint`
              : undefined
        }
        className="read-only:text-muted-foreground"
      />
      {hint && !errors[name] && (
        <FieldDescription id={`${id}-${name}-hint`}>{hint}</FieldDescription>
      )}
      <FieldError id={`${id}-${name}-error`}>{errors[name]}</FieldError>
    </Field>
  );

  return (
    <form
      ref={formRef}
      // Never GET: a submit the browser handles itself must not put fields in the address.
      method="post"
      noValidate
      aria-label="Edit this slide's text"
      aria-busy={saving}
      onChange={clearErrorOnEdit(setErrors)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onCancel();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (saving) return;
        const { data, errors: found } = readForm(
          slideFormSchema,
          event.currentTarget,
        );
        setErrors(found ?? {});
        if (data) onSave(data);
      }}
      className="flex flex-col gap-5 rounded-box bg-card p-4 ring-1 ring-border"
    >
      {failed && !saving && (
        <Alert variant="destructive">
          <AlertDescription>
            The slide was not saved. Your text is still here: press Save to try
            again.
          </AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <FormField
          label="Heading"
          name="heading"
          defaultValue={slide.heading}
          error={errors.heading}
          readOnly={saving}
          required
        />
        {area("body", "Text", slide.body)}
        {area(
          "bullets",
          "Points",
          slide.bullets.join("\n"),
          "One point per line. Leave it empty for no points.",
        )}
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          className={TOUCH}
          loading={saving}
          disabled={!hydrated}
        >
          Save
        </Button>
        <Button
          type="button"
          className={TOUCH}
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeckSkeleton() {
  return (
    <output aria-label="Loading deck" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-24 nav:ml-auto" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="aspect-video w-full rounded-box" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </output>
  );
}
