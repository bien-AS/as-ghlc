import { expect, test } from "vitest";

import { authErrorMessage, isSessionMissing } from "@/lib/auth/errors";

const supabaseError = (code: string, message = "raw text from Supabase") =>
  Object.assign(new Error(message), {
    code,
    name: "AuthApiError",
    status: 400,
  });

test.each([
  ["email_not_confirmed", "Confirm your email to sign in."],
  ["invalid_credentials", "Email or password is incorrect."],
  [
    "over_email_send_rate_limit",
    "Too many emails sent. Wait a few minutes and try again.",
  ],
  ["over_request_rate_limit", "Too many attempts. Try again in a few minutes."],
  [
    "weak_password",
    "That password is too easy to guess. Choose a longer or less common one.",
  ],
  ["same_password", "Choose a password you have not used for this account."],
])("%s", (code, message) => {
  expect(authErrorMessage(supabaseError(code))).toBe(message);
});

test("a reset request asked again too soon gets its own wording", () => {
  expect(
    authErrorMessage(
      supabaseError("over_email_send_rate_limit"),
      "reset-request",
    ),
  ).toBe("We sent a link a moment ago. Wait a minute before asking again.");
});

test("an unknown code never shows the raw text from Supabase", () => {
  const message = authErrorMessage(
    supabaseError("user_already_exists", "User already registered"),
  );
  expect(message).toBe("Something went wrong. Try again.");
  expect(authErrorMessage(null)).toBe("Something went wrong. Try again.");
});

test("a network failure asks the person to try again", () => {
  const offline = Object.assign(new Error("Failed to fetch"), {
    name: "AuthRetryableFetchError",
    status: 0,
  });
  expect(authErrorMessage(offline)).toBe(
    "We could not reach Dealwright. Check your connection and try again.",
  );
  expect(authErrorMessage(new TypeError("Failed to fetch"))).toBe(
    "We could not reach Dealwright. Check your connection and try again.",
  );
});

test("recognises a missing session", () => {
  expect(isSessionMissing({ name: "AuthSessionMissingError" })).toBe(true);
  expect(isSessionMissing(supabaseError("session_not_found"))).toBe(true);
  expect(isSessionMissing(supabaseError("same_password"))).toBe(false);
});
