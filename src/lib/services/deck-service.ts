import type { DeckTemplate, Slide } from "@/lib/decks/schemas";

/*
 * The deck service (server-only; called only by src/lib/data/decks.ts).
 *
 * This is the one place the real deck service client will live (spec 13:
 * "Decks is the only block that calls" it). Today it makes no network call:
 * it builds sample slides from a lead and writes a sample PDF itself. Going
 * live means replacing the bodies of `generateSlides` and `exportPdf`.
 */

/** What the deck service is given about a lead (spec 13, "Takes in"). */
export type DeckSubject = {
  name: string;
  company: string | null;
  budget: string | null;
  formAnswers: { question: string; answer: string }[];
};

type SlideContent = Omit<Slide, "id">;

const shorten = (text: string, max = 140) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** What the lead wrote on the form, as points; or one line when they wrote nothing. */
function heard(subject: DeckSubject, heading: string): SlideContent {
  const bullets = subject.formAnswers
    .slice(0, 4)
    .map(({ answer }) => shorten(answer));
  return {
    kind: "content",
    heading,
    body: bullets.length
      ? ""
      : "There are no form answers on this lead, so we will start from your goals.",
    bullets,
  };
}

// Slides the two templates share have one id, so a rep's edit to one of them
// survives a change of template.
const SHARED = {
  title: (subject) => ({
    kind: "title",
    heading: subject.company ?? subject.name,
    body: subject.company
      ? `Prepared for ${subject.name}`
      : "Prepared for our call",
    bullets: [],
  }),
  goals: () => ({
    kind: "content",
    heading: "What you want to achieve",
    body: "",
    bullets: [
      "More qualified enquiries each month",
      "A clear picture of what your marketing returns",
      "Less time spent chasing leads that go nowhere",
    ],
  }),
  book: () => ({
    kind: "booking",
    heading: "Book the next call",
    body: "Pick a time that suits you.",
    bullets: [],
  }),
} satisfies Record<string, (subject: DeckSubject) => SlideContent>;

/**
 * ASSUMED (spec 13, "The deck templates": not supplied). The slide set and the
 * wording of each template are invented to show the idea: Discovery frames the
 * first call, Review frames the proposal. Replace with the real templates.
 */
const TEMPLATE_SLIDES: Record<
  DeckTemplate,
  [id: string, build: (subject: DeckSubject) => SlideContent][]
> = {
  discovery: [
    ["title", SHARED.title],
    ["what-you-told-us", (subject) => heard(subject, "What you told us")],
    ["goals", SHARED.goals],
    [
      "how-we-work",
      () => ({
        kind: "content",
        heading: "How we work",
        body: "",
        bullets: [
          "We learn your business before we suggest anything",
          "You get one plan, with the cost of each part",
          "We report on enquiries and sales, not on clicks",
        ],
      }),
    ],
    [
      "budget",
      ({ budget }) => ({
        kind: "content",
        heading: "Budget",
        body: budget
          ? `You told us your budget is ${budget}. We will shape the plan to fit it.`
          : "You have not given a budget yet. We will talk through a range on the call.",
        bullets: [],
      }),
    ],
    [
      "questions",
      () => ({
        kind: "content",
        heading: "Questions for you",
        body: "",
        bullets: [
          "Where do your best customers come from today?",
          "What have you tried that did not work?",
          "Who else is part of this decision?",
        ],
      }),
    ],
    ["book", SHARED.book],
  ],
  review: [
    ["title", SHARED.title],
    ["recap", (subject) => heard(subject, "What we heard on the first call")],
    ["goals", SHARED.goals],
    [
      "plan",
      () => ({
        kind: "content",
        heading: "The plan we propose",
        body: "",
        bullets: [
          "Fix what stops visitors from enquiring",
          "Bring in the right visitors with search and paid campaigns",
          "Follow up every enquiry within the hour",
        ],
      }),
    ],
    [
      "investment",
      ({ budget }) => ({
        kind: "content",
        heading: "Investment",
        body: budget
          ? `The plan is priced to fit the budget you gave us: ${budget}. The proposal lists each part.`
          : "The proposal lists the price of each part, so you can choose what to start with.",
        bullets: [],
      }),
    ],
    [
      "first-90-days",
      () => ({
        kind: "content",
        heading: "The first 90 days",
        body: "",
        bullets: [
          "Weeks 1 to 2: set up tracking and agree the targets",
          "Weeks 3 to 6: launch the campaigns and the new pages",
          "Weeks 7 to 12: review results with you every two weeks",
        ],
      }),
    ],
    ["book", SHARED.book],
  ],
};

/**
 * MOCK CHOICE (question 2, part 1: where the deck service is hosted; no
 * assumed answer). It runs nowhere: the slides are sample content built here
 * from the lead. The real body asks the deck service to generate.
 */
export async function generateSlides(
  subject: DeckSubject,
  template: DeckTemplate,
): Promise<Slide[]> {
  return TEMPLATE_SLIDES[template].map(([id, build]) => ({
    id,
    ...build(subject),
  }));
}

// --- the sample PDF ----------------------------------------------------------

// 16:9, in points.
const PAGE = { width: 960, height: 540, margin: 64 };
export const SAMPLE_PDF_NOTE =
  "Sample deck. Built by Dealwright from sample data, not by the deck service.";

// ponytail: the standard PDF fonts are written here as plain ASCII, so any
// other character prints as "?". It goes with the sample PDF.
const pdfText = (text: string) =>
  text
    .replaceAll("…", "...")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, "\\$&");

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pageContent(slide: Slide, footer: string): string {
  const ops: string[] = [];
  let y = PAGE.height - PAGE.margin - 30;
  const write = (font: "F1" | "F2", size: number, text: string) => {
    ops.push(
      `BT /${font} ${size} Tf ${PAGE.margin} ${y} Td (${pdfText(text)}) Tj ET`,
    );
    y -= Math.round(size * 1.4);
  };
  for (const line of wrap(slide.heading, 46)) write("F2", 30, line);
  y -= 14;
  for (const line of wrap(slide.body, 90)) write("F1", 16, line);
  for (const bullet of slide.bullets) {
    wrap(bullet, 86).forEach((line, n) => {
      write("F1", 16, `${n === 0 ? "-" : " "} ${line}`);
    });
  }
  y = 32;
  write("F1", 10, footer);
  return ops.join("\n");
}

/**
 * The deck as a PDF, one page per slide. Today a small PDF written by hand
 * that says it is a sample; the real body asks the deck service for its PDF
 * export (spec 13: "an export format of pptx or pdf").
 */
export async function exportPdf(deck: {
  leadName: string;
  templateName: string;
  slides: Slide[];
}): Promise<Uint8Array<ArrayBuffer>> {
  // Objects 1 to 4 are the catalog, the page tree and the two fonts; then a
  // page and its content stream per slide.
  const pageNumber = (index: number) => 5 + index * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${deck.slides.length} /Kids [${deck.slides
      .map((_, index) => `${pageNumber(index)} 0 R`)
      .join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  deck.slides.forEach((slide, index) => {
    const content = pageContent(
      slide,
      `${SAMPLE_PDF_NOTE} ${deck.leadName}, ${deck.templateName} template, ${index + 1} of ${deck.slides.length}.`,
    );
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNumber(index) + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  });

  // Everything is ASCII, so a string's length is its length in bytes.
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
