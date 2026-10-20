import type { Metadata } from "next";

import { AuthPanel } from "@/components/ui/auth-shell";
import { DENIED, type DeniedReason } from "@/lib/auth/routing";

import { DifferentAccountButton } from "../_components/different-account-button";

export const metadata: Metadata = {
  title: "No access · Authority Solutions",
};

/** Which of ADR-0008's checks failed, in plain words (spec 01 section 5). */
const REASONS: Record<DeniedReason, string> = {
  [DENIED.notCompany]:
    "This Google account is not an Authority Solutions address.",
  [DENIED.notProvisioned]:
    "Your account has not been set up yet. Ask Zachery or Mitchell to add you.",
  [DENIED.deactivated]: "Your access has been turned off.",
};

const isReason = (value: unknown): value is DeniedReason =>
  typeof value === "string" && Object.hasOwn(REASONS, value);

/**
 * Where every refusal lands: the callback (after signing out), and any page
 * reached by a session whose profile is missing or turned off. Shown to
 * anyone; it reads nothing but the reason code in the address.
 */
export default async function AccessDeniedPage({
  searchParams,
}: PageProps<"/access-denied">) {
  const { reason } = await searchParams;

  return (
    <AuthPanel
      title="You do not have access"
      description={
        isReason(reason)
          ? REASONS[reason]
          : "Sign in with your Authority Solutions Google account."
      }
    >
      <DifferentAccountButton />
    </AuthPanel>
  );
}
