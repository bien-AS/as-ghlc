import Link from "next/link";

import { ThemeSwitch } from "@/components/ui/theme-switch";
import { Wordmark } from "@/components/ui/wordmark";
import { cn } from "@/lib/utils";

/**
 * The frame every auth screen shares (spec 02): the endorsed wordmark linking
 * to "/", the theme switch, and one centred column for a single panel.
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="auth-shell" className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-md">
          <Wordmark endorsed />
        </Link>
        <ThemeSwitch />
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pt-8 pb-16 sm:justify-center sm:px-6 sm:pt-0 sm:pb-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

/**
 * One state of an auth screen: a heading, an optional line under it, then the
 * panel. A screen that swaps state (form, then "Check your email") renders a
 * new AuthPanel with a new `key`, so the swap fades in and the heading can
 * take focus.
 */
function AuthPanel({
  title,
  description,
  headingRef,
  footer,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  /** Focus this after a state swap so assistive technology announces it. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** Links to the neighbouring screens, shown under the panel. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="auth-panel"
      className={cn(
        "flex animate-in flex-col gap-6 duration-200 ease-out fade-in",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl leading-tight outline-none"
        >
          {title}
        </h1>
        {description && (
          <p className="text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-5 rounded-panel bg-card p-5 text-card-foreground ring-1 ring-border">
        {children}
      </div>
      {footer && (
        <p className="text-center text-muted-foreground [&_a]:font-semibold [&_a]:text-brand-text [&_a]:underline-offset-4 [&_a]:hover:underline">
          {footer}
        </p>
      )}
    </div>
  );
}

/** "or" between the form and the Google button. */
function AuthDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div
      data-slot="auth-divider"
      className="flex items-center gap-3 text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
    >
      {children}
    </div>
  );
}

export { AuthDivider, AuthPanel, AuthShell };
