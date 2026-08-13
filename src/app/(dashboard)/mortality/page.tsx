"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";
import { deathCauseKey, disposalMethodKey, SYSTEM_DEATH_CAUSES } from "@/lib/death-causes";
import type { TranslationKey } from "@/lib/i18n/translations";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

interface MortalityReport {
  total: number;
  deaths: number;
  cullings: number;
  insuranceClaims: number;
  byCause: Record<string, number>;
  records: {
    id: string;
    date: string;
    cause: string;
    causeDetail: string | null;
    disposalMethod: string;
    disposalNotes: string | null;
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

function causeGroupLabel(
  key: string,
  t: (key: TranslationKey) => string
): string {
  if ((SYSTEM_DEATH_CAUSES as readonly string[]).includes(key)) {
    return t(deathCauseKey(key));
  }
  return key;
}

function disposalLabel(
  method: string,
  notes: string | null,
  t: (key: TranslationKey) => string
): string {
  if (method === "OTHER" && notes?.trim()) return notes.trim();
  return t(disposalMethodKey(method));
}

export default function MortalityPage() {
  const t = useT();
  const { data: session } = useSession();
  const canManageMortality = session?.user?.role
    ? hasPermission(session.user.role as Role, "manageMortality")
    : false;
  const [data, setData] = useState<MortalityReport | null>(null);

  useEffect(() => {
    fetch("/api/reports/mortality")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("mortalityTitle")}</h1>
          <p className="text-muted-foreground">{t("mortalitySubtitle")}</p>
        </div>
        {canManageMortality && (
          <Button asChild>
            <Link href="/mortality/bulk">{t("bulkMortality")}</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("mortalityDeaths")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.deaths ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("mortalitySlaughters")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.cullings ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("insuranceClaim")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.insuranceClaims ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      {data && Object.keys(data.byCause).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("byCause")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(data.byCause).map(([cause, count]) => (
              <Badge key={cause} variant="secondary">
                {causeGroupLabel(cause, t)}: {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle>{t("mortalityTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.records?.length ? (
            <p className="text-sm text-muted-foreground">{t("noMortality")}</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">{t("date")}</th>
                    <th className="p-3 text-left">{t("animal")}</th>
                    <th className="p-3 text-left">{t("camp")}</th>
                    <th className="p-3 text-left">{t("mortalityKind")}</th>
                    <th className="p-3 text-left">{t("cause")}</th>
                    <th className="p-3 text-left">{t("disposal")}</th>
                    <th className="p-3 text-left">{t("insuranceClaim")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">{formatDate(r.date)}</td>
                      <td className="p-3">
                        <Link
                          href={`/animals/${r.animal.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {r.animal.eartag}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.animal.breed} · {r.animal.sex}
                        </p>
                      </td>
                      <td className="p-3">{r.animal.camp.name}</td>
                      <td className="p-3">
                        <Badge variant={r.isCulling ? "warning" : "secondary"}>
                          {r.isCulling
                            ? t("recordKindSlaughter")
                            : t("recordKindDeath")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {causeGroupLabel(
                          r.cause === "OTHER" && r.causeDetail
                            ? r.causeDetail
                            : r.cause,
                          t
                        )}
                      </td>
                      <td className="p-3">
                        {disposalLabel(r.disposalMethod, r.disposalNotes, t)}
                      </td>
                      <td className="p-3 space-x-1">
                        {r.insuranceClaim && (
                          <Badge variant="outline">{t("insuranceClaim")}</Badge>
                        )}
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
