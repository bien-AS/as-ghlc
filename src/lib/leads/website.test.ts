import { expect, test } from "vitest";

import { websiteHref } from "./website";

test("a website becomes an http(s) link target, or null", () => {
  expect(websiteHref("acme.com")).toBe("https://acme.com/");
  expect(websiteHref(" http://acme.com/about ")).toBe("http://acme.com/about");
  expect(websiteHref("https://acme.com")).toBe("https://acme.com/");
  expect(websiteHref("javascript:alert(1)")).toBeNull();
  expect(websiteHref("mailto:a@acme.com")).toBeNull();
  expect(websiteHref("not a url")).toBeNull();
});
