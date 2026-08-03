"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export type AnimalColumnId =
  | "eartag"
  | "breed"
  | "sex"
  | "type"
  | "status"
  | "camp"
  | "age";

export const ANIMAL_COLUMN_DEFS: {
  id: AnimalColumnId;
  labelKey:
    | "eartag"
    | "breed"
    | "sex"
    | "lifecycleType"
    | "status"
    | "camp"
    | "age";
  locked?: boolean;
}[] = [
  { id: "eartag", labelKey: "eartag", locked: true },
  { id: "breed", labelKey: "breed" },
  { id: "sex", labelKey: "sex" },
  { id: "type", labelKey: "lifecycleType" },
  { id: "status", labelKey: "status" },
  { id: "camp", labelKey: "camp" },
  { id: "age", labelKey: "age" },
];

const DEFAULT_VISIBLE: AnimalColumnId[] = [
  "eartag",
  "breed",
  "sex",
  "type",
  "status",
  "camp",
];

export function loadColumnPrefs(storageKey: string): AnimalColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id): id is AnimalColumnId =>
      ANIMAL_COLUMN_DEFS.some((d) => d.id === id)
    );
    if (!valid.includes("eartag")) valid.unshift("eartag");
    return valid.length ? valid : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

export function saveColumnPrefs(storageKey: string, cols: AnimalColumnId[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}

export function CustomizeColumnsPanel({
  open,
  onClose,
  storageKey,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  storageKey: string;
  value: AnimalColumnId[];
  onChange: (cols: AnimalColumnId[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ANIMAL_COLUMN_DEFS;
    return ANIMAL_COLUMN_DEFS.filter((d) =>
      t(d.labelKey).toLowerCase().includes(q)
    );
  }, [query, t]);

  if (!open) return null;

  function toggle(id: AnimalColumnId, locked?: boolean) {
    if (locked) return;
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function save() {
    const next = draft.includes("eartag") ? draft : (["eartag", ...draft] as AnimalColumnId[]);
    saveColumnPrefs(storageKey, next);
    onChange(next);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="customize-columns-title"
        className="w-full max-w-md rounded-xl border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="customize-columns-title" className="font-semibold">
            {t("customizeColumns")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label={t("cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
            {t("customizeColumnsHint")}
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("searchColumns")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("availableColumns")}
          </p>
          <ul className="max-h-56 overflow-y-auto divide-y rounded-md border">
            {filtered.map((col) => {
              const checked = draft.includes(col.id);
              return (
                <li key={col.id}>
                  <label
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm",
                      col.locked ? "opacity-70" : "cursor-pointer hover:bg-muted/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={col.locked}
                      onChange={() => toggle(col.id, col.locked)}
                    />
                    <span className="flex-1">{t(col.labelKey)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDraft(DEFAULT_VISIBLE)}
            >
              {t("reset")}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                setDraft(ANIMAL_COLUMN_DEFS.map((d) => d.id))
              }
            >
              {t("selectAll")}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDraft(["eartag"])}
            >
              {t("deselectAll")}
            </button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="button" size="sm" onClick={save}>
              {t("save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
