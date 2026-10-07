"use client";

import { ChevronDownIcon, LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTheme, type Theme, useTheme } from "@/hooks/use-theme";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * The signed-in user's menu (spec 04): their name and email, and Sign out.
 * `compact` is the small-screen form, where the navbar has no room for the
 * theme switch and the Sample data label, so both move in here.
 */
function UserMenu({
  name,
  email,
  onSignOut,
  signingOut = false,
  compact = false,
  sampleDataNote,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
  signingOut?: boolean;
  compact?: boolean;
  /** Shown in the compact menu while the dashboard runs on sample data. */
  sampleDataNote?: string;
}) {
  const theme = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`Account: ${name}`}
            className="max-w-48 gap-2 px-1.5"
          />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-text"
        >
          {initials(name)}
        </span>
        <span title={name} className="hidden truncate wide:inline">
          {name}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="hidden text-muted-foreground wide:inline"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col px-1.5 py-1">
          <span title={name} className="truncate font-semibold">
            {name}
          </span>
          <span title={email} className="truncate text-muted-foreground">
            {email}
          </span>
        </div>
        {compact && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as Theme)}
              >
                <DropdownMenuRadioItem value="system" closeOnClick={false}>
                  System
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light" closeOnClick={false}>
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" closeOnClick={false}>
                  Dark
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {sampleDataNote && (
              <>
                <DropdownMenuSeparator />
                <p className="px-1.5 py-1 text-pretty text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Sample data.
                  </span>{" "}
                  {sampleDataNote}
                </p>
              </>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={() => {
            if (!signingOut) onSignOut();
          }}
        >
          <LogOutIcon aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
