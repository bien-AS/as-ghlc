export const DEFAULT_DESTINATION = "/dashboard";

// Parsing against a throwaway origin tells us whether the value stays inside the app.
const BASE = "http://app.invalid";

function hasControlCharacter(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * The remembered destination, honoured only when it is a path inside this app.
 * Absolute URLs, protocol-relative ("//host"), backslash variants and anything
 * with control characters (which URL parsers strip, turning "/<tab>/host" into
 * "//host") fall back to the dashboard.
 */
export function safeRedirectTarget(value: string | null | undefined): string {
  if (!value?.startsWith("/")) return DEFAULT_DESTINATION;
  if (value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_DESTINATION;
  }
  if (hasControlCharacter(value)) return DEFAULT_DESTINATION;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_DESTINATION;
  }
  if (url.origin !== BASE || url.pathname.startsWith("//")) {
    return DEFAULT_DESTINATION;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
