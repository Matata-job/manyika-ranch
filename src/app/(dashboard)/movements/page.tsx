"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";

interface Movement {
  id: string;
  date: string;
  reason: string | null;
  animal: { id: string; eartag: string };
  fromCamp: { name: string };
  toCamp: { name: string };
  authorizedBy: { name: string };
}

export default function MovementsPage() {
  const t = useT();
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    fetch("/api/movements").then((r) => r.json()).then(setMovements);
  }, []);

  return (
    
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("movementsTitle")}</h1>
          <p className="text-muted-foreground">{t("movementsSubtitle")}</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Movements</CardTitle></CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMovements")}</p>
            ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("date")}</th>
                    <th className="p-3 text-left">Animal</th>
                    <th className="p-3 text-left">{t("fromCamp")}</th>
                    <th className="p-3 text-left">{t("toCamp")}</th>
                    <th className="p-3 text-left">Authorized By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="p-3">{formatDate(m.date)}</td>
                      <td className="p-3">
                        <Link href={`/animals/${m.animal.id}`} className="text-primary hover:underline">
                          {m.animal.eartag}
                        </Link>
                      </td>
                      <td className="p-3">{m.fromCamp.name}</td>
                      <td className="p-3">{m.toCamp.name}</td>
                      <td className="p-3">{m.authorizedBy.name}</td>
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
