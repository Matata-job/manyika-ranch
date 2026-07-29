"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatCurrency } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { ArrowLeft, Save } from "lucide-react";

interface BuyerDetail {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  totalSpent: number;
  sales: {
    id: string;
    saleDate: string;
    priceTzs: number;
    weightAtSale: number | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      camp: { name: string };
    };
  }[];
}

export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageBuyers") : false;

  const [buyer, setBuyer] = useState<BuyerDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    location: "",
    notes: "",
  });

  async function load() {
    const res = await fetch(`/api/buyers/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBuyer(data);
      setForm({
        name: data.name || "",
        phone: data.phone || "",
        location: data.location || "",
        notes: data.notes || "",
      });
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/buyers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save");
      return;
    }
    setEditing(false);
    load();
  }

  async function toggleActive() {
    if (!buyer) return;
    const res = await fetch(`/api/buyers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !buyer.isActive }),
    });
    if (res.ok) load();
  }

  if (!buyer) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/buyers"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to buyers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">{buyer.name}</h1>
            <Badge variant={buyer.isActive ? "success" : "secondary"}>
              {buyer.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {buyer.sales.length} purchase{buyer.sales.length === 1 ? "" : "s"} ·{" "}
            {formatCurrency(buyer.totalSpent)} total
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={toggleActive}>
              {buyer.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{buyer.phone || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Location</span>
                <p className="font-medium">{buyer.location || "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Notes</span>
                <p className="font-medium">{buyer.notes || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          {buyer.sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchases yet</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Animal</th>
                    <th className="p-3 text-left">Camp</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {buyer.sales.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-3">{formatDate(s.saleDate)}</td>
                      <td className="p-3">
                        <Link
                          href={`/animals/${s.animal.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {s.animal.eartag}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {s.animal.breed} · {s.animal.sex}
                        </p>
                      </td>
                      <td className="p-3">{s.animal.camp.name}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(s.priceTzs)}
                      </td>
                      <td className="p-3 text-right">
                        {s.weightAtSale != null ? `${s.weightAtSale} kg` : "—"}
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
