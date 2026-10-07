"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useId } from "react";

import { setTheme, type Theme, useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const options = [
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
] satisfies { value: Theme; label: string; Icon: typeof SunIcon }[];

/**
 * System / Light / Dark. Native radios, so arrow keys, form semantics and the
 * group name come from the platform.
 *
 * Each instance is its own radio group (a `name` per instance): radios that
 * share a name outside a form are one group to the browser, so two switches
 * on a page would show one selection between them and share one tab stop.
 * Every instance reads the same store, so they always agree.
 */
function ThemeSwitch({ className }: { className?: string }) {
  const theme = useTheme();
  const name = useId();

  return (
    <fieldset
      data-slot="theme-switch"
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Theme</legend>
      {options.map(({ value, label, Icon }) => (
        <label
          key={value}
          title={label}
          className="relative flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50 max-nav:size-11 pointer-coarse:size-11"
        >
          <input
            type="radio"
            name={name}
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="absolute inset-0 cursor-pointer appearance-none rounded-md outline-none"
          />
          <Icon aria-hidden="true" className="size-4" />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export { ThemeSwitch };
