"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A labelled text input with its hint and error wired up: the label points at
 * the input, the hint and error are tied to it with `aria-describedby`, and an
 * error sets `aria-invalid`. `type="password"` adds a show / hide control.
 */
function FormField({
  label,
  hint,
  error,
  type = "text",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  hint?: React.ReactNode;
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  const input = (
    <Input
      id={id}
      type={isPassword && revealed ? "text" : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : hint ? hintId : undefined}
      className={cn(
        "read-only:text-muted-foreground",
        isPassword && "pr-9",
        className,
      )}
      {...props}
    />
  );

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            aria-pressed={revealed}
            data-slot="password-toggle"
            aria-label="Show password"
            title={revealed ? "Hide password" : "Show password"}
            onClick={() => setRevealed((value) => !value)}
            // Larger than it looks: the hit area reaches the input's edge.
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {revealed ? (
              <EyeOffIcon aria-hidden="true" className="size-4" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      ) : (
        input
      )}
      {/* The error replaces the hint: it says the same thing, more precisely. */}
      {hint && !error && (
        <FieldDescription id={hintId}>{hint}</FieldDescription>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  );
}

export { FormField };
