import { cn } from "@/lib/utils";

/**
 * A titled panel on a dashboard screen: a `label-caps` heading over its
 * content, on `surface` with a 1px edge (the Flat Panel Rule). `actions` sit
 * on the heading's line, for a control that belongs to the whole panel.
 */
function PanelSection({
  title,
  actions,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <section
      data-slot="panel-section"
      className={cn(
        "flex flex-col gap-3 rounded-panel bg-card p-4 ring-1 ring-border",
        className,
      )}
      {...props}
    >
      {actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="label-caps">{title}</h2>
          {actions}
        </div>
      ) : (
        <h2 className="label-caps">{title}</h2>
      )}
      {children}
    </section>
  );
}

export { PanelSection };
