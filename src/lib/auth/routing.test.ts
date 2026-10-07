import { expect, test } from "vitest";

import { type AuthStatus, decideRedirect } from "@/lib/auth/routing";

const SHOWN = null;

// The "who is sent where" table from spec 02, cell by cell:
// [route, signed out, signed in without a profile, signed in with a profile]
const table: [string, string | null, string | null, string | null][] = [
  ["/", SHOWN, SHOWN, SHOWN],
  ["/sign-in", SHOWN, "/profile-setup", "/dashboard"],
  ["/sign-up", SHOWN, "/profile-setup", "/dashboard"],
  ["/reset-password", SHOWN, "/profile-setup", "/dashboard"],
  [
    "/reset-password/update",
    "/reset-password?notice=link_invalid",
    SHOWN,
    SHOWN,
  ],
  ["/profile-setup", "/sign-in", SHOWN, "/dashboard"],
  ["/dashboard", "/sign-in?next=%2Fdashboard", "/profile-setup", SHOWN],
  [
    "/dashboard/leads/42",
    "/sign-in?next=%2Fdashboard%2Fleads%2F42",
    "/profile-setup",
    SHOWN,
  ],
  // The API refuses with 401 / 403 itself; the return routes never redirect here.
  ["/api/me", SHOWN, SHOWN, SHOWN],
  ["/auth/confirm", SHOWN, SHOWN, SHOWN],
  ["/auth/callback", SHOWN, SHOWN, SHOWN],
];

const statuses: AuthStatus[] = ["signed-out", "no-profile", "ready"];

test.each(table)("%s", (route, ...expected) => {
  statuses.forEach((status, index) => {
    expect(decideRedirect(route, status), `${route} when ${status}`).toBe(
      expected[index],
    );
  });
});

test("remembers the whole requested address, query included", () => {
  expect(
    decideRedirect("/dashboard/leads?stage=won&page=2", "signed-out"),
  ).toBe("/sign-in?next=%2Fdashboard%2Fleads%3Fstage%3Dwon%26page%3D2");
});

test("a query or trailing slash does not change which row applies", () => {
  expect(decideRedirect("/sign-in?next=%2Fdashboard", "ready")).toBe(
    "/dashboard",
  );
  expect(decideRedirect("/profile-setup/", "signed-out")).toBe("/sign-in");
  // A route that merely starts with the same letters is not the dashboard.
  expect(decideRedirect("/dashboards", "signed-out")).toBeNull();
});
