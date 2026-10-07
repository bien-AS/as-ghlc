import { isValidElement } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { fake, prismaModule, resetFakes, signIn } from "@/test/server-fakes";

import ProfileSetupPage from "./page";
import { ProfileSetupForm } from "./profile-setup-form";
import { SilentProfileSetup } from "./silent-profile-setup";

vi.mock(
  "@/lib/supabase/server",
  async () => (await import("@/test/server-fakes")).supabaseServerModule,
);
vi.mock(
  "@/lib/prisma",
  async () => (await import("@/test/server-fakes")).prismaModule,
);

beforeEach(resetFakes);
afterEach(() => {
  vi.restoreAllMocks();
});

const signUpNames = { dw_first_name: "Ada", dw_last_name: "Lovelace" };

test("rendering the page for a silent-path session writes nothing: no profile from a prefetch or a speculative render", async () => {
  const create = vi.spyOn(prismaModule.prisma.user, "create");
  signIn({ user_metadata: signUpNames });

  // Rendered twice, as a prefetch followed by the visit would.
  const first = await ProfileSetupPage();
  const second = await ProfileSetupPage();

  expect(create).not.toHaveBeenCalled();
  expect(fake.users.size).toBe(0);
  // What it returns is the "Setting up your account" state, which asks with POST.
  for (const element of [first, second]) {
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(SilentProfileSetup);
    expect(element.props).toEqual({
      email: "ada@example.com",
      defaults: { firstName: "Ada", lastName: "Lovelace" },
    });
  }
});

test("a Google session gets the form itself, prefilled, never the silent state", async () => {
  signIn({
    amr: [{ method: "oauth", timestamp: 1 }],
    user_metadata: { ...signUpNames, full_name: "Ada Lovelace" },
  });
  const element = await ProfileSetupPage();
  expect(element.type).toBe(ProfileSetupForm);
  expect(element.props.defaults).toEqual({
    firstName: "Ada",
    lastName: "Lovelace",
  });
  expect(fake.users.size).toBe(0);
});

test("an email session missing a name gets the form", async () => {
  signIn({ user_metadata: { dw_first_name: "Ada" } });
  const element = await ProfileSetupPage();
  expect(element.type).toBe(ProfileSetupForm);
});
