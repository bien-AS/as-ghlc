// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, test } from "vitest";

import { cleanAuthAddress } from "@/lib/auth/routing";
import { proxy } from "@/proxy";

const ORIGIN = "http://localhost:3000";
const visit = (path: string) => proxy(new NextRequest(`${ORIGIN}${path}`));

test("an auth page loaded with form fields in its query redirects to the same page without them, keeping a valid next", async () => {
  const response = await visit(
    "/sign-in?email=a@example.com&password=x&next=%2Fdashboard%2Fleads%2Flead-01",
  );
  expect(response.status).toBe(303);
  const location = response.headers.get("location") ?? "";
  expect(location).toBe(
    `${ORIGIN}/sign-in?next=%2Fdashboard%2Fleads%2Flead-01`,
  );
  expect(location).not.toContain("password");
  expect(location).not.toContain("email");
});

test("with nothing worth keeping, the redirect goes to the bare page", async () => {
  const response = await visit("/sign-in?email=a@example.com&password=x");
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`${ORIGIN}/sign-in`);
});

test("every auth page is covered, and only next and notice survive", () => {
  for (const page of [
    "/sign-in",
    "/sign-up",
    "/reset-password",
    "/reset-password/update",
    "/profile-setup",
  ]) {
    expect(cleanAuthAddress(page, "?firstName=Ada&lastName=L&password=x")).toBe(
      page,
    );
  }
  expect(
    cleanAuthAddress("/reset-password", "?notice=link_invalid&email=a%40b.c"),
  ).toBe("/reset-password?notice=link_invalid");
  // An address that is already clean is left alone: no redirect loop.
  expect(cleanAuthAddress("/sign-in", "")).toBeNull();
  expect(cleanAuthAddress("/sign-in", "?next=%2Fdashboard")).toBeNull();
  expect(cleanAuthAddress("/sign-in", "?notice=signed_out")).toBeNull();
  // Other routes keep their queries.
  expect(cleanAuthAddress("/dashboard", "?q=ada")).toBeNull();
  expect(cleanAuthAddress("/auth/confirm", "?token_hash=abc")).toBeNull();
});

test("a next that leaves the app, or an unknown notice, is dropped rather than kept", () => {
  expect(cleanAuthAddress("/sign-in", "?next=https%3A%2F%2Fevil.example")).toBe(
    "/sign-in",
  );
  expect(cleanAuthAddress("/sign-in", "?notice=%3Cb%3Ehello")).toBe("/sign-in");
});
