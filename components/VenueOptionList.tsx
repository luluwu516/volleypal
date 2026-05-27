import { ExternalLink } from "lucide-react";

/**
 * Parse a multiline option block. Each line is one item.
 * Format per line:  Name
 *              or:  Name | https://url
 */
function parse(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split("|");
      const url = rest.join("|").trim();
      return { name: name.trim(), url: url || null };
    });
}

export function VenueOptionList({ raw }: { raw: string | null | undefined }) {
  if (!raw?.trim()) {
    return <p className="text-sm text-muted-foreground">尚未提供</p>;
  }
  const items = parse(raw);
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">尚未提供</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <li
          key={i}
          className="flex items-center justify-between text-sm gap-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="size-1.5 rounded-full bg-purple-400/70 shrink-0" />
            <span className="truncate">{it.name}</span>
          </span>
          {it.url && (
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 hover:text-purple-200 inline-flex items-center shrink-0"
              aria-label={`Open ${it.name}`}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
