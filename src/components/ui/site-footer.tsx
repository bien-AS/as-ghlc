import Link from "next/link";

import { AuthoritySolutionsLogo } from "@/components/ui/authority-solutions-logo";
import { sectionInner } from "@/components/ui/section-shell";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type FooterColumn = {
  title: string;
  links: { href: string; label: string }[];
};

/**
 * The public site's footer: link columns, the endorsement, the theme switch,
 * and the product name set very large and cropped by the bottom of the page.
 * Columns only ever link to pages that exist.
 */
function SiteFooter({
  columns,
  className,
}: {
  columns: FooterColumn[];
  className?: string;
}) {
  return (
    <footer
      data-slot="site-footer"
      className={cn("overflow-hidden border-t border-line", className)}
    >
      <div
        className={cn(
          sectionInner,
          "grid gap-x-8 gap-y-12 pt-16 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:pt-20",
        )}
      >
        <div className="flex flex-col items-start gap-6 sm:col-span-2 lg:col-span-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base text-ink-2">
            {PRODUCT_NAME} is made by
            <AuthoritySolutionsLogo height={40} />
          </p>
          {/* The nav carries the switch from `nav` up; one is enough on screen. */}
          <ThemeSwitch className="nav:hidden" />
        </div>
        {columns.map(({ title, links }) => (
          <nav key={title} aria-label={title}>
            <h2 className="label-caps">{title}</h2>
            <ul className="mt-3 flex flex-col">
              {links.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-11 items-center rounded-md text-base font-semibold text-ink underline-offset-4 hover:underline nav:min-h-9"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {/* Decorative: the name is already in the nav and in the line above. */}
      <p
        aria-hidden="true"
        className="site-footer-wordmark pointer-events-none -mb-[0.2em] text-center font-heading text-[17.6vw] leading-[0.8] font-bold tracking-[-0.04em] whitespace-nowrap text-ink select-none"
      >
        {PRODUCT_NAME}
      </p>
    </footer>
  );
}

export { SiteFooter };
