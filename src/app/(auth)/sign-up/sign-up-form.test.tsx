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

import { SignUpForm } from "./sign-up-form";

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

function fillIn(email = "ada@example.com") {
  type("First name", "Ada");
  type("Last name", "Lovelace");
  type("Email", email);
  type("Password", "correct horse");
}

/**
 * Puts the countdown on a clock the test owns: the date stands still and the
 * countdown's interval fires only when the test advances it, so how long the
 * machine takes to run a step can never change which second is on screen.
 * Timeouts stay real, so everything else (queries, findBy) behaves as usual.
 */
function ownTheClock() {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function signUp(email?: string) {
  renderPage(<SignUpForm next="/dashboard" />);
  fillIn(email);
  press("Create account");
  await screen.findByRole("heading", { name: "Check your email" });
}

test("shows an error beside each invalid field, focuses the first, and sends nothing", () => {
  renderPage(<SignUpForm next="/dashboard" />);
  type("Email", "not-an-email");
  type("Password", "short");
  press("Create account");

  expect(screen.getByText("Enter your first name.")).toBeDefined();
  expect(screen.getByText("Enter your last name.")).toBeDefined();
  expect(
    screen.getByText("Enter a valid email address, like name@example.com."),
  ).toBeDefined();
  expect(
    screen.getByText("Use at least 8 characters for your password."),
  ).toBeDefined();

  const firstName = field("First name");
  expect(document.activeElement).toBe(firstName);
  expect(firstName.getAttribute("aria-invalid")).toBe("true");
  const described = firstName.getAttribute("aria-describedby") ?? "";
  expect(document.getElementById(described)?.textContent).toBe(
    "Enter your first name.",
  );
  expect(auth.signUp).not.toHaveBeenCalled();
});

test("a successful submit shows Check your email, naming the address", async () => {
  await signUp();

  expect(screen.getByText("ada@example.com")).toBeDefined();
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(auth.signUp).toHaveBeenCalledWith({
    email: "ada@example.com",
    password: "correct horse",
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
      data: { dw_first_name: "Ada", dw_last_name: "Lovelace" },
    },
  });
  expect(
    screen.getByText(/No email after a few minutes\? Check spam\./),
  ).toBeDefined();
});

test("still ends at Check your email, and goes nowhere, when Supabase returns a session", async () => {
  // What a project with "confirm email" switched off answers.
  auth.signUp.mockResolvedValue({
    data: { user: { id: "u1" }, session: { access_token: "token" } },
    error: null,
  });
  await signUp();

  expect(
    screen.getByRole("heading", { name: "Check your email" }),
  ).toBeDefined();
  expect(navigate).not.toHaveBeenCalled();
});

test("the same state is shown for an address Supabase hides as already registered", async () => {
  auth.signUp.mockResolvedValue({
    data: { user: { id: "u1", identities: [] }, session: null },
    error: null,
  });
  await signUp();
  expect(screen.queryByText(/already registered/i)).toBeNull();
});

test("Resend waits 60 seconds, sends, shows Sent and waits again", async () => {
  ownTheClock();
  await signUp();

  const waiting = screen.getByRole("button", { name: "Resend email in 60s" });
  expect(waiting.getAttribute("aria-disabled")).toBe("true");
  press(/Resend email/);
  expect(auth.resend).not.toHaveBeenCalled();

  wait(30_000);
  expect(
    screen.getByRole("button", { name: "Resend email in 30s" }),
  ).toBeDefined();
  wait(30_000);

  const ready = screen.getByRole("button", { name: "Resend email" });
  expect(ready.getAttribute("aria-disabled")).not.toBe("true");
  press("Resend email");

  await screen.findByText("Sent. Check your inbox.");
  expect(auth.resend).toHaveBeenCalledWith({
    type: "signup",
    email: "ada@example.com",
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  });
  expect(
    screen.getByRole("button", { name: "Resend email in 60s" }),
  ).toBeDefined();
});

test("Resend shows progress while sending and cannot be pressed twice", async () => {
  ownTheClock();
  await signUp();
  wait(60_000);
  const sending = deferred<{ data: object; error: null }>();
  auth.resend.mockReturnValue(sending.promise);

  press("Resend email");
  const button = await screen.findByRole("button", { name: /Resend email/ });
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
  press(/Resend email/);
  expect(auth.resend).toHaveBeenCalledTimes(1);

  await act(async () => {
    sending.resolve({ data: {}, error: null });
  });
});

test("Resend refused for sending too often shows the wait message", async () => {
  ownTheClock();
  await signUp();
  wait(60_000);
  auth.resend.mockResolvedValue(refusal("over_email_send_rate_limit"));
  press("Resend email");

  await screen.findByText(
    "Too many emails sent. Wait a few minutes and try again.",
  );
});

test("Use a different email returns to the form with names and email kept and the password empty", async () => {
  await signUp("ada@exmaple.com");
  press("Use a different email");

  expect(field("First name").value).toBe("Ada");
  expect(field("Last name").value).toBe("Lovelace");
  expect(field("Email").value).toBe("ada@exmaple.com");
  expect(field("Password").value).toBe("");

  type("Email", "ada@example.com");
  type("Password", "correct horse");
  press("Create account");
  await screen.findByRole("heading", { name: "Check your email" });
  expect(screen.getByText("ada@example.com")).toBeDefined();
});

test("while submitting: progress shown, fields locked, a second submit ignored", async () => {
  const creating = deferred<{ data: object; error: null }>();
  auth.signUp.mockReturnValue(creating.promise);
  renderPage(<SignUpForm next="/dashboard" />);
  fillIn();
  press("Create account");

  const submit = await screen.findByRole("button", { name: /Create account/ });
  await waitFor(() => expect(submit.getAttribute("aria-busy")).toBe("true"));
  expect(field("Email").readOnly).toBe(true);
  press(/Create account/);
  expect(auth.signUp).toHaveBeenCalledTimes(1);

  await act(async () => {
    creating.resolve({ data: {}, error: null });
  });
});

test("a refused submit keeps the values except the password", async () => {
  auth.signUp.mockResolvedValue(refusal("over_request_rate_limit"));
  renderPage(<SignUpForm next="/dashboard" />);
  fillIn();
  press("Create account");

  await screen.findByText("Too many attempts. Try again in a few minutes.");
  expect(field("First name").value).toBe("Ada");
  expect(field("Email").value).toBe("ada@example.com");
  expect(field("Password").value).toBe("");
  expect(screen.queryByText("raw text from Supabase")).toBeNull();
});

test("a password Supabase finds too weak says so", async () => {
  auth.signUp.mockResolvedValue(refusal("weak_password"));
  renderPage(<SignUpForm next="/dashboard" />);
  fillIn();
  press("Create account");
  await screen.findByText(/too easy to guess/);
});

test("the password can be shown and hidden", () => {
  renderPage(<SignUpForm next="/dashboard" />);
  expect(field("Password").type).toBe("password");
  press("Show password");
  expect(field("Password").type).toBe("text");
  press("Show password");
  expect(field("Password").type).toBe("password");
});

test("Continue with Google starts at Google and returns to our callback", async () => {
  renderPage(<SignUpForm next="/dashboard/leads/42" />);
  press("Continue with Google");
  await waitFor(() =>
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fdashboard%2Fleads%2F42`,
      },
    }),
  );
});
