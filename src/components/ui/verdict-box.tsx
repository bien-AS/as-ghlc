import {
  CircleCheckIcon,
  CircleDashedIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
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

/**
 * The AI's verdict on a lead (spec 03): the verdict word, the summary and the
 * reasons, toned ok for valid, warn for awaiting, crit for suspect and spam.
 * The word is always written; the tone only supports it.
 */
function VerdictBox({
  tone,
  word,
  summary,
  reasons = [],
  className,
  children,
}: {
  tone: keyof typeof TONES;
  /** The verdict as a word, for example "Suspect". */
  word: string;
  summary?: string;
  reasons?: string[];
  className?: string;
  /** A note under the reasons, for example who reviewed the lead and when. */
  children?: React.ReactNode;
}) {
  const { box, word: wordClass, Icon } = TONES[tone];
  return (
    <section
      data-slot="verdict-box"
      data-tone={tone}
      className={cn(
        "flex flex-col gap-3 rounded-box border p-4 text-foreground",
        box,
        className,
      )}
    >
      <h2
        className={cn(
          "flex items-center gap-1.5 text-base font-semibold",
          wordClass,
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span>
          <span className="sr-only">Verdict: </span>
          {word}
        </span>
      </h2>
      {summary && <p className="text-pretty">{summary}</p>}
      {reasons.length > 0 && (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {reasons.map((reason) => (
            <li key={reason} className="text-pretty">
              {reason}
            </li>
          ))}
        </ul>
      )}
      {children && <div className="text-pretty">{children}</div>}
    </section>
  );
}

export { VerdictBox };
