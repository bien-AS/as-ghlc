import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown in the main area while a screen's data is fetched on the server. The
 * sidebar and navbar are already on screen (spec 04, "Shell loading").
 */
export default function DashboardLoading() {
  return (
    <output aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col gap-2">
        {["a", "b", "c", "d", "e", "f"].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    </output>
  );
}
