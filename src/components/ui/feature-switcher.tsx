"use client";

import { PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type FeatureItem = {
  id: string;
  title: string;
  /** One or two sentences, always visible under the title. */
  summary: React.ReactNode;
  /** Shown only while the item is open. */
  visual: React.ReactNode;
};

const NEXT = ["ArrowRight", "ArrowDown"];
const PREVIOUS = ["ArrowLeft", "ArrowUp"];

/**
 * A set of items of which exactly one is open (spec 01, section 5). Each
 * header is a button that says whether its item is expanded; arrow keys, Home
 * and End move between headers, Enter and Space open one. From `lg` the items
 * sit in a row and the open one widens; below it they stack and the open one
 * grows downwards. The layout and its motion are in marketing.css.
 */
function FeatureSwitcher({
  items,
  className,
}: {
  items: FeatureItem[];
  className?: string;
}) {
  const baseId = useId();
  const [openId, setOpenId] = useState(items[0]?.id);
  const headers = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = items.length - 1;
    const target = NEXT.includes(event.key)
      ? index === last
        ? 0
        : index + 1
      : PREVIOUS.includes(event.key)
        ? index === 0
          ? last
          : index - 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : undefined;
    if (target === undefined) return;
    event.preventDefault();
    headers.current[target]?.focus();
  }

  return (
    <div
      data-slot="feature-switcher"
      className={cn("feature-switcher", className)}
      style={{ "--feature-count": items.length } as React.CSSProperties}
    >
      {items.map(({ id, title, summary, visual }, index) => {
        const open = id === openId;
        const headerId = `${baseId}-${id}-header`;
        const panelId = `${baseId}-${id}-panel`;
        return (
          <div
            key={id}
            data-slot="feature-item"
            data-open={open}
            className="feature-item"
          >
            <h3 className="feature-heading">
              <button
                ref={(node) => {
                  headers.current[index] = node;
                }}
                id={headerId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="feature-header"
              >
                {title}
                <PlusIcon aria-hidden="true" className="feature-plus" />
              </button>
            </h3>
            <p className="feature-summary">{summary}</p>
            {/* biome-ignore lint/a11y/useSemanticElements: a section would add a landmark per item; "region" on the panel is the disclosure pattern */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              inert={!open}
              className="feature-panel"
            >
              <div className="feature-visual">{visual}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { type FeatureItem, FeatureSwitcher };
