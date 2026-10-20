import { websiteHref } from "@/lib/leads/website";

/**
 * A lead's website, opening the site in a new tab; plain text when it is not
 * an http(s) address. Shown without its scheme.
 */
function WebsiteLink({
  website,
  className,
}: {
  website: string;
  className?: string;
}) {
  const text = website.replace(/^https?:\/\//, "");
  const href = websiteHref(website);
  if (!href) return <span className="wrap-anywhere">{text}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export { WebsiteLink };
