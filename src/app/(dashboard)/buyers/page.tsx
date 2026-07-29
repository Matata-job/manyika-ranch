"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Plus, Search } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";

interface BuyerRow {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  _count: { sales: number };
}

export default function BuyersPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageBuyers") : false;

  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", location: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (showInactive) params.set("active", "false");
    const res = await fetch(`/api/buyers?${params}`);
    if (res.ok) setBuyers(await res.json());
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  async function createBuyer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to create buyer");
      return;
    }
    setForm({ name: "", phone: "", location: "", notes: "" });
    setShowForm(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{t("buyersTitle")}</h1>
          <p className="text-muted-foreground">{t("buyersSubtitle")}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("addBuyer")}
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New buyer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBuyer} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2 sm:col-span-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+255 ..."
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Town / market"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={saving} className="sm:col-span-2">
                {saving ? "Saving..." : "Create buyer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, phone, location..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button variant="outline" onClick={load}>
          Search
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Include inactive
        </label>
      </div>

      <Card>
        <CardContent className="pt-6">
          {buyers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBuyers")}</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("name")}</th>
                    <th className="p-3 text-left">{t("phone")}</th>
                    <th className="p-3 text-left">{t("location")}</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-left">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="p-3">
                        <Link
                          href={`/buyers/${b.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {b.name}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{b.phone || "—"}</td>
                      <td className="p-3 text-muted-foreground">{b.location || "—"}</td>
                      <td className="p-3 text-right">{b._count.sales}</td>
                      <td className="p-3">
                        <Badge variant={b.isActive ? "success" : "secondary"}>
                          {b.isActive ? t("active") : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
