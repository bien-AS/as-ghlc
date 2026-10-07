import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  auth,
  deferred,
  field,
  navigate,
  press,
  refusal,
  renderPage,
  resetClientFakes,
  type,
} from "@/test/render";

import { SignInForm } from "./sign-in-form";

vi.mock(
  "@/lib/supabase/client",
  async () => (await import("@/test/render")).supabaseClientModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

beforeEach(resetClientFakes);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function submit(email = "ada@example.com", password = "correct horse") {
  type("Email", email);
  type("Password", password);
  press("Sign in");
}

test("signs in and goes to the remembered page", async () => {
  renderPage(<SignInForm next="/dashboard/leads/42" />);
  submit();

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith("/dashboard/leads/42"),
  );
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: "ada@example.com",
    password: "correct horse",
  });
});

test("empty fields are reported beside them and nothing is sent", () => {
  renderPage(<SignInForm next="/dashboard" />);
  press("Sign in");

  expect(screen.getByText("Enter your email.")).toBeDefined();
  expect(screen.getByText("Enter your password.")).toBeDefined();
  expect(document.activeElement).toBe(field("Email"));
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test("editing a field withdraws its error, and only its own; the next submit checks again", () => {
  renderPage(<SignInForm next="/dashboard" />);
  press("Sign in");
  expect(field("Email").getAttribute("aria-invalid")).toBe("true");
  expect(field("Password").getAttribute("aria-invalid")).toBe("true");

  type("Email", "ada@example.com");
  expect(screen.queryByText("Enter your email.")).toBeNull();
  expect(field("Email").getAttribute("aria-invalid")).toBeNull();
  expect(field("Email").getAttribute("aria-describedby")).toBeNull();
  // The other field is still wrong and still says so.
  expect(screen.getByText("Enter your password.")).toBeDefined();
  expect(field("Password").getAttribute("aria-invalid")).toBe("true");

  // Emptied again, it is not flagged while being edited; submitting flags it.
  type("Email", "");
  expect(screen.queryByText("Enter your email.")).toBeNull();
  press("Sign in");
  expect(screen.getByText("Enter your email.")).toBeDefined();
  expect(auth.signInWithPassword).not.toHaveBeenCalled();
});

test("an unconfirmed address is told to confirm, with Resend available at once", async () => {
  // The date stands still, so the second shown after Resend cannot depend on
  // how long the machine takes to get there.
  vi.useFakeTimers({ toFake: ["Date"] });
  auth.signInWithPassword.mockResolvedValue(refusal("email_not_confirmed"));
  renderPage(<SignInForm next="/dashboard" />);
  submit();

  await screen.findByText(/Confirm your email to sign in\. We sent a link to/);
  expect(screen.getByText("ada@example.com")).toBeDefined();
  expect(navigate).not.toHaveBeenCalled();

  press("Resend email");
  await screen.findByText("Sent. Check your inbox.");
  expect(auth.resend).toHaveBeenCalledWith(
    expect.objectContaining({ type: "signup", email: "ada@example.com" }),
  );
  expect(
    screen.getByRole("button", { name: "Resend email in 60s" }),
  ).toBeDefined();
  // Resend lives inside the form but must not submit it.
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
});

test("any other refusal shows one message, keeps the email and clears the password", async () => {
  auth.signInWithPassword.mockResolvedValue(refusal("invalid_credentials"));
  renderPage(<SignInForm next="/dashboard" />);
  submit("nobody@example.com", "wrong password");

  await screen.findByText("Email or password is incorrect.");
  expect(field("Email").value).toBe("nobody@example.com");
  expect(field("Password").value).toBe("");
  expect(document.activeElement).toBe(field("Password"));
  expect(screen.queryByRole("button", { name: /Resend email/ })).toBeNull();
  expect(screen.queryByText("raw text from Supabase")).toBeNull();
  expect(navigate).not.toHaveBeenCalled();
});

test("too many attempts and a network failure each say what happened", async () => {
  auth.signInWithPassword.mockResolvedValue(refusal("over_request_rate_limit"));
  renderPage(<SignInForm next="/dashboard" />);
  submit();
  await screen.findByText("Too many attempts. Try again in a few minutes.");

  auth.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
  submit();
  await screen.findByText(
    "We could not reach Dealwright. Check your connection and try again.",
  );
});

test.each([
  [
    "link_invalid",
    /That link is no longer valid\. It may have expired or already been used\. If you have confirmed your email, sign in\./,
  ],
  ["google_failed", /Google sign-in did not complete\. Try again\./],
  ["signed_out", /You have been signed out\./],
])("opens with the notice for the code %s", (code, text) => {
  renderPage(<SignInForm next="/dashboard" notice={code} />);
  expect(screen.getByRole("status").textContent).toMatch(text);
});

test("an unknown notice code shows nothing", () => {
  renderPage(<SignInForm next="/dashboard" notice="<b>free text</b>" />);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText(/free text/)).toBeNull();
});

test("while submitting: progress shown, fields locked, a second submit ignored", async () => {
  const signingIn = deferred<{ data: object; error: null }>();
  auth.signInWithPassword.mockReturnValue(signingIn.promise);
  renderPage(<SignInForm next="/dashboard" />);
  submit();

  const button = await screen.findByRole("button", { name: /Sign in/ });
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
  expect(field("Email").readOnly).toBe(true);
  expect(field("Password").readOnly).toBe(true);
  press(/Sign in/);
  expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);

  await act(async () => {
    signingIn.resolve({ data: {}, error: null });
  });
});

test("fields carry the attributes password managers and keyboards rely on", () => {
  renderPage(<SignInForm next="/dashboard" />);
  expect(field("Email").type).toBe("email");
  expect(field("Email").autocomplete).toBe("username");
  expect(field("Password").autocomplete).toBe("current-password");
  expect(
    screen
      .getByRole("link", { name: "Forgot your password?" })
      .getAttribute("href"),
  ).toBe("/reset-password");
  expect(
    screen
      .getByRole("link", { name: "Create an account" })
      .getAttribute("href"),
  ).toBe("/sign-up");
});
