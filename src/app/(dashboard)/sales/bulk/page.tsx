"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { parseAnimalsList } from "@/lib/animals-api";
import { formatCurrency } from "@/lib/utils";
import { SuccessDialog } from "@/components/success-dialog";

interface Camp {
  id: string;
  name: string;
}

interface AnimalRow {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  herdPlan?: "EXCLUDED" | "KEEP_BREEDING" | "SELL_NEXT_CYCLE";
  herdPlanNote?: string | null;
  camp?: { id: string; name: string };
}

interface Buyer {
  id: string;
  name: string;
  phone: string | null;
}

const MAX_SALE_CAMPS = 5;

function BulkSalePageContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const preferSellNext =
    searchParams.get("herdPlan") === "SELL_NEXT_CYCLE" ||
    searchParams.get("markedForSale") === "1";
  const [camps, setCamps] = useState<Camp[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [campIds, setCampIds] = useState<string[]>([]);
  const [sex, setSex] = useState("all");
  const [onlyMarked, setOnlyMarked] = useState(preferSellNext);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [buyerMode, setBuyerMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    buyerId: "",
    buyer: "",
    buyerPhone: "",
    buyerLocation: "",
    priceMode: "per_animal" as "per_animal" | "total_split",
    priceTzs: "",
    weightAtSale: "",
    saleDate: "",
    transport: "",
    notes: "",
  });
  const [result, setResult] = useState<{
    sold: number;
    skipped: number;
    pricePerAnimal: number;
    buyer: string;
  } | null>(null);

  useEffect(() => {
    setOnlyMarked(preferSellNext);
  }, [preferSellNext]);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []));
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuyers(Array.isArray(d) ? d : d.buyers || []));
  }, []);

  function toggleCamp(id: string) {
    setCampIds((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= MAX_SALE_CAMPS) {
        window.alert(t("bulkSaleMaxCamps", { n: MAX_SALE_CAMPS }));
        return prev;
      }
      return [...prev, id];
    });
    setResult(null);
  }

  async function loadAnimals(
    nextCampIds: string[],
    nextSex: string,
    markedOnly: boolean,
    autoSelectAll = true
  ) {
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      limit: "5000",
      status: "ACTIVE",
    });
    if (nextSex !== "all") params.set("sex", nextSex);
    if (markedOnly) params.set("herdPlan", "SELL_NEXT_CYCLE");

    let list: AnimalRow[] = [];

    if (markedOnly && nextCampIds.length === 0) {
      const res = await fetch(`/api/animals?${params}`);
      const data = res.ok ? await res.json() : null;
      list = parseAnimalsList<AnimalRow>(data);
    } else {
      const results = await Promise.all(
        nextCampIds.map(async (campId) => {
          const campParams = new URLSearchParams(params);
          campParams.set("camp", campId);
          const res = await fetch(`/api/animals?${campParams}`);
          const data = res.ok ? await res.json() : null;
          return parseAnimalsList<AnimalRow>(data);
        })
      );
      const byId = new Map<string, AnimalRow>();
      for (const rows of results) {
        for (const row of rows) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
      }
      list = [...byId.values()].sort((a, b) =>
        a.eartag.localeCompare(b.eartag, undefined, { numeric: true })
      );
    }

    list = list.filter(
      (a) =>
        a.status === "ACTIVE" ||
        a.status === "QUARANTINE" ||
        a.status === "MISSING"
    );
    setAnimals(list);
    setSelected(
      autoSelectAll && markedOnly
        ? new Set(list.map((a) => a.id))
        : new Set()
    );
    setLoadingAnimals(false);
  }

  useEffect(() => {
    if (onlyMarked || campIds.length > 0) {
      loadAnimals(campIds, sex, onlyMarked);
    } else {
      setAnimals([]);
      setSelected(new Set());
    }
  }, [campIds, sex, onlyMarked]);

  const allSelected = animals.length > 0 && selected.size === animals.length;
  const someSelected = selected.size > 0 && selected.size < animals.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(animals.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedLabel = useMemo(
    () => t("selectedOf", { selected: selected.size, total: animals.length }),
    [selected.size, animals.length, t]
  );

  const previewPrice = useMemo(() => {
    const n = selected.size;
    const price = parseFloat(form.priceTzs);
    if (!n || !Number.isFinite(price) || price < 0) return null;
    if (form.priceMode === "total_split") {
      return Math.round((price / n) * 100) / 100;
    }
    return price;
  }, [form.priceMode, form.priceTzs, selected.size]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      window.alert(t("selectAtLeastOneAnimal"));
      return;
    }
    if (buyerMode === "existing" && !form.buyerId) {
      window.alert(t("buyerRequired"));
      return;
    }
    if (buyerMode === "new" && !form.buyer.trim()) {
      window.alert(t("buyerRequired"));
      return;
    }
    if (!form.priceTzs || !Number.isFinite(parseFloat(form.priceTzs))) {
      window.alert(t("priceRequired"));
      return;
    }
    if (
      !window.confirm(
        t("confirmBulkSale", {
          n: selected.size,
          buyer:
            buyerMode === "existing"
              ? buyers.find((b) => b.id === form.buyerId)?.name || ""
              : form.buyer.trim(),
        })
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/sales/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        buyerId: buyerMode === "existing" ? form.buyerId : null,
        buyer: buyerMode === "new" ? form.buyer.trim() : undefined,
        createBuyer: buyerMode === "new",
        buyerPhone: form.buyerPhone || null,
        buyerLocation: form.buyerLocation || null,
        priceMode: form.priceMode,
        priceTzs: form.priceTzs,
        weightAtSale: form.weightAtSale || null,
        saleDate: form.saleDate || undefined,
        transport: form.transport || null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("bulkSaleFailed"));
      return;
    }

    const data = await res.json();
    setResult({
      sold: data.sold,
      skipped: data.skipped,
      pricePerAnimal: data.pricePerAnimal,
      buyer: data.buyer,
    });
    setForm({
      buyerId: "",
      buyer: "",
      buyerPhone: "",
      buyerLocation: "",
      priceMode: "per_animal",
      priceTzs: "",
      weightAtSale: "",
      saleDate: "",
      transport: "",
      notes: "",
    });
    setBuyerMode("existing");
    setShowExtras(false);
    setSelected(new Set());
    loadAnimals(campIds, sex, onlyMarked, false);
    if (buyerMode === "new") {
      fetch("/api/buyers")
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setBuyers(Array.isArray(d) ? d : d.buyers || []));
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/sales"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToSales")}
        </Link>
        <h1 className="text-3xl font-bold">{t("bulkSaleTitle")}</h1>
        <p className="text-muted-foreground">{t("bulkSaleSubtitle")}</p>
      </div>

      {result && (
        <SuccessDialog
          open
          title={t("bulkSaleSuccessTitle")}
          message={
            <>
              {t("bulkSaleResult", {
                n: result.sold,
                buyer: result.buyer,
                price: formatCurrency(result.pricePerAnimal),
              })}
              {result.skipped > 0 && (
                <> · {t("skippedInaccessible", { n: result.skipped })}</>
              )}
            </>
          }
          closeLabel={t("ok")}
          onClose={() => setResult(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("chooseAnimals")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={onlyMarked}
              onChange={(e) => {
                setOnlyMarked(e.target.checked);
                setResult(null);
              }}
            />
            {t("onlyMarkedForSale")}
          </label>
          <div className="space-y-2">
            <Label>
              {t("camp")}
              {!onlyMarked ? " *" : ""}
            </Label>
            <p className="text-xs text-muted-foreground">
              {onlyMarked
                ? t("optionalCampsOrAll", { n: MAX_SALE_CAMPS })
                : t("selectCampsUpTo", { n: MAX_SALE_CAMPS })}
              {!onlyMarked && campIds.length > 0 && (
                <> · {campIds.length}/{MAX_SALE_CAMPS}</>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {camps.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCamp(c.id)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    campIds.includes(c.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("sexFilter")}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="MALE">{t("male")}</SelectItem>
                <SelectItem value="FEMALE">{t("female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!onlyMarked && campIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("selectCampLoad")}</p>
          ) : loadingAnimals ? (
            <p className="text-sm text-muted-foreground">{t("loadingAnimals")}</p>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {onlyMarked ? t("noMarkedForSale") : t("noActiveAnimalsInCamps")}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                  />
                  {t("selectAll")}
                </label>
                <Badge variant="secondary">{selectedLabel}</Badge>
              </div>
              <div className="rounded-lg border max-h-72 overflow-y-auto divide-y">
                {animals.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                    <span className="font-medium">{a.eartag}</span>
                    <span className="text-muted-foreground">
                      {a.breed} · {a.sex}
                      {a.camp?.name ? ` · ${a.camp.name}` : ""}
                    </span>
                    {a.herdPlan === "SELL_NEXT_CYCLE" && (
                      <Badge variant="warning" className="ml-auto shrink-0">
                        {t("herdPlanSellNextCycle")}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("saleDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("buyer")} *</Label>
              <Select
                value={buyerMode}
                onValueChange={(v) => setBuyerMode(v as "existing" | "new")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">{t("existingBuyer")}</SelectItem>
                  <SelectItem value="new">{t("newBuyer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {buyerMode === "existing" ? (
              <div className="space-y-2">
                <Select
                  value={form.buyerId || undefined}
                  onValueChange={(v) => setForm({ ...form, buyerId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectBuyer")} />
                  </SelectTrigger>
                  <SelectContent>
                    {buyers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.phone ? ` · ${b.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>{t("name")} *</Label>
                  <Input
                    value={form.buyer}
                    onChange={(e) =>
                      setForm({ ...form, buyer: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("phone")}</Label>
                  <Input
                    value={form.buyerPhone}
                    onChange={(e) =>
                      setForm({ ...form, buyerPhone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("location")}</Label>
                  <Input
                    value={form.buyerLocation}
                    onChange={(e) =>
                      setForm({ ...form, buyerLocation: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("priceMode")} *</Label>
                <Select
                  value={form.priceMode}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      priceMode: v as "per_animal" | "total_split",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_animal">
                      {t("pricePerAnimal")}
                    </SelectItem>
                    <SelectItem value="total_split">
                      {t("priceTotalSplit")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("price")} (TZS) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.priceTzs}
                  onChange={(e) =>
                    setForm({ ...form, priceTzs: e.target.value })
                  }
                />
                {previewPrice != null && selected.size > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("priceEachPreview", {
                      price: formatCurrency(previewPrice),
                      n: selected.size,
                    })}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("saleDate")}</Label>
                <Input
                  type="date"
                  value={form.saleDate}
                  onChange={(e) =>
                    setForm({ ...form, saleDate: e.target.value })
                  }
                />
              </div>
            </div>

            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setShowExtras((v) => !v)}
            >
              {showExtras ? t("hideSaleExtras") : t("showSaleExtras")}
            </button>

            {showExtras && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("weightKgOptional")}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.weightAtSale}
                    onChange={(e) =>
                      setForm({ ...form, weightAtSale: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("transport")}</Label>
                  <Input
                    value={form.transport}
                    onChange={(e) =>
                      setForm({ ...form, transport: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <Button type="submit" disabled={saving || selected.size === 0}>
              {saving ? t("saving") : t("recordBulkSale")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BulkSalePage() {
  const t = useT();
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">{t("loading")}</p>}
    >
      <BulkSalePageContent />
    </Suspense>
  );
}
