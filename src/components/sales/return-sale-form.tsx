"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers/locale-provider";
import { formatCurrency } from "@/lib/utils";

type CampOption = { id: string; name: string };

type Props = {
  saleId: string;
  eartag: string;
  buyer: string;
  priceTzs: number;
  defaultCampId?: string | null;
  camps?: CampOption[];
  onDone: () => void;
  onCancel: () => void;
};

export function ReturnSaleForm({
  saleId,
  eartag,
  buyer,
  priceTzs,
  defaultCampId,
  camps: campsProp,
  onDone,
  onCancel,
}: Props) {
  const t = useT();
  const [camps, setCamps] = useState<CampOption[]>(campsProp || []);
  const [campId, setCampId] = useState(defaultCampId || "");
  const [reason, setReason] = useState("");
  const [returnedAt, setReturnedAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [refundedTzs, setRefundedTzs] = useState(String(priceTzs));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (campsProp?.length) {
      setCamps(campsProp);
      return;
    }
    fetch("/api/camps")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d : d.camps || [];
        setCamps(list);
        if (!campId && defaultCampId) setCampId(defaultCampId);
        else if (!campId && list[0]?.id) setCampId(list[0].id);
      })
      .catch(() => {});
  }, [campsProp, defaultCampId, campId]);

  useEffect(() => {
    if (defaultCampId) setCampId(defaultCampId);
  }, [defaultCampId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      window.alert(t("returnSaleReasonRequired"));
      return;
    }
    if (!campId) {
      window.alert(t("returnSaleCampRequired"));
      return;
    }
    if (
      !window.confirm(
        t("confirmReturnSale", {
          eartag,
          buyer,
          amount: formatCurrency(parseFloat(refundedTzs) || priceTzs),
        })
      )
    ) {
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/sales/${saleId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: reason.trim(),
        campId,
        returnedAt: returnedAt || undefined,
        refundedTzs: refundedTzs || priceTzs,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("returnSaleFailed"));
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border bg-muted/20 p-4 max-w-lg"
    >
      <div>
        <p className="font-medium">{t("returnSaleTitle")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("returnSaleHelp", { eartag, buyer })}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t("returnSaleReason")} *</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={t("returnSaleReasonPlaceholder")}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("returnToCamp")} *</Label>
          <Select value={campId || undefined} onValueChange={setCampId}>
            <SelectTrigger>
              <SelectValue placeholder={t("camp")} />
            </SelectTrigger>
            <SelectContent>
              {camps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("returnDate")}</Label>
          <Input
            type="date"
            value={returnedAt}
            onChange={(e) => setReturnedAt(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t("refundAmount")}</Label>
          <Input
            type="number"
            min={0}
            value={refundedTzs}
            onChange={(e) => setRefundedTzs(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("confirmReturnSaleButton")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
