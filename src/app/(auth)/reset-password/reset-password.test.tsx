import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  auth,
  field,
  navigate,
  press,
  refusal,
  renderPage,
  resetClientFakes,
  type,
} from "@/test/render";

import { ResetRequestForm } from "./reset-request-form";
import { UpdatePasswordForm } from "./update/update-password-form";

vi.mock(
  "@/lib/supabase/client",
  async () => (await import("@/test/render")).supabaseClientModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

beforeEach(resetClientFakes);
afterEach(cleanup);

test("request: the same neutral message whatever the address", async () => {
  renderPage(<ResetRequestForm />);
  type("Email", "anyone@example.com");
  press("Send reset link");

  const message = await screen.findByText(/If an account exists for/);
  expect(message.textContent).toBe(
    "If an account exists for anyone@example.com, we have sent a link to reset your password.",
  );
  expect(message.closest("[role=status]")).not.toBeNull();
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "anyone@example.com",
    { redirectTo: `${window.location.origin}/auth/confirm` },
  );
});

test("request: asked again too soon says to wait a minute", async () => {
  auth.resetPasswordForEmail.mockResolvedValue(
    refusal("over_email_send_rate_limit"),
  );
  renderPage(<ResetRequestForm />);
  type("Email", "ada@example.com");
  press("Send reset link");

  await screen.findByText(
    "We sent a link a moment ago. Wait a minute before asking again.",
  );
  expect(field("Email").value).toBe("ada@example.com");
});

test("request: a malformed email is reported beside the field", () => {
  renderPage(<ResetRequestForm />);
  type("Email", "ada@");
  press("Send reset link");
  expect(
    screen.getByText("Enter a valid email address, like name@example.com."),
  ).toBeDefined();
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
});

test("request: opens with the link-no-longer-valid notice", () => {
  renderPage(<ResetRequestForm notice="link_invalid" />);
  expect(screen.getByRole("status").textContent).toBe(
    "That link is no longer valid. It may have expired or already been used. Request a new one.",
  );
});

test("update: saves the new password and goes to the dashboard", async () => {
  renderPage(<UpdatePasswordForm />);
  type("New password", "a brand new one");
  press("Save password");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "a brand new one" });
});

test("update: too short is caught before sending", () => {
  renderPage(<UpdatePasswordForm />);
  type("New password", "short");
  press("Save password");
  expect(
    screen.getByText("Use at least 8 characters for your password."),
  ).toBeDefined();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

test.each([
  ["same_password", "Choose a password you have not used for this account."],
  [
    "weak_password",
    "That password is too easy to guess. Choose a longer or less common one.",
  ],
])("update: %s is explained", async (code, message) => {
  auth.updateUser.mockResolvedValue(refusal(code));
  renderPage(<UpdatePasswordForm />);
  type("New password", "the old password");
  press("Save password");
  await screen.findByText(message);
  expect(navigate).not.toHaveBeenCalled();
});

test("update: a session that is gone returns to the request form with the notice", async () => {
  auth.updateUser.mockResolvedValue({
    data: {},
    error: Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
      status: 400,
    }),
  });
  renderPage(<UpdatePasswordForm />);
  type("New password", "a brand new one");
  press("Save password");

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      "/reset-password?notice=link_invalid",
    ),
  );
});
