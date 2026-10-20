// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

import {
  assertPublicUrl,
  fetchSite,
  htmlToText,
  isPrivateAddress,
} from "./research-fetch";

/** acme.example resolves to a public address; every other name resolves for real (localhost, IP literals). */
vi.mock("node:dns/promises", async (original) => {
  const dns = await original<typeof import("node:dns/promises")>();
  return {
    ...dns,
    lookup: (host: string, options: object) =>
      host === "acme.example"
        ? Promise.resolve([{ address: "93.184.216.34", family: 4 }])
        : dns.lookup(host, options as never),
  };
});

afterEach(() => vi.unstubAllGlobals());

test("private, loopback, link-local and mapped addresses are refused; public ones are not", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    // IPv6 forms that carry an IPv4 address: compatible, NAT64, 6to4, SIIT; and site-local.
    "::7f00:1",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::a00:1",
    "2002:a9fe:a9fe::1",
    "::ffff:0:7f00:1",
    "fec0::1",
    "not-an-ip",
  ]) {
    expect(isPrivateAddress(address), address).toBe(true);
  }
  expect(isPrivateAddress("93.184.216.34")).toBe(false);
  expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
});

test("the SSRF guard refuses localhost, private IPs and non-http schemes before any fetch", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const url of [
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://10.0.0.5/admin",
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
    "ftp://acme.example/",
    "http://user:pass@acme.example/",
  ]) {
    await expect(assertPublicUrl(url), url).rejects.toThrow(/Refused/);
  }
  await expect(fetchSite("http://localhost:3000")).rejects.toThrow(/Refused/);
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(
    assertPublicUrl("https://acme.example/"),
  ).resolves.toBeInstanceOf(URL);
});

test("a redirect to a private address is refused", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
        }),
    ),
  );
  await expect(fetchSite("acme.example")).rejects.toThrow(/Refused 169\.254/);
});

test("reads the home page and its same-site about page as text, with a User-Agent and no redirects followed blindly", async () => {
  const fetchMock = vi.fn(async (url: URL, _init?: RequestInit) =>
    url.pathname === "/"
      ? new Response(
          `<html><head><style>.x{}</style><script>alert(1)</script></head>
           <body><h1>Acme &amp; Sons</h1><a href="/about-us">About</a>
           <a href="https://other.example/services">Elsewhere</a></body></html>`,
          { headers: { "content-type": "text/html" } },
        )
      : new Response("<p>Family run since 1990</p>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
  );
  vi.stubGlobal("fetch", fetchMock);

  expect(await fetchSite("acme.example")).toEqual([
    { url: "https://acme.example/", text: "Acme & Sons About Elsewhere" },
    { url: "https://acme.example/about-us", text: "Family run since 1990" },
  ]);
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  expect(init.redirect).toBe("manual");
  expect(new Headers(init.headers).get("user-agent")).toMatch(/Bot/);
});

test("htmlToText drops scripts and comments and decodes entities", () => {
  expect(
    htmlToText("<script>x</script><!-- c --><b>a&nbsp;&#38;&#x42;</b>"),
  ).toBe("a &B");
});
