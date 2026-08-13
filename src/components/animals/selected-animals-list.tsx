"use client";

import { useMemo } from "react";
import { useT } from "@/components/providers/locale-provider";
import type { PickerAnimal } from "@/components/animals/animal-activity-picker";

export function SelectedAnimalsList({
  selected,
  animalById,
}: {
  selected: Set<string>;
  animalById: Map<string, PickerAnimal>;
}) {
  const t = useT();
  const items = useMemo(
    () =>
      [...selected]
        .map((id) => animalById.get(id))
        .filter((a): a is PickerAnimal => !!a)
        .sort((a, b) => a.eartag.localeCompare(b.eartag, undefined, { numeric: true })),
    [selected, animalById]
  );
  const unknown = selected.size - items.length;

  if (selected.size === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {t("selectedAnimalsList", { n: selected.size })}
      </p>
      <div className="rounded-lg border max-h-48 overflow-y-auto divide-y text-sm">
        {items.map((a) => (
          <div
            key={a.id}
            className="px-3 py-1.5 flex justify-between gap-2"
          >
            <span className="font-medium">{a.eartag}</span>
            <span className="text-muted-foreground shrink-0">
              {a.camp?.name || "—"}
            </span>
          </div>
        ))}
        {unknown > 0 && (
          <p className="px-3 py-1.5 text-xs text-muted-foreground">
            {t("selectedAnimalsUnknown", { n: unknown })}
          </p>
        )}
      </div>
    </div>
  );
}
