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
  markedForSale?: boolean;
  camp?: { id: string; name: string };
}

interface Buyer {
  id: string;
  name: string;
  phone: string | null;
}

function BulkSalePageContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const preferMarked = searchParams.get("markedForSale") === "1";
  const [camps, setCamps] = useState<Camp[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [campId, setCampId] = useState("");
  const [sex, setSex] = useState("all");
  const [onlyMarked, setOnlyMarked] = useState(preferMarked);
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
    setOnlyMarked(preferMarked);
  }, [preferMarked]);

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []));
    fetch("/api/buyers")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setBuyers(Array.isArray(d) ? d : d.buyers || []));
  }, []);

  async function loadAnimals(
    nextCampId: string,
    nextSex: string,
    markedOnly: boolean
  ) {
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      limit: "5000",
      status: "ACTIVE",
    });
    if (nextCampId) params.set("camp", nextCampId);
    if (nextSex !== "all") params.set("sex", nextSex);
    if (markedOnly) params.set("markedForSale", "true");
    const res = await fetch(`/api/animals?${params}`);
    const data = res.ok ? await res.json() : null;
    const list: AnimalRow[] = parseAnimalsList<AnimalRow>(data).filter(
      (a) =>
        a.status === "ACTIVE" ||
        a.status === "QUARANTINE" ||
        a.status === "MISSING"
    );
    setAnimals(list);
    if (markedOnly) {
      setSelected(new Set(list.map((a) => a.id)));
    } else {
      setSelected(new Set());
    }
    setLoadingAnimals(false);
  }

  useEffect(() => {
    if (onlyMarked || campId) {
      loadAnimals(campId, sex, onlyMarked);
    } else {
      setAnimals([]);
      setSelected(new Set());
    }
  }, [campId, sex, onlyMarked]);

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
    setSelected(new Set());
    if (onlyMarked || campId) loadAnimals(campId, sex, onlyMarked);
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">
              {t("bulkSaleResult", {
                n: result.sold,
                buyer: result.buyer,
                price: formatCurrency(result.pricePerAnimal),
              })}
              {result.skipped > 0 && (
                <> · {t("skippedInaccessible", { n: result.skipped })}</>
              )}
            </p>
          </CardContent>
        </Card>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                {t("camp")}
                {!onlyMarked ? " *" : ""}
              </Label>
              <Select
                value={campId || (onlyMarked ? "all" : undefined)}
                onValueChange={(v) => {
                  setCampId(v === "all" ? "" : v);
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCamp")} />
                </SelectTrigger>
                <SelectContent>
                  {onlyMarked && (
                    <SelectItem value="all">{t("allCamps")}</SelectItem>
                  )}
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          {!onlyMarked && !campId ? (
            <p className="text-sm text-muted-foreground">{t("selectCampLoad")}</p>
          ) : loadingAnimals ? (
            <p className="text-sm text-muted-foreground">{t("loadingAnimals")}</p>
          ) : animals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {onlyMarked ? t("noMarkedForSale") : t("noActiveAnimalsCamp")}
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
                    {a.markedForSale && (
                      <Badge variant="warning" className="ml-auto shrink-0">
                        {t("markedForSale")}
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
