"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { MortalitySetupPanel } from "@/components/animals/mortality-setup-panel";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

export default function MortalitySetupPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canManage = role ? hasPermission(role, "manageMortality") : false;

  return (
    <div className="space-y-6 max-w-3xl pb-8">
      <div>
        <Link
          href="/mortality/bulk"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("backToDeadAnimalRecord")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {t("manageMortalitySetup")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("mortalitySetupHelp")}</p>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <MortalitySetupPanel hideIntro />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
