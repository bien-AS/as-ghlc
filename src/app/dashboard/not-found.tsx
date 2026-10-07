import { LinkButton } from "@/components/ui/link-button";
import { EmptyState } from "@/components/ui/state-panel";

import { PIPELINE_HREF } from "./navigation";

/** An unknown address under /dashboard, shown inside the shell (spec 04). */
export default function DashboardNotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="There is no screen at this address. It may have moved, or the link may be wrong."
      action={
        <LinkButton variant="primary" href={PIPELINE_HREF}>
          Go to the Pipeline
        </LinkButton>
      }
    />
  );
}
