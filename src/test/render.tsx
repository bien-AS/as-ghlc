import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

/*
 * Page-level test helpers. Supabase Auth is stubbed at its browser client:
 *   vi.mock("@/lib/supabase/client", async () => (await import("@/test/render")).supabaseClientModule);
 *   vi.mock("@/lib/navigate", async () => (await import("@/test/render")).navigateModule);
 */

const ok = { data: {}, error: null };

export const auth = {
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

export const navigate = vi.fn();

export function resetClientFakes() {
  for (const mock of Object.values(auth)) {
    mock.mockReset().mockResolvedValue(ok);
  }
  navigate.mockReset();
}

export const supabaseClientModule = { createClient: () => ({ auth }) };
export const navigateModule = { navigate };

/** What Supabase Auth answers when it refuses. */
export const refusal = (code: string) => ({
  data: {},
  error: Object.assign(new Error("raw text from Supabase"), {
    code,
    name: "AuthApiError",
    status: 400,
  }),
});

/** A promise the test settles by hand, to observe the loading state. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function renderPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

export const field = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(label);

export function type(label: string, value: string) {
  fireEvent.change(field(label), { target: { value } });
}

export function press(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}
