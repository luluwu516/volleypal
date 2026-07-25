"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Option {
  name: string;
  url: string;
}

interface Props {
  value: string; // raw "Name | URL\nName\n..." serialized form (what DB stores)
  onChange: (raw: string) => void;
  namePlaceholder?: string;
  urlPlaceholder?: string;
}

// DB stays as the same "Name | URL" multiline text so VenueOptionList and
// existing rows keep working. This component just gives the admin a
// structured two-field UI instead of forcing them to type the pipe syntax.
export function parseOptions(raw: string): Option[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split("|");
      return { name: name.trim(), url: rest.join("|").trim() };
    });
}

export function serializeOptions(options: Option[]): string {
  return options
    .map((o) => (o.url ? `${o.name} | ${o.url}` : o.name))
    .join("\n");
}

export function OptionListEditor({
  value,
  onChange,
  namePlaceholder = "名稱",
  urlPlaceholder = "https://…（選填）",
}: Props) {
  const [items, setItems] = useState<Option[]>(() => parseOptions(value));
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  function push(next: Option[]) {
    setItems(next);
    onChange(serializeOptions(next));
  }

  function add() {
    const name = draftName.trim();
    if (!name) return;
    push([...items, { name, url: draftUrl.trim() }]);
    setDraftName("");
    setDraftUrl("");
  }

  function remove(idx: number) {
    push(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-input divide-y divide-border/40">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1 flex flex-col">
                <span className="truncate">{it.name}</span>
                {it.url && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    {it.url}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 size-6 grid place-items-center rounded hover:bg-white/10 text-muted-foreground"
                aria-label={`移除 ${it.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border/60 p-2">
        <div className="flex gap-1.5">
          <Input
            placeholder={namePlaceholder}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div className="flex gap-1.5">
          <Input
            placeholder={urlPlaceholder}
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={!draftName.trim()}
          >
            加入
          </Button>
        </div>
      </div>
    </div>
  );
}
