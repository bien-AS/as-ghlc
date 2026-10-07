import Link from "next/link";

import { LinkButton } from "@/components/ui/link-button";
import { sectionInner } from "@/components/ui/section-shell";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Wordmark } from "@/components/ui/wordmark";
import { ENDORSER_NAME, PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * The public site's top bar: the endorsed wordmark, in-page anchors, the theme
 * switch and the two ways in. It stays in view; once the page scrolls it
 * settles onto its surface and rule (a CSS scroll-driven animation in
 * src/app/marketing.css, with the settled state as the fallback).
 */
function SiteNav({
  links,
  className,
}: {
  /** In-page anchors, shown from the `lg` breakpoint. */
  links: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <header
      data-slot="site-nav"
      className={cn("sticky top-0 z-40 h-16", className)}
    >
      <div
        aria-hidden="true"
        className="site-nav-material absolute inset-0 border-b border-line bg-ground"
      />
      <div
        className={cn(
          sectionInner,
          "site-nav-row relative flex h-full items-center gap-3 sm:gap-6",
        )}
      >
        <Link
          href="/"
          aria-label={`${PRODUCT_NAME} by ${ENDORSER_NAME}, top of the page`}
          className="rounded-md"
        >
          <Wordmark
            endorsed
            logoHeight={26}
            className="max-sm:flex-col max-sm:items-start max-sm:gap-y-0.5 max-sm:leading-none"
          />
        </Link>
        <nav aria-label="Sections" className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map(({ href, label }) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded-md px-3 py-2 font-semibold text-ink-2 transition-colors duration-150 hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeSwitch className="max-nav:hidden" />
          <LinkButton href="/sign-in" className="h-11 px-4 nav:h-9">
            Sign in
          </LinkButton>
          <LinkButton
            href="/sign-up"
            variant="primary"
            className="h-11 px-4 nav:h-9"
          >
            Sign up
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

export { SiteNav };
