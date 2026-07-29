"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Upload, Download } from "lucide-react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

interface CampInventory {
  id: string;
  name: string;
  capacity: number | null;
  totalActive: number;
  bySex: Record<string, number>;
  byBreed: Record<string, number>;
}

interface DueVaccination {
  id: string;
  vaccineName: string;
  nextDue: string;
  animal: { id: string; eartag: string; camp: { name: string } };
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canViewSales = role ? hasPermission(role, "viewSales") : false;
  const canViewFinance = role ? hasPermission(role, "viewFinance") : false;
  const canViewBuyers = role ? hasPermission(role, "viewBuyers") : false;
  const canImport = role ? hasPermission(role, "importData") : false;

  const [inventory, setInventory] = useState<CampInventory[]>([]);
  const [due, setDue] = useState<DueVaccination[]>([]);
  const [importResults, setImportResults] = useState<{ eartag: string; success: boolean; error?: string }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/reports/camp-inventory").then((r) => r.json()).then(setInventory);
    fetch("/api/reports/vaccination-due").then((r) => r.json()).then(setDue);
  }, []);

  function downloadTemplate() {
    const csv = "eartag,breed,sex,campName,dob,ownerEmail,sireEartag,damEartag,colorMarkings,notes\nNEW-001,Boran,FEMALE,Camp Alpha,2024-01-15,,,,\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animal-import-template.csv";
    a.click();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ""; });
      return row;
    });

    const res = await fetch("/api/reports/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    if (res.ok) {
      const data = await res.json();
      setImportResults(data.results);
      fetch("/api/reports/camp-inventory").then((r) => r.json()).then(setInventory);
    }
  }

  return (
    
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Camp inventory, vaccination due
          {canImport && ", bulk import"}
          {canViewSales && (
            <>
              {" · "}
              <Link href="/sales" className="text-primary hover:underline">
                Sales report
              </Link>
            </>
          )}
          {canViewFinance && (
            <>
              {" · "}
              <Link href="/finance/pnl" className="text-primary hover:underline">
                P&amp;L
              </Link>
            </>
          )}
          {canViewBuyers && (
            <>
              {" · "}
              <Link href="/buyers" className="text-primary hover:underline">
                Buyers
              </Link>
            </>
          )}
          {" · "}
          <Link href="/mortality" className="text-primary hover:underline">
            Mortality report
          </Link>
          {" · "}
          <Link href="/events" className="text-primary hover:underline">
            Event timeline
          </Link>
        </p>
      </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Camp Inventory</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inventory.map((camp) => (
                  <div key={camp.id} className="border-b pb-3">
                    <div className="flex justify-between items-center">
                      <Link href={`/camps/${camp.id}`} className="font-medium text-primary hover:underline">{camp.name}</Link>
                      <Badge>{camp.totalActive} head</Badge>
                    </div>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>M: {camp.bySex.MALE || 0}</span>
                      <span>F: {camp.bySex.FEMALE || 0}</span>
                      {camp.capacity && <span>Cap: {camp.capacity}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(camp.byBreed).map(([breed, count]) => (
                        <Badge key={breed} variant="outline" className="text-xs">{breed}: {count}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Vaccination Due</CardTitle></CardHeader>
            <CardContent>
              {due.length === 0 ? (
                <p className="text-muted-foreground text-sm">All vaccinations up to date</p>
              ) : (
                <div className="space-y-2">
                  {due.map((v) => (
                    <div key={v.id} className="flex justify-between border-b pb-2">
                      <div>
                        <Link href={`/animals/${v.animal.id}`} className="font-medium text-primary hover:underline">
                          {v.animal.eartag}
                        </Link>
                        <p className="text-sm text-muted-foreground">{v.vaccineName} · {v.animal.camp.name}</p>
                      </div>
                      <span className="text-sm">{formatDate(v.nextDue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {canImport && (
        <Card>
          <CardHeader><CardTitle>Bulk Import (CSV)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import animals from CSV. Required columns: eartag, breed, sex, campName
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />Download Template
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Upload CSV
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </div>
            {importResults && (
              <div className="rounded-lg border p-4 space-y-1 max-h-60 overflow-y-auto">
                {importResults.map((r) => (
                  <p key={r.eartag} className={`text-sm ${r.success ? "text-green-600" : "text-destructive"}`}>
                    {r.eartag}: {r.success ? "Imported" : r.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    
  );
}
