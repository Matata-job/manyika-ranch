/** Round TZS to cents (2 dp) for allocation totals. */
export function roundTzs(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseOptionalNonNegative(
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  const n = parseFloat(String(value));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Valid amount (TZS) is required" };
  }
  return { ok: true, value: n };
}
