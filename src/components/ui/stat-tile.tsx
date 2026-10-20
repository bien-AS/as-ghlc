import { KpiTile, type KpiTileProps } from "@vantage/design-system";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * One number on a dashboard: the kit's `KpiTile`, so `null` reads "not
 * measured" and never 0. With `href` the whole tile is one link, with the
 * kit's interactive card states (hover lifts the fill and the edge, press
 * settles to 0.97) and the one focus ring. Without it, a plain tile.
 */
function StatTile({
  href,
  className,
  ...props
}: KpiTileProps & {
  /** Where the number's list lives. Leave it out when that screen is not live. */
  href?: string;
}) {
  if (!href) {
    return (
      <KpiTile
        data-slot="stat-tile"
        className={cn("h-full", className)}
        {...props}
      />
    );
  }
  return (
    <Link
      data-slot="stat-tile"
      href={href}
      className={cn(
        "group block rounded-xl transition-transform duration-150 ease-out outline-none focus-visible:shadow-focus active:scale-[0.97]",
        className,
      )}
    >
      <KpiTile
        className="h-full transition-colors duration-150 ease-out group-hover:border-line-strong group-hover:bg-surface-hover"
        {...props}
      />
    </Link>
  );
}

export { StatTile };
