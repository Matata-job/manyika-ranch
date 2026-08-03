"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeftRight,
  CircleDollarSign,
  ClipboardList,
  Contact,
  Dna,
  HeartPulse,
  Package,
  Plus,
  Skull,
  Activity,
  Layers,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import { hasPermission, type Permission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

type CategoryId =
  | "all"
  | "health"
  | "breeding"
  | "movement"
  | "sales"
  | "lifecycle";

type ActivityCard = {
  id: string;
  href: string;
  titleKey: TranslationKey;
  helpKey: TranslationKey;
  category: Exclude<CategoryId, "all">;
  categoryLabelKey: TranslationKey;
  icon: typeof HeartPulse;
  permission?: Permission;
  /** Show when any of these permissions match (OR). */
  anyPermission?: Permission[];
};

const CATEGORIES: { id: CategoryId; labelKey: TranslationKey }[] = [
  { id: "all", labelKey: "activityCatAll" },
  { id: "health", labelKey: "activityCatHealth" },
  { id: "breeding", labelKey: "activityCatBreeding" },
  { id: "movement", labelKey: "activityCatMovement" },
  { id: "sales", labelKey: "activityCatSales" },
  { id: "lifecycle", labelKey: "activityCatLifecycle" },
];

const CARDS: ActivityCard[] = [
  {
    id: "register",
    href: "/animals/new",
    titleKey: "activityRegisterAnimal",
    helpKey: "activityRegisterAnimalHelp",
    category: "lifecycle",
    categoryLabelKey: "activityCatLifecycle",
    icon: Plus,
    permission: "createAnimal",
  },
  {
    id: "breeding",
    href: "/breeding",
    titleKey: "activityBreeding",
    helpKey: "activityBreedingHelp",
    category: "breeding",
    categoryLabelKey: "activityCatBreeding",
    icon: Dna,
    permission: "manageBreeding",
  },
  {
    id: "health",
    href: "/health",
    titleKey: "activityHealth",
    helpKey: "activityHealthHelp",
    category: "health",
    categoryLabelKey: "activityCatHealth",
    icon: HeartPulse,
    permission: "manageHealth",
  },
  {
    id: "inventory",
    href: "/health/inventory",
    titleKey: "activityMedicine",
    helpKey: "activityMedicineHelp",
    category: "health",
    categoryLabelKey: "activityCatHealth",
    icon: Package,
    permission: "manageHealth",
  },
  {
    id: "movements",
    href: "/movements",
    titleKey: "activityMovement",
    helpKey: "activityMovementHelp",
    category: "movement",
    categoryLabelKey: "activityCatMovement",
    icon: ArrowLeftRight,
    permission: "manageMovements",
  },
  {
    id: "sales",
    href: "/sales",
    titleKey: "activitySale",
    helpKey: "activitySaleHelp",
    category: "sales",
    categoryLabelKey: "activityCatSales",
    icon: CircleDollarSign,
    permission: "viewSales",
  },
  {
    id: "bulk-sale",
    href: "/sales/bulk",
    titleKey: "activityBulkSale",
    helpKey: "activityBulkSaleHelp",
    category: "sales",
    categoryLabelKey: "activityCatSales",
    icon: Layers,
    permission: "manageSales",
  },
  {
    id: "buyers",
    href: "/buyers",
    titleKey: "activityBuyers",
    helpKey: "activityBuyersHelp",
    category: "sales",
    categoryLabelKey: "activityCatSales",
    icon: Contact,
    permission: "viewBuyers",
  },
  {
    id: "mortality",
    href: "/mortality",
    titleKey: "activityMortality",
    helpKey: "activityMortalityHelp",
    category: "sales",
    categoryLabelKey: "activityCatSales",
    icon: Skull,
    anyPermission: ["manageMortality", "viewReports"],
  },
  {
    id: "bulk-cull",
    href: "/mortality/bulk",
    titleKey: "activityBulkCull",
    helpKey: "activityBulkCullHelp",
    category: "sales",
    categoryLabelKey: "activityCatSales",
    icon: Skull,
    permission: "manageMortality",
  },
  {
    id: "events",
    href: "/events",
    titleKey: "activityEvents",
    helpKey: "activityEventsHelp",
    category: "lifecycle",
    categoryLabelKey: "activityCatLifecycle",
    icon: Activity,
  },
];

export default function ActivitiesPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const [category, setCategory] = useState<CategoryId>("all");

  const visible = useMemo(() => {
    return CARDS.filter((card) => {
      if (!role) return false;
      if (card.permission && !hasPermission(role, card.permission)) return false;
      if (
        card.anyPermission &&
        !card.anyPermission.some((p) => hasPermission(role, p))
      ) {
        return false;
      }
      if (category !== "all" && card.category !== category) return false;
      return true;
    });
  }, [role, category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            {t("activitiesTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {t("activitiesSubtitle")}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" />
          {t("activitiesHint")}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              "category-pill",
              category === c.id
                ? "category-pill-active"
                : "bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activitiesEmpty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.id} href={card.href} className="activity-card group block">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <h2 className="font-semibold group-hover:text-primary transition-colors">
                      {t(card.titleKey)}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {t(card.helpKey)}
                    </p>
                    <span className="inline-flex mt-2 rounded-md border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {t(card.categoryLabelKey)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
