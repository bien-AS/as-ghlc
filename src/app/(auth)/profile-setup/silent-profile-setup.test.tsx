import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  deferred,
  field,
  navigate,
  renderPage,
  resetClientFakes,
} from "@/test/render";

import { SilentProfileSetup } from "./silent-profile-setup";

vi.mock(
  "@/lib/supabase/client",
  async () => (await import("@/test/render")).supabaseClientModule,
);
vi.mock(
  "@/lib/navigate",
  async () => (await import("@/test/render")).navigateModule,
);

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status });

const ada = {
  id: "auth-user-1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
};
const props = {
  email: "ada@example.com",
  defaults: { firstName: "Ada", lastName: "Lovelace" },
};

beforeEach(() => {
  resetClientFakes();
  fetchMock.mockReset().mockImplementation(async () => json(ada, 201));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settingUp = () =>
  screen.queryByRole("heading", { name: "Setting up your account" });

test("the silent path ends in a redirect to /dashboard, asking the server with a bodiless POST", async () => {
  renderPage(<SilentProfileSetup {...props} />);

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe("/api/profile/silent");
  expect(init?.method).toBe("POST");
  // Nothing is sent: the server takes the names, id and email from the session.
  expect(init?.body).toBeUndefined();
  // Still "Setting up" while the browser loads the dashboard; never the form.
  expect(settingUp()).not.toBeNull();
  expect(screen.queryByLabelText("First name")).toBeNull();
});

test("there is always something on screen: Setting up while waiting, then the next state", async () => {
  const creating = deferred<Response>();
  fetchMock.mockImplementation(() => creating.promise);
  const { container } = renderPage(<SilentProfileSetup {...props} />);

  expect(settingUp()).not.toBeNull();
  expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
  expect(navigate).not.toHaveBeenCalled();

  await act(async () => {
    creating.resolve(json(ada, 201));
  });
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  expect(container.textContent).not.toBe("");
});

test.each([
  ["the server says the form is required", 409, "profile_form_required"],
  ["another profile uses the email", 409, "email_conflict"],
  ["the server fails", 500, undefined],
])(
  "when %s the person ends on the form, prefilled, not on an empty page",
  async (_name, status, code) => {
    fetchMock.mockImplementation(async () =>
      json(code ? { error: { code } } : {}, status),
    );
    renderPage(<SilentProfileSetup {...props} />);

    await screen.findByRole("heading", { name: "Set up your profile" });
    expect(field("First name").value).toBe("Ada");
    expect(field("Last name").value).toBe("Lovelace");
    expect(field("Email").value).toBe("ada@example.com");
    expect(settingUp()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  },
);

test("when the request cannot be made at all the person ends on the form", async () => {
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  renderPage(<SilentProfileSetup {...props} />);
  await screen.findByRole("heading", { name: "Set up your profile" });
  expect(navigate).not.toHaveBeenCalled();
});

test("a session that ended goes to sign-in, without flashing the form", async () => {
  fetchMock.mockImplementation(async () =>
    json({ error: { code: "unauthenticated" } }, 401),
  );
  renderPage(<SilentProfileSetup {...props} />);

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/sign-in\?next=/),
    ),
  );
  expect(settingUp()).not.toBeNull();
  expect(screen.queryByLabelText("First name")).toBeNull();
});

test("asks once, even when React runs effects twice in development", async () => {
  renderPage(
    <StrictMode>
      <SilentProfileSetup {...props} />
    </StrictMode>,
  );
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledTimes(1);
});
