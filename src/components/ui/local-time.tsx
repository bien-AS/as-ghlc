"use client";

import { useTimeZone } from "@/hooks/use-time-zone";

const FORMATS = {
  /** "Wed, Oct 7, 2:30 PM" */
  dateTime: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  /** "Oct 7, 2026" */
  date: { month: "short", day: "numeric", year: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A moment shown in the viewer's time zone, with the exact time on hover and
 * for assistive technology through <time>.
 * ponytail: the locale is fixed to en-US so server and browser print the same
 * text; read it from the user's settings when the product is translated.
 */
function LocalTime({
  value,
  format = "dateTime",
  className,
}: {
  /** An ISO time. */
  value: string;
  format?: keyof typeof FORMATS;
  className?: string;
}) {
  const timeZone = useTimeZone();
  const date = new Date(value);
  return (
    <time
      data-slot="local-time"
      dateTime={value}
      title={new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone,
      }).format(date)}
      className={className}
    >
      {new Intl.DateTimeFormat("en-US", {
        ...FORMATS[format],
        timeZone,
      }).format(date)}
    </time>
  );
}

export { LocalTime };
