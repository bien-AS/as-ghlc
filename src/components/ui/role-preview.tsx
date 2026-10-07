"use client";

import { ChevronDownIcon, EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RolePreviewOption = {
  value: string;
  label: string;
  /** One line saying what this role sees. */
  sees: string;
};

export type RolePreviewProps = {
  /** The role being previewed. */
  value: string;
  options: RolePreviewOption[];
  onChange: (value: string) => void;
  /** A switch is being saved: the choices are inert until the page reloads. */
  pending?: boolean;
  /** Extra detail for the current role, e.g. whose leads a Staff preview shows. */
  detail?: string;
};

const NOTE =
  "A preview on sample data. It changes what this browser is shown, not who has access.";

/**
 * The choices of the role preview, for a dropdown menu: used by `RolePreview`
 * and, on small screens, inside the user menu.
 */
function RolePreviewGroup({
  value,
  options,
  onChange,
  pending = false,
  detail,
}: RolePreviewProps) {
  return (
    <DropdownMenuGroup data-slot="role-preview-group">
      <DropdownMenuLabel>Viewing as (preview)</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => {
          if (next !== value) onChange(next as string);
        }}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            disabled={pending}
            className="items-start"
          >
            <span className="flex flex-col">
              <span className="font-semibold">{option.label}</span>
              <span className="text-muted-foreground">{option.sees}</span>
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <p className="px-1.5 pt-1 pb-1.5 text-xs text-pretty text-muted-foreground">
        {detail && <>{detail} </>}
        {NOTE}
      </p>
    </DropdownMenuGroup>
  );
}

/**
 * The "Viewing as" control (spec 04; spec 12, question 7): previews what each
 * role would see while the dashboard runs on sample data. It is a preview
 * tool, not access control, and says so in its menu.
 */
function RolePreview({
  className,
  ...props
}: RolePreviewProps & { className?: string }) {
  const current = props.options.find((option) => option.value === props.value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            data-slot="role-preview"
            aria-label={`Viewing as ${current?.label ?? props.value} (preview)`}
            loading={props.pending}
            className={cn("shrink-0 gap-1.5", className)}
          />
        }
      >
        {!props.pending && <EyeIcon aria-hidden="true" />}
        <span className="font-normal text-muted-foreground">Viewing as</span>
        {current?.label ?? props.value}
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <RolePreviewGroup {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RolePreview, RolePreviewGroup };
