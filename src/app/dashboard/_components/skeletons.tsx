import { Skeleton } from "@/components/ui/skeleton";

/*
 * Loading skeletons, one per screen shape. Shared by the screens (while their
 * data loads in the browser) and by each route's loading.tsx (while the page
 * loads on the server), so the two never differ. No hooks: server-safe.
 */

export function DeckSkeleton() {
  return (
    <output aria-label="Loading deck" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-24 nav:ml-auto" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid items-start gap-4 wide:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="aspect-video w-full rounded-box" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-64 rounded-panel" />
      </div>
    </output>
  );
}

export function LeadSkeleton() {
  return (
    <output aria-label="Loading lead" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 nav:grid-cols-[minmax(0,1fr)_300px] wide:grid-cols-[270px_minmax(0,1fr)_300px]">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-40 rounded-box" />
      </div>
    </output>
  );
}

export function BuilderSkeleton() {
  return (
    <output aria-label="Loading proposal" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 wide:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-panel" />
          <Skeleton className="h-64 rounded-panel" />
        </div>
        <Skeleton className="h-72 rounded-panel" />
      </div>
    </output>
  );
}

export function IntegrationsSkeleton() {
  return (
    <output
      aria-label="Loading Connections"
      className="flex w-full max-w-3xl flex-col gap-4"
    >
      <Skeleton className="h-96 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
      <Skeleton className="h-28 rounded-panel" />
    </output>
  );
}

export function WorkspaceSkeleton() {
  return (
    <output
      aria-label="Loading Workspace settings"
      className="flex w-full max-w-2xl flex-col gap-4"
    >
      <Skeleton className="h-36 rounded-panel" />
      <Skeleton className="h-64 rounded-panel" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 rounded-panel" />
    </output>
  );
}

export function ReviewSkeleton({ withQueue = false }: { withQueue?: boolean }) {
  const panel = (
    <output aria-label="Loading suspect" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-4 nav:grid-cols-2">
        <Skeleton className="h-64 rounded-panel" />
        <Skeleton className="h-48 rounded-box" />
      </div>
    </output>
  );
  if (!withQueue) return panel;
  return (
    <div className="grid items-start gap-4 wide:grid-cols-[270px_minmax(0,1fr)]">
      <div className="hidden flex-col gap-2 wide:flex">
        {["a", "b", "c", "d"].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
      {panel}
    </div>
  );
}

/** The title of a screen whose own header is not known yet. */
export function PageTitleSkeleton() {
  return <Skeleton className="h-8 w-56" />;
}
