import { AuthoritySolutionsLogo } from "@/components/ui/authority-solutions-logo";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The Dealwright text wordmark, set in the heading font. Size it with a text
 * utility on `className`. `endorsed` adds "by Authority Solutions"; screens
 * never place the logo file themselves.
 */
function Wordmark({
  endorsed = false,
  // 28px is the smallest height at which the lockup's lettering still reads.
  logoHeight = 28,
  surface = "auto",
  className,
}: {
  endorsed?: boolean;
  logoHeight?: number;
  /** The surface the endorsement logo sits on; "auto" follows the theme. */
  surface?: "auto" | "light" | "dark";
  className?: string;
}) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 font-heading text-xl font-bold tracking-tight text-foreground",
        className,
      )}
    >
      {PRODUCT_NAME}
      {endorsed && (
        <span className="inline-flex items-center gap-x-1.5 font-sans text-sm font-normal tracking-normal text-muted-foreground">
          by
          <AuthoritySolutionsLogo height={logoHeight} surface={surface} />
        </span>
      )}
    </span>
  );
}

export { Wordmark };
