"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type NarrativeStep = {
  title: string;
  body: React.ReactNode;
  /** The picture for this step. */
  visual: React.ReactNode;
};

/**
 * A numbered story told beside its pictures (spec 01, section 4).
 *
 * On a wide screen the block pins under the nav while the page scrolls
 * through it: the heading and the steps stay put, the step in view is marked
 * current, and its picture replaces the last one. The page scrolls natively;
 * an IntersectionObserver on three invisible zones only reads where it is.
 *
 * On a small screen, with reduced motion, or with no IntersectionObserver,
 * it is a plain list: each step followed by its picture. Every step's text
 * is in the document, and readable, in both forms. Layout and motion are in
 * marketing.css.
 */
function StickyNarrative({
  heading,
  steps,
  className,
}: {
  /** The section's heading element. */
  heading: React.ReactNode;
  steps: NarrativeStep[];
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const zones = root.current?.querySelectorAll<HTMLElement>("[data-zone]");
    if (!zones?.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrent(Number((entry.target as HTMLElement).dataset.zone));
          }
        }
      },
      // A zone counts once it crosses the middle of the viewport.
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const zone of zones) observer.observe(zone);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={root}
      data-slot="sticky-narrative"
      className={cn("narrative", className)}
      style={{ "--narrative-steps": steps.length } as React.CSSProperties}
    >
      <div aria-hidden="true" className="narrative-zones">
        {steps.map(({ title }, index) => (
          <div key={title} data-zone={index} />
        ))}
      </div>
      <div className="narrative-pin">
        <div className="narrative-text">
          {heading}
          <ol className="narrative-steps">
            {steps.map(({ title, body, visual }, index) => (
              <li
                key={title}
                data-state={
                  index === current
                    ? "current"
                    : index < current
                      ? "past"
                      : "upcoming"
                }
                className="narrative-step"
              >
                <span aria-hidden="true" className="narrative-number">
                  {index + 1}
                </span>
                <div className="narrative-copy">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
                <div className="narrative-visual">{visual}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export { type NarrativeStep, StickyNarrative };
