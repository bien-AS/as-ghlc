import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  auth,
  deferred,
  field,
  navigate,
  press,
  renderPage,
  resetClientFakes,
  type,
} from "@/test/render";

import { ProfileSetupForm } from "./profile-setup-form";

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
const blank = { firstName: "", lastName: "" };

beforeEach(() => {
  resetClientFakes();
  fetchMock.mockReset().mockImplementation(async () => json(ada, 201));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("prefilled from Google: names in the fields, email shown read-only", () => {
  renderPage(
    <ProfileSetupForm
      email="ada@example.com"
      defaults={{ firstName: "Ada", lastName: "Lovelace" }}
    />,
  );
  expect(field("First name").value).toBe("Ada");
  expect(field("Last name").value).toBe("Lovelace");
  expect(field("Email").value).toBe("ada@example.com");
  expect(field("Email").readOnly).toBe(true);
});

test("blank when no names are known, and both are required", () => {
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  expect(field("First name").value).toBe("");
  expect(field("Last name").value).toBe("");

  press("Continue");
  expect(screen.getByText("Enter your first name.")).toBeDefined();
  expect(screen.getByText("Enter your last name.")).toBeDefined();
  expect(document.activeElement).toBe(field("First name"));
  expect(fetchMock).not.toHaveBeenCalled();
});

test("submits the two names only, then goes to the dashboard", async () => {
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  type("First name", " Ada ");
  type("Last name", "Lovelace");
  press("Continue");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  const [path, init] = fetchMock.mock.calls[0];
  expect(path).toBe("/api/profile");
  expect(init?.method).toBe("POST");
  // No id and no email: the server takes those from the session.
  expect(JSON.parse(String(init?.body))).toEqual({
    firstName: "Ada",
    lastName: "Lovelace",
  });
});

test("another profile using the email asks the person to sign in the original way", async () => {
  fetchMock.mockImplementation(async () =>
    json({ error: { code: "email_conflict" } }, 409),
  );
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  type("First name", "Ada");
  type("Last name", "Lovelace");
  press("Continue");

  await screen.findByText(
    "Another profile already uses this email. Sign out, then sign in the way you did originally.",
  );
  expect(navigate).not.toHaveBeenCalled();
});

test("a failed save can be retried", async () => {
  fetchMock.mockImplementationOnce(async () => json({}, 500));
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  type("First name", "Ada");
  type("Last name", "Lovelace");
  press("Continue");
  await screen.findByText("We could not save your profile. Try again.");

  press("Continue");
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a session that ended sends the person to sign in", async () => {
  fetchMock.mockImplementation(async () =>
    json({ error: { code: "unauthenticated" } }, 401),
  );
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  type("First name", "Ada");
  type("Last name", "Lovelace");
  press("Continue");

  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/sign-in\?next=/),
    ),
  );
});

test("while saving: progress shown and a second submit ignored", async () => {
  const saving = deferred<Response>();
  fetchMock.mockImplementation(() => saving.promise);
  renderPage(<ProfileSetupForm email="ada@example.com" defaults={blank} />);
  type("First name", "Ada");
  type("Last name", "Lovelace");
  press("Continue");

  const button = await screen.findByRole("button", { name: /Continue/ });
  await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
  press(/Continue/);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    saving.resolve(json(ada, 201));
  });
});

test("sign out ends the session, clears cached data and goes to the landing page", async () => {
  const { queryClient } = renderPage(
    <ProfileSetupForm email="ada@example.com" defaults={blank} />,
  );
  queryClient.setQueryData(["me"], ada);
  press("Sign out");

  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryData(["me"])).toBeUndefined();
});
