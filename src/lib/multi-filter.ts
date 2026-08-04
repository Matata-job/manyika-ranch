/** Parse comma-separated filter query values (empty / "all" → []). */
export function parseMultiParam(raw: string | null | undefined): string[] {
  if (!raw || raw === "all") return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export function joinMultiParam(values: string[]): string | null {
  return values.length > 0 ? values.join(",") : null;
}

export function toggleMultiValue(values: string[], id: string): string[] {
  return values.includes(id)
    ? values.filter((v) => v !== id)
    : [...values, id];
}
