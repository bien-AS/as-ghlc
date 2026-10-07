import Image from "next/image";

import { ENDORSER_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Intrinsic size of both files. The ratio is fixed here so no screen can stretch it.
const WIDTH = 680;
const HEIGHT = 173;

const FILES = {
  // Near-black lettering, for light surfaces.
  light: "/as-logo.png",
  // All-white artwork, for dark surfaces.
  dark: "/as-logo-white.png",
} as const;

/**
 * The endorsing company's logo (spec 03, "Logo and wordmark"). Sized by height
 * only; the width follows from the fixed ratio. It draws no box of its own:
 * clear space comes from the layout around it.
 *
 * `surface="auto"` follows the theme. Both files are in the markup and the
 * theme class (set before first paint) picks one with CSS, so the wrong logo
 * never flashes. A section that is dark inside the light theme, or light
 * inside the dark theme, forces the file with `surface`.
 */
function AuthoritySolutionsLogo({
  height = 24,
  surface = "auto",
  className,
}: {
  /** Rendered height of the artwork in pixels. Width follows from the ratio. */
  height?: number;
  /** The surface the logo sits on. "auto" follows the theme. */
  surface?: "auto" | "light" | "dark";
  className?: string;
}) {
  const width = Math.round((height * WIDTH) / HEIGHT);
  const file = (on: "light" | "dark", themeClass: string) => (
    <Image
      src={FILES[on]}
      alt={ENDORSER_NAME}
      width={width}
      height={height}
      // Both are small; loading the hidden one too means a theme change does not wait for it.
      loading="eager"
      className={cn("max-w-none", surface === "auto" && themeClass)}
    />
  );

  return (
    <span
      data-slot="authority-solutions-logo"
      className={cn("inline-block shrink-0 align-middle", className)}
    >
      {surface !== "dark" && file("light", "block dark:hidden")}
      {surface !== "light" && file("dark", "hidden dark:block")}
    </span>
  );
}

export { AuthoritySolutionsLogo };
