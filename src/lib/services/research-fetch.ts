import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

/*
 * Fetches a lead's website for the research brief (spec 07). Server only.
 * The URL comes from the lead's form, so it is untrusted: http(s) only, every
 * hop's host must resolve to public addresses (no loopback, private, link-local
 * or metadata ranges), redirects are followed by hand so each one is checked,
 * and every response is time- and size-capped before it is stripped to text.
 *
 * ponytail: the address is checked, then fetch resolves the host again, so a
 * DNS answer that changes in between (rebinding) is not caught. Pin the checked
 * address with an undici dispatcher if the job ever runs next to internal services.
 */

const USER_AGENT =
  "AuthoritySolutionsResearchBot/1.0 (+https://authoritysolutions.com)";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
/** Characters of text kept per page, so the prompt stays a bounded size. */
const MAX_PAGE_CHARS = 12_000;
/** Same-site pages read besides the home page. */
const MAX_EXTRA_PAGES = 3;
const EXTRA_PAGE = /about|service|product|pricing|solution|location|contact/i;

export type SitePage = { url: string; text: string };

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  // Unspecified, loopback and IPv4-compatible (::a.b.c.d). This and the next
  // four carry an IPv4 address BlockList does not unwrap: SIIT, NAT64, 6to4.
  ["::", 96],
  ["::ffff:0:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2002::", 16],
  // Deprecated site-local.
  ["fec0::", 10],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/**
 * True for an address the job must never reach. BlockList checks an
 * IPv4-mapped IPv6 address (::ffff:127.0.0.1) against the IPv4 rules itself.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return true;
  return blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** The URL, if it is http(s) on a host that resolves only to public addresses; throws otherwise. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Refused ${url.protocol} URL`);
  }
  if (url.username || url.password)
    throw new Error("Refused URL with credentials");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error(`Refused ${url.hostname}: not a public address`);
  }
  return url;
}

/** The body as text, cut off at MAX_BYTES. */
async function readCapped(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/** One page's HTML (or text), following and re-checking up to MAX_REDIRECTS redirects. */
async function fetchPage(raw: string): Promise<{ url: string; html: string }> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      if (hop >= MAX_REDIRECTS)
        throw new Error(`Too many redirects from ${raw}`);
      url = await assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`${url.href} answered ${response.status}`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|xhtml/i.test(type)) {
      await response.body?.cancel();
      throw new Error(`${url.href} is not a web page (${type})`);
    }
    return { url: url.href, html: await readCapped(response) };
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Visible text: scripts, styles and tags dropped, whitespace collapsed. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (entity, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? entity;
      const point =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
}

/** Up to MAX_EXTRA_PAGES same-site links that look like about/services pages. */
function extraPages(html: string, base: string): string[] {
  const origin = new URL(base).origin;
  const found = new Set<string>();
  for (const [, href] of html.matchAll(
    /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)/gi,
  )) {
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    url.hash = "";
    if (url.origin !== origin || url.href === base) continue;
    if (EXTRA_PAGE.test(url.pathname)) found.add(url.href);
    if (found.size >= MAX_EXTRA_PAGES) break;
  }
  return [...found];
}

/** "acme.com" as the URL a person meant: https:// when no scheme is given. */
export const normaliseWebsite = (website: string) =>
  /^[a-z][a-z\d+.-]*:/i.test(website.trim())
    ? website.trim()
    : `https://${website.trim()}`;

/**
 * The home page (which must load, or this throws) and a few same-site pages it
 * links to (each skipped if it fails), as text.
 */
export async function fetchSite(website: string): Promise<SitePage[]> {
  const home = await fetchPage(normaliseWebsite(website));
  const pages: SitePage[] = [{ url: home.url, text: htmlToText(home.html) }];
  for (const link of extraPages(home.html, home.url)) {
    try {
      const page = await fetchPage(link);
      pages.push({ url: page.url, text: htmlToText(page.html) });
    } catch {
      // A broken about page does not spoil the brief.
    }
  }
  return pages;
}
