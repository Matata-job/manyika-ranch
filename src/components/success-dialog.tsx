"use client";

import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Modal confirmation after a bulk/form success — dismiss clears the notice. */
export function SuccessDialog({
  open,
  title,
  message,
  onClose,
  closeLabel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-dialog-title"
        className="relative w-full max-w-md rounded-2xl border bg-background p-6 pt-8 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
          </div>
          <h2
            id="success-dialog-title"
            className="text-xl font-semibold tracking-tight"
          >
            {title}
          </h2>
          <div className="text-sm text-muted-foreground max-w-sm">{message}</div>
          <Button
            type="button"
            className="w-full mt-2 bg-foreground text-background hover:bg-foreground/90"
            onClick={onClose}
          >
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
