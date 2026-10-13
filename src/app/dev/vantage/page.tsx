import { notFound } from "next/navigation";

import { VantageSpike } from "./spike";

/**
 * Development only: the Vantage kit's own components on this app's React 19
 * and Tailwind 4. It is the check that the kit's utility names in globals.css
 * still match the kit after an upgrade.
 */
export default function VantageSpikePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VantageSpike />;
}
