import type { Metadata } from "next";

import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { enforceRoute } from "@/lib/data/users";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account · Dealwright" };

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  await enforceRoute("/sign-up");
  const { next } = await searchParams;

  return (
    <SignUpForm
      next={safeRedirectTarget(Array.isArray(next) ? next[0] : next)}
    />
  );
}
