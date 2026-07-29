"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";

interface MortalityReport {
  total: number;
  cullings: number;
  insuranceClaims: number;
  byCause: Record<string, number>;
  records: {
    id: string;
    date: string;
    cause: string;
    disposalMethod: string;
    isCulling: boolean;
    insuranceClaim: boolean;
    claimAmountTzs: number | null;
    animal: {
      id: string;
      eartag: string;
      breed: string;
      sex: string;
      camp: { name: string };
    };
    recordedBy: { name: string };
  }[];
}

export default function MortalityPage() {
  const t = useT();
  const [data, setData] = useState<MortalityReport | null>(null);

  useEffect(() => {
    fetch("/api/reports/mortality")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("mortalityTitle")}</h1>
        <p className="text-muted-foreground">{t("mortalitySubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Deaths</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.total ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cullings</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.cullings ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Insurance Claims</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.insuranceClaims ?? "—"}</p></CardContent>
        </Card>
      </div>

      {data && Object.keys(data.byCause).length > 0 && (
        <Card>
          <CardHeader><CardTitle>By Cause</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(data.byCause).map(([cause, count]) => (
              <Badge key={cause} variant="secondary">
                {cause.replace(/_/g, " ")}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Death Records</CardTitle></CardHeader>
        <CardContent>
          {!data?.records?.length ? (
            <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Animal</th>
                    <th className="p-3 text-left">Camp</th>
                    <th className="p-3 text-left">Cause</th>
                    <th className="p-3 text-left">Disposal</th>
                    <th className="p-3 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">{formatDate(r.date)}</td>
                      <td className="p-3">
                        <Link href={`/animals/${r.animal.id}`} className="text-primary hover:underline font-medium">
                          {r.animal.eartag}
                        </Link>
                        <p className="text-xs text-muted-foreground">{r.animal.breed} · {r.animal.sex}</p>
                      </td>
                      <td className="p-3">{r.animal.camp.name}</td>
                      <td className="p-3">{r.cause.replace(/_/g, " ")}</td>
                      <td className="p-3">{r.disposalMethod.replace(/_/g, " ")}</td>
                      <td className="p-3 space-x-1">
                        {r.isCulling && <Badge variant="warning">Cull</Badge>}
                        {r.insuranceClaim && <Badge variant="outline">Claim</Badge>}
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
