import { cn } from "@/lib/utils";

/** The content column every marketing band shares. */
const sectionInner = "mx-auto w-full max-w-content px-5 sm:px-8";

/**
 * One band of a marketing page: a `<section>` named by its heading, with the
 * shared content width and vertical rhythm. `bleed` drops the inner column so
 * a band can lay out its own full-width content.
 */
function SectionShell({
  id,
  labelledBy,
  bleed = false,
  className,
  innerClassName,
  children,
}: {
  /** Anchor target for in-page links. */
  id?: string;
  /** The id of the heading that names this section. */
  labelledBy: string;
  bleed?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-slot="section-shell"
      aria-labelledby={labelledBy}
      // scroll-mt: anchor jumps land below the sticky nav.
      className={cn("scroll-mt-16 py-20 sm:py-28 lg:py-36", className)}
    >
      {bleed ? (
        children
      ) : (
        <div className={cn(sectionInner, innerClassName)}>{children}</div>
      )}
    </section>
  );
}

export { SectionShell, sectionInner };
