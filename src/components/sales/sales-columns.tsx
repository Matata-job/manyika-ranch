"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/components/providers/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";

export type SalesColumnId =
  | "saleDate"
  | "animal"
  | "camp"
  | "breed"
  | "sex"
  | "buyer"
  | "price"
  | "weight"
  | "pricePerKg"
  | "transport"
  | "notes"
  | "owner"
  | "status"
  | "returnedAt"
  | "refund"
  | "actions";

type SalesColumnDef = {
  id: SalesColumnId;
  labelKey: TranslationKey;
  locked?: boolean;
};

export const SALES_COLUMN_DEFS: SalesColumnDef[] = [
  { id: "saleDate", labelKey: "saleDate", locked: true },
  { id: "animal", labelKey: "animal", locked: true },
  { id: "camp", labelKey: "camp" },
  { id: "breed", labelKey: "breed" },
  { id: "sex", labelKey: "sex" },
  { id: "buyer", labelKey: "buyer" },
  { id: "price", labelKey: "price" },
  { id: "weight", labelKey: "weight" },
  { id: "pricePerKg", labelKey: "pricePerKg" },
  { id: "transport", labelKey: "transport" },
  { id: "notes", labelKey: "notes" },
  { id: "owner", labelKey: "owner" },
  { id: "status", labelKey: "status" },
  { id: "returnedAt", labelKey: "returnDate" },
  { id: "refund", labelKey: "refundAmount" },
  { id: "actions", labelKey: "actions" },
];

export const DEFAULT_SALES_COLUMNS: SalesColumnId[] = [
  "saleDate",
  "animal",
  "camp",
  "buyer",
  "price",
  "weight",
  "pricePerKg",
  "status",
  "actions",
];

const STORAGE_KEY = "manyika.sales.records.columns";

export function loadSalesColumnPrefs(): SalesColumnId[] {
  if (typeof window === "undefined") return DEFAULT_SALES_COLUMNS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SALES_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id): id is SalesColumnId =>
      SALES_COLUMN_DEFS.some((d) => d.id === id)
    );
    for (const locked of ["saleDate", "animal"] as SalesColumnId[]) {
      if (!valid.includes(locked)) valid.unshift(locked);
    }
    return valid.length ? valid : DEFAULT_SALES_COLUMNS;
  } catch {
    return DEFAULT_SALES_COLUMNS;
  }
}

export function saveSalesColumnPrefs(cols: SalesColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}

export function SalesCustomizeColumnsPanel({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: SalesColumnId[];
  onChange: (cols: SalesColumnId[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SALES_COLUMN_DEFS;
    return SALES_COLUMN_DEFS.filter((d) =>
      t(d.labelKey).toLowerCase().includes(q)
    );
  }, [query, t]);

  if (!open) return null;

  function toggle(id: SalesColumnId, locked?: boolean) {
    if (locked) return;
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function save() {
    let next = [...draft];
    for (const locked of ["saleDate", "animal"] as SalesColumnId[]) {
      if (!next.includes(locked)) next = [locked, ...next];
    }
    saveSalesColumnPrefs(next);
    onChange(next);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="sales-customize-columns-title"
        className="w-full max-w-md rounded-xl border bg-background shadow-lg"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="sales-customize-columns-title" className="font-semibold">
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
            {t("salesCustomizeColumnsHint")}
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
                      col.locked
                        ? "opacity-70"
                        : "cursor-pointer hover:bg-muted/40"
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
              onClick={() => setDraft(DEFAULT_SALES_COLUMNS)}
            >
              {t("reset")}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDraft(SALES_COLUMN_DEFS.map((d) => d.id))}
            >
              {t("selectAll")}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDraft(["saleDate", "animal"])}
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
