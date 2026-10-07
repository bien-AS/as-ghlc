export const AUTH_MESSAGES = {
  notConfirmed: "Confirm your email to sign in.",
  invalidCredentials: "Email or password is incorrect.",
  emailRateLimit: "Too many emails sent. Wait a few minutes and try again.",
  resetTooSoon:
    "We sent a link a moment ago. Wait a minute before asking again.",
  requestRateLimit: "Too many attempts. Try again in a few minutes.",
  weakPassword:
    "That password is too easy to guess. Choose a longer or less common one.",
  samePassword: "Choose a password you have not used for this account.",
  network:
    "We could not reach Dealwright. Check your connection and try again.",
  fallback: "Something went wrong. Try again.",
} as const;

type AuthErrorLike = { code?: unknown; name?: unknown; status?: unknown };

export function authErrorCode(error: unknown): string | undefined {
  const code = (error as AuthErrorLike | null)?.code;
  return typeof code === "string" ? code : undefined;
}

/** The session the action needed is gone (expired, or signed out elsewhere). */
export function isSessionMissing(error: unknown): boolean {
  const e = error as AuthErrorLike | null;
  return (
    e?.name === "AuthSessionMissingError" ||
    e?.code === "session_not_found" ||
    e?.code === "session_expired"
  );
}

function isNetworkFailure(error: unknown): boolean {
  const e = error as AuthErrorLike | null;
  return (
    e?.name === "AuthRetryableFetchError" ||
    error instanceof TypeError ||
    e?.status === 0
  );
}

/**
 * Turns a Supabase Auth error into the message spec 02 gives for it. Unknown
 * codes get the fallback; raw text from Supabase is never shown.
 *
 * Supabase reports "one email per address per 60 seconds" and the wider email
 * limit with the same code, so the reset request form asks for its own wording.
 */
export function authErrorMessage(
  error: unknown,
  context?: "reset-request",
): string {
  switch (authErrorCode(error)) {
    case "email_not_confirmed":
      return AUTH_MESSAGES.notConfirmed;
    case "invalid_credentials":
      return AUTH_MESSAGES.invalidCredentials;
    case "over_email_send_rate_limit":
      return context === "reset-request"
        ? AUTH_MESSAGES.resetTooSoon
        : AUTH_MESSAGES.emailRateLimit;
    case "over_request_rate_limit":
      return AUTH_MESSAGES.requestRateLimit;
    case "weak_password":
      return AUTH_MESSAGES.weakPassword;
    case "same_password":
      return AUTH_MESSAGES.samePassword;
  }
  if ((error as AuthErrorLike | null)?.name === "AuthWeakPasswordError") {
    return AUTH_MESSAGES.weakPassword;
  }
  return isNetworkFailure(error)
    ? AUTH_MESSAGES.network
    : AUTH_MESSAGES.fallback;
}
