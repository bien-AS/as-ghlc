import type { ApiErrorCode } from "@/lib/auth/schemas";
import { navigate } from "@/lib/navigate";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: ApiErrorCode,
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

/**
 * The one way client hooks call our Route Handlers. It also applies the
 * refusal contract: 401 sends the person to sign in (remembering the page),
 * 403 "profile_required" sends them to profile setup.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: ApiErrorCode };
  } | null;
  const error = new ApiError(response.status, body?.error?.code);

  if (error.status === 401) {
    const here = `${window.location.pathname}${window.location.search}`;
    navigate(`/sign-in?next=${encodeURIComponent(here)}`);
  } else if (error.code === "profile_required") {
    navigate("/profile-setup");
  }
  throw error;
}
