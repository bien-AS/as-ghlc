import { PageTitleSkeleton, WorkspaceSkeleton } from "../_components/skeletons";

/** Shown while the page loads on the server; the sidebar and navbar are already on screen (spec 04). */
export default function Loading() {
  return (
    <>
      <PageTitleSkeleton />
      <WorkspaceSkeleton />
    </>
  );
}
