import type { VariantProps } from "class-variance-authority";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A link that looks like a button (spec 03: "a button can also render as a
 * link"). It stays a link to assistive technology and to the keyboard: it
 * goes somewhere, it does not do something. `aria-disabled` makes it inert.
 */
function LinkButton({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="link-button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { LinkButton };
