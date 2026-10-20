type AuthErrorLike = { name?: unknown; status?: unknown };

/**
 * Turns a failed Google redirect into words. Raw text from Supabase is never
 * shown.
 */
export function authErrorMessage(error: unknown): string {
  const e = error as AuthErrorLike | null;
  const network =
    e?.name === "AuthRetryableFetchError" ||
    error instanceof TypeError ||
    e?.status === 0;
  return network
    ? "We could not reach the server. Check your connection and try again."
    : "Something went wrong. Try again.";
}
