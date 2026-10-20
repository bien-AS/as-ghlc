import { cn } from "@/lib/utils";

/*
 * Model-written markdown as plain React: headings, bullet lists and
 * paragraphs. Never HTML: every string is rendered as text, so nothing in the
 * markdown can inject markup.
 * ponytail: no links, tables or nested lists, and **bold** markers are dropped;
 * add a markdown library when a brief needs more than this.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

const plain = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: plain(paragraph.join(" ")) });
    }
    paragraph = [];
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: plain(heading[2]),
      });
    } else if (item) {
      flush();
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(plain(item[1]));
      else blocks.push({ kind: "list", items: [plain(item[1])] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      data-slot="markdown"
      className={cn("flex max-w-[680px] flex-col gap-3 text-pretty", className)}
    >
      {parseMarkdown(source).map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "heading") {
          // Under the page's h1 and the tab's h2: a brief's headings start at h3.
          const Heading = block.level <= 2 ? "h3" : "h4";
          return (
            <Heading
              key={key}
              className={cn(
                "font-sans font-semibold tracking-normal text-ink",
                block.level <= 2 ? "mt-2 text-[15px]" : "text-small",
              )}
            >
              {block.text}
            </Heading>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
              {block.items.map((item, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static text in its given order
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={key}>{block.text}</p>;
      })}
    </div>
  );
}
