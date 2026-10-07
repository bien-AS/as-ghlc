import type { Metadata } from "next";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { enforceRoute } from "@/lib/data/users";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Dealwright" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  await enforceRoute("/sign-in");
  const { next, notice } = await searchParams;

  return (
    <SignInForm next={safeRedirectTarget(first(next))} notice={first(notice)} />
  );
}
