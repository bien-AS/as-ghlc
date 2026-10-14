"use client";

import "./globals.css";

/**
 * The last resort: replaces the root layout when the layout itself fails, so it
 * brings its own html and body and uses no provider. Dark is the default theme.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The app could not start. Try again; if it keeps happening, tell an
          admin.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
