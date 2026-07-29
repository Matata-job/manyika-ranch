"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Syringe } from "lucide-react";

interface Vaccine {
  id: string;
  name: string;
  intervalDays: number | null;
  description: string | null;
}

interface DueVaccination {
  id: string;
  vaccineName: string;
  nextDue: string;
  animal: { id: string; eartag: string; camp: { name: string } };
}

export default function HealthPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageHealth") : false;

  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [due, setDue] = useState<DueVaccination[]>([]);

  useEffect(() => {
    fetch("/api/health/vaccines").then((r) => r.json()).then(setVaccines);
    fetch("/api/reports/vaccination-due").then((r) => r.json()).then(setDue);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Health Management</h1>
          <p className="text-muted-foreground">
            Vaccinations, treatments, and health records
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/health/bulk-treatment">
              <Syringe className="h-4 w-4 mr-2" />
              Bulk treatment
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vaccinations Due (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {due.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vaccinations due</p>
          ) : (
            <div className="space-y-2">
              {due.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div>
                    <Link
                      href={`/animals/${v.animal.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {v.animal.eartag}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {v.vaccineName} · {v.animal.camp.name}
                    </p>
                  </div>
                  <Badge variant="warning">{formatDate(v.nextDue)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vaccine Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vaccines.map((v) => (
              <div key={v.id} className="rounded-lg border p-4">
                <h3 className="font-medium">{v.name}</h3>
                {v.intervalDays && (
                  <p className="text-sm text-muted-foreground">
                    Every {v.intervalDays} days
                  </p>
                )}
                {v.description && (
                  <p className="text-xs text-muted-foreground mt-1">{v.description}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
