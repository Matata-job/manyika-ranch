import type { InvoiceStatus } from "@prisma/client";

export function invoiceBalance(amountTzs: number, amountPaidTzs: number): number {
  return Math.max(0, Math.round((amountTzs - amountPaidTzs) * 100) / 100);
}

export function deriveInvoiceStatus(
  amountTzs: number,
  amountPaidTzs: number,
  current: InvoiceStatus
): InvoiceStatus {
  if (current === "VOID" || current === "DRAFT") return current;
  const paid = amountPaidTzs;
  if (paid <= 0) return "ISSUED";
  if (paid + 0.001 >= amountTzs) return "PAID";
  return "PARTIAL";
}

export function periodLabel(year: number, month: number, locale = "en"): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
