import type { Metadata } from "next";

import { enforceRoute } from "@/lib/data/users";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Choose a new password · Dealwright",
};

export default async function UpdatePasswordPage() {
  await enforceRoute("/reset-password/update");
  return <UpdatePasswordForm />;
}
