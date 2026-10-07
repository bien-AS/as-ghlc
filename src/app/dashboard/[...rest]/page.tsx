import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceholderPanel } from "@/components/ui/placeholder-panel";
import { enforceRoute } from "@/lib/data/users";

import { NAV_ITEMS } from "../navigation";

/*
 * Every dashboard address that no other route claims. The unbuilt screens in
 * the navigation table get the shared placeholder panel (spec 04, "Placeholder
 * convention"), so the five placeholder routes cannot diverge; anything else
 * is "page not found" inside the shell.
 */
const placeholderFor = (rest: string[]) => {
  const path = `/dashboard/${rest.join("/")}`;
  const item = NAV_ITEMS.find((entry) => entry.href === path);
  return item && !item.built ? item : undefined;
};

export async function generateMetadata({
  params,
}: PageProps<"/dashboard/[...rest]">): Promise<Metadata> {
  const item = placeholderFor((await params).rest);
  return { title: `${item?.label ?? "Page not found"} · Dealwright` };
}

export default async function PlaceholderPage({
  params,
}: PageProps<"/dashboard/[...rest]">) {
  const { rest } = await params;
  await enforceRoute(`/dashboard/${rest.join("/")}`);

  const item = placeholderFor(rest);
  if (!item) notFound();

  return (
    <PlaceholderPanel
      name={item.label}
      willDo={item.willDo}
      waitingOn={item.waitingOn}
    />
  );
}
