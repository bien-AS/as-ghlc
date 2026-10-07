import { cn } from "@/lib/utils";

/**
 * One slide of a deck, drawn from tokens: the deck box (11px corner, `surface`,
 * a 1px `line` edge) at 16:9. Type and spacing are sized from the box's own
 * width, so the slide looks the same small in a column and large on a full
 * screen. Each size has a floor: on a narrow phone the text stays readable and
 * the box grows taller than 16:9 instead of clipping it.
 */
function SlideFrame({
  heading,
  body,
  bullets = [],
  variant = "content",
  footer,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  heading: string;
  body?: string;
  bullets?: string[];
  /** "title" is the opening slide: larger heading, centred in the box. */
  variant?: "title" | "content";
  /** A quiet line at the foot, such as the template and the slide number. */
  footer?: React.ReactNode;
}) {
  const title = variant === "title";
  return (
    <section
      data-slot="slide-frame"
      aria-roledescription="slide"
      className={cn(
        "@container aspect-video w-full rounded-box bg-card text-card-foreground ring-1 ring-border",
        className,
      )}
      {...props}
    >
      <div className="flex h-full flex-col gap-[max(0.5rem,2cqw)] p-[max(1rem,6cqw)] text-[length:max(0.8125rem,2.6cqw)] leading-[1.4]">
        <div
          className={cn(
            "flex flex-1 flex-col gap-[max(0.5rem,2.4cqw)]",
            title && "justify-center",
          )}
        >
          <h2
            className={cn(
              "wrap-break-word",
              title
                ? "text-[length:max(1.375rem,7cqw)]"
                : "text-[length:max(1.125rem,4.6cqw)]",
              // After the size: a size utility would reset the line height.
              "leading-[1.1]",
            )}
          >
            {heading}
          </h2>
          {body && (
            <p
              className={cn(
                "max-w-[60ch] text-pretty wrap-break-word",
                title &&
                  "text-[length:max(0.875rem,3cqw)] text-muted-foreground",
              )}
            >
              {body}
            </p>
          )}
          {bullets.length > 0 && (
            <ul className="flex max-w-[60ch] list-disc flex-col gap-[max(0.25rem,1.2cqw)] pl-[1.2em] wrap-break-word">
              {bullets.map((bullet, index) => (
                // A rep can type the same line twice, so the text alone is not a key.
                // biome-ignore lint/suspicious/noArrayIndexKey: the points are an ordered list that is only ever re-rendered whole
                <li key={`${index}-${bullet}`}>{bullet}</li>
              ))}
            </ul>
          )}
          {children}
        </div>
        {footer && (
          // Too small to read on a narrow box, and it repeats what is beside the slide.
          <p className="flex justify-between gap-4 text-[length:1.7cqw] text-muted-foreground @max-2xl:hidden">
            {footer}
          </p>
        )}
      </div>
    </section>
  );
}

export { SlideFrame };
