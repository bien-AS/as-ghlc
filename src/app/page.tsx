import { redirect } from "next/navigation";

// There is no public page: the app is internal. The proxy sends a signed-out
// visitor on to sign-in.
export default function RootPage() {
  redirect("/dashboard");
}
