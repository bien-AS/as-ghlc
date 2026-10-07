import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { enforceRoute, silentProfileNames } from "@/lib/data/users";

import { ProfileSetupForm } from "./profile-setup-form";
import { SilentProfileSetup } from "./silent-profile-setup";

export const metadata: Metadata = { title: "Set up your profile · Dealwright" };

/*
 * This page only reads. It never writes to the database while rendering
 * (Next.js data-security guide, "Avoiding side-effects during rendering"), and
 * it has no loading.tsx on purpose: with one, a redirect from here would be
 * sent inside an already-started 200 response and carried out by the browser,
 * which leaves the document empty until the next page arrives. Without one,
 * the redirects below are plain HTTP redirects.
 */
export default async function ProfileSetupPage() {
  const current = await enforceRoute("/profile-setup");
  // enforceRoute has redirected every other state away.
  if (current.status !== "no-profile") redirect("/sign-in");

  const form = {
    email: current.identity.email,
    defaults: current.identity.suggestedNames,
  };

  // The silent path (spec 02). `silentProfileNames` is the one rule: here it
  // chooses what to show, and POST /api/profile/silent applies it again to the
  // session before writing. The return routes never create profiles.
  return silentProfileNames(current.identity) ? (
    <SilentProfileSetup {...form} />
  ) : (
    <ProfileSetupForm {...form} />
  );
}
