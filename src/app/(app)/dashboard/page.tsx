import type { Metadata } from "next";

import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import { enforceRoute } from "@/lib/data/users";

import { DASHBOARD_HREF } from "../navigation";

export const metadata: Metadata = { title: "Dashboard · Authority Solutions" };

/** The home screen, where sign-in lands. A placeholder until spec 07 builds it. */
export default async function DashboardPage() {
  await enforceRoute(DASHBOARD_HREF);
  return (
    <PlaceholderPanel
      name="Dashboard"
      willDo="Your home: funnel numbers, what needs your attention now, and recent activity."
      waitingOn={["Spec 07: leads, research and dashboard"]}
    />
  );
}
