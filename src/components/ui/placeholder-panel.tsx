import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * A screen that is not built yet (spec 04, "Placeholder convention"): its
 * name, a "Not built yet" label, one sentence on what it will do and what it
 * is waiting on. It holds no controls and no sample content.
 */
function PlaceholderPanel({
  name,
  willDo,
  waitingOn,
  className,
}: {
  name: string;
  willDo: string;
  waitingOn: string[];
  className?: string;
}) {
  return (
    <section
      data-slot="placeholder-panel"
      className={cn(
        "flex max-w-2xl flex-col gap-5 rounded-panel bg-card p-6 text-card-foreground ring-1 ring-border",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-2">
        <h1 tabIndex={-1} className="text-2xl leading-tight outline-none">
          {name}
        </h1>
        <Badge>Not built yet</Badge>
        <p className="max-w-[65ch] text-pretty text-muted-foreground">
          {willDo}
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <h2 className="label-caps">Waiting on</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
          {waitingOn.map((item) => (
            <li key={item} className="text-pretty">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export { PlaceholderPanel };
