import { InView } from "@/components/ui/in-view";
import { cn } from "@/lib/utils";

/**
 * A row of items that drifts sideways without end. The items are rendered
 * once as a real list; the copies that make the loop seamless are hidden from
 * assistive technology. It pauses on hover, while anything inside has focus,
 * and while it is off screen. With reduced motion it does not move: the list
 * wraps and the copies are not shown (src/app/marketing.css).
 */
function Marquee({
  label,
  items,
  className,
}: {
  /** Names the group for assistive technology. */
  label: string;
  items: { key: string; node: React.ReactNode }[];
  className?: string;
}) {
  const group = (copy: number) => (
    <ul
      key={copy}
      aria-hidden={copy === 0 ? undefined : "true"}
      className={cn("marquee-group", copy > 0 && "marquee-copy")}
    >
      {items.map(({ key, node }) => (
        <li key={key}>{node}</li>
      ))}
    </ul>
  );

  return (
    <InView
      once={false}
      data-slot="marquee"
      // Focusable so a keyboard user can stop it, as hover does for a pointer.
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn("marquee", className)}
    >
      <div className="marquee-viewport">
        <div className="marquee-track">{[0, 1, 2, 3].map(group)}</div>
      </div>
    </InView>
  );
}

export { Marquee };
