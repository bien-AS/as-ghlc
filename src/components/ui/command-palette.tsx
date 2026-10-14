"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { LucideIcon } from "lucide-react";

export type PaletteItem = { label: string; href: string; icon?: LucideIcon };
export type PaletteGroup = { label: string; items: PaletteItem[] };

/**
 * The jump-anywhere palette (Ctrl or Cmd + K). It owns no data: the caller
 * passes the destinations the viewer may use and what to do with a typed
 * search, so it can sit in any shell. Hiding a destination is not access
 * control; the server still refuses (spec 12).
 */
function CommandPalette({
  groups,
  searchLabel = "Search leads for",
  onNavigate,
  onSearch,
}: {
  groups: PaletteGroup[];
  searchLabel?: string;
  onNavigate: (href: string) => void;
  onSearch: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey))
        return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setText("");
  };
  const query = text.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={(value) => (value ? setOpen(true) : close())}
      title="Jump to"
      description="Type to find a screen, or search the leads."
    >
      <Command>
        <CommandInput
          value={text}
          onValueChange={setText}
          placeholder="Jump to a screen or search leads"
        />
        <CommandList>
          <CommandEmpty>
            Nothing matches. Press Enter to search leads.
          </CommandEmpty>
          {query && (
            <CommandGroup heading="Search">
              <CommandItem
                value={`search ${query}`}
                forceMount
                onSelect={() => {
                  onSearch(query);
                  close();
                }}
              >
                <SearchIcon aria-hidden="true" />
                {searchLabel} “{query}”
              </CommandItem>
            </CommandGroup>
          )}
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map(({ label, href, icon: Icon }) => (
                <CommandItem
                  key={href}
                  value={label}
                  onSelect={() => {
                    onNavigate(href);
                    close();
                  }}
                >
                  {Icon && <Icon aria-hidden="true" />}
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export { CommandPalette };
