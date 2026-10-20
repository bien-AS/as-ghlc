/**
 * A lead's website as a link target, or null when it should not be a link.
 * "acme.com" is the site a person meant (https://, as research fetches it), not
 * a path in the app; anything but http(s) ("javascript:", "mailto:") is null.
 * Pure, so the screens can use it; research-fetch keeps its own copy (server).
 */
export function websiteHref(website: string): string | null {
  const trimmed = website.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  if (!URL.canParse(withScheme)) return null;
  const url = new URL(withScheme);
  return url.protocol === "https:" || url.protocol === "http:"
    ? url.href
    : null;
}
