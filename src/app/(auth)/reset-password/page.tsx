import type { Metadata } from "next";

import { enforceRoute } from "@/lib/data/users";

import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Reset your password · Dealwright" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  await enforceRoute("/reset-password");
  const { notice } = await searchParams;

  return (
    <ResetRequestForm notice={Array.isArray(notice) ? notice[0] : notice} />
  );
}
