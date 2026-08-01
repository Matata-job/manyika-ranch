"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";

interface Camp {
  id: string;
  name: string;
}

interface Medicine {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  expiry: string | null;
  camp: { id: string; name: string } | null;
}

export default function MedicineInventoryPage() {
  const t = useT();
  const [items, setItems] = useState<Medicine[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    quantity: "0",
    minQuantity: "10",
    unit: "doses",
    expiry: "",
    campId: "",
  });

  async function load() {
    const [medRes, campRes] = await Promise.all([
      fetch("/api/inventory/medicines"),
      fetch("/api/camps"),
    ]);
    if (medRes.ok) {
      const d = await medRes.json();
      setItems(Array.isArray(d) ? d : []);
    }
    if (campRes.ok) {
      const d = await campRes.json();
      const list = Array.isArray(d) ? d : d.camps || [];
      setCamps(list.map((c: Camp) => ({ id: c.id, name: c.name })));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMedicine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/inventory/medicines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        quantity: form.quantity,
        minQuantity: form.minQuantity,
        unit: form.unit,
        expiry: form.expiry || null,
        campId: form.campId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm({
        name: "",
        quantity: "0",
        minQuantity: "10",
        unit: "doses",
        expiry: "",
        campId: "",
      });
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("failedToSave"));
    }
  }

  async function updateQuantity(id: string, quantity: string) {
    const res = await fetch("/api/inventory/medicines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, quantity }),
    });
    if (res.ok) load();
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteMedicineConfirm"))) return;
    await fetch(`/api/inventory/medicines?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/health">← {t("navHealth")}</Link>
        </Button>
        <h1 className="text-3xl font-bold">{t("medicineInventoryTitle")}</h1>
        <p className="text-muted-foreground">{t("medicineInventorySubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("addMedicine")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addMedicine} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("name")}</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("quantity")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("minQuantity")}</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={form.minQuantity}
                onChange={(e) =>
                  setForm({ ...form, minQuantity: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t("unit")}</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("expiry")}</Label>
              <Input
                type="date"
                value={form.expiry}
                onChange={(e) => setForm({ ...form, expiry: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("navCamps")}</Label>
              <Select
                value={form.campId || "none"}
                onValueChange={(v) =>
                  setForm({ ...form, campId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("allCamps")}</SelectItem>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? t("saving") : t("addMedicine")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("medicineInventory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMedicines")}</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const low = item.quantity <= item.minQuantity;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        {low && <Badge variant="warning">{t("lowStock")}</Badge>}
                        {item.camp && (
                          <span className="text-sm text-muted-foreground">
                            {item.camp.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("minQuantity")}: {item.minQuantity} {item.unit}
                        {item.expiry
                          ? ` · ${t("expiry")}: ${formatDate(item.expiry)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-24"
                        type="number"
                        min={0}
                        step="any"
                        defaultValue={item.quantity}
                        onBlur={(e) => {
                          if (e.target.value !== String(item.quantity)) {
                            updateQuantity(item.id, e.target.value);
                          }
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {item.unit}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(item.id)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
