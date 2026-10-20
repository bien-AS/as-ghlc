import { expect, test } from "vitest";

import {
  type AuthStatus,
  decideRedirect,
  rememberedPage,
} from "@/lib/auth/routing";

const SHOWN = null;
const NOT_SET_UP = "/access-denied?reason=not_provisioned";
const TURNED_OFF = "/access-denied?reason=deactivated";

// The "who is sent where" table (spec 01 section 5), cell by cell:
// [route, signed out, no profile, deactivated, ready]
const table: [string, ...(string | null)[]][] = [
  ["/", SHOWN, SHOWN, SHOWN, SHOWN],
  ["/login", SHOWN, SHOWN, SHOWN, "/dashboard"],
  ["/access-denied", SHOWN, SHOWN, SHOWN, SHOWN],
  ["/dashboard", "/login?next=%2Fdashboard", NOT_SET_UP, TURNED_OFF, SHOWN],
  ["/leads/42", "/login?next=%2Fleads%2F42", NOT_SET_UP, TURNED_OFF, SHOWN],
  ["/admin/reps", "/login?next=%2Fadmin%2Freps", NOT_SET_UP, TURNED_OFF, SHOWN],
  // The API refuses with 401 / 403 itself; the callback never redirects here.
  ["/api/me", SHOWN, SHOWN, SHOWN, SHOWN],
  ["/auth/callback", SHOWN, SHOWN, SHOWN, SHOWN],
];

const statuses: AuthStatus[] = [
  "signed-out",
  "no-profile",
  "inactive",
  "ready",
];

test.each(table)("%s", (route, ...expected) => {
  statuses.forEach((status, index) => {
    expect(decideRedirect(route, status), `${route} when ${status}`).toBe(
      expected[index],
    );
  });
});

test("remembers the whole requested address, query included", () => {
  expect(decideRedirect("/leads?stage=won&page=2", "signed-out")).toBe(
    "/login?next=%2Fleads%3Fstage%3Dwon%26page%3D2",
  );
});

test("a query or trailing slash does not change which row applies", () => {
  expect(decideRedirect("/login?next=%2Fdashboard", "ready")).toBe(
    "/dashboard",
  );
  expect(decideRedirect("/dashboard/", "inactive")).toBe(TURNED_OFF);
  // A route that merely starts with the same letters is not an app section.
  expect(decideRedirect("/dashboards", "signed-out")).toBeNull();
  expect(decideRedirect("/leadership", "signed-out")).toBeNull();
});

test("a remembered page is kept only when it is a safe path to an app screen", () => {
  expect(rememberedPage("/leads/42?tab=notes")).toBe("/leads/42?tab=notes");
  for (const value of [
    null,
    "",
    "https://evil.example/dashboard",
    "//evil.example/leads",
    "/login",
    "/access-denied",
    "/api/me",
  ]) {
    expect(rememberedPage(value), String(value)).toBeNull();
  }
});
