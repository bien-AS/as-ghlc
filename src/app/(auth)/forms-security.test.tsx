import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

import { renderPage } from "@/test/render";

import { ProfileSetupForm } from "./profile-setup/profile-setup-form";
import { ResetRequestForm } from "./reset-password/reset-request-form";
import { UpdatePasswordForm } from "./reset-password/update/update-password-form";
import { SignInForm } from "./sign-in/sign-in-form";
import { SignUpForm } from "./sign-up/sign-up-form";

vi.mock(
  "@/lib/supabase/client",
  async () => (await import("@/test/render")).supabaseClientModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

afterEach(cleanup);

/*
 * A form the browser submits itself (before React has attached `onSubmit`, or
 * when the script failed) must never put its fields in the address. GET is the
 * browser's default, so every auth form states POST, and its submit control
 * does nothing until the form has hydrated.
 */
const forms: [string, React.ReactElement, string][] = [
  ["sign-in", <SignInForm key="1" next="/dashboard" />, "Sign in"],
  ["sign-up", <SignUpForm key="2" next="/dashboard" />, "Create account"],
  ["reset request", <ResetRequestForm key="3" />, "Send reset link"],
  ["update password", <UpdatePasswordForm key="4" />, "Save password"],
  [
    "profile setup",
    <ProfileSetupForm
      key="5"
      email="ada@example.com"
      defaults={{ firstName: "Ada", lastName: "Lovelace" }}
    />,
    "Continue",
  ],
];

test.each(forms)("the %s form submits with POST, never GET", (_name, form) => {
  const { container } = renderPage(form);
  const element = container.querySelector("form");
  expect(element?.getAttribute("method")).toBe("post");
  // The property is what the browser acts on; "get" is its default.
  expect(element?.method).toBe("post");
});

test.each(forms)(
  "the %s form's submit control is disabled in the server's HTML and enabled once hydrated",
  (_name, form, label) => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        {form}
      </QueryClientProvider>,
    );
    const server = document.createElement("div");
    server.innerHTML = html;
    const before = server.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(before?.textContent).toContain(label);
    expect(before?.disabled).toBe(true);

    const { container } = renderPage(form);
    const after = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(after?.disabled).toBe(false);
  },
);
