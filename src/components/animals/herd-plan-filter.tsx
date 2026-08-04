"use client";

import { ChoicePills } from "@/components/choice-pills";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/providers/locale-provider";
import { herdPlanFilterOptions } from "@/lib/herd-plan";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: boolean;
};

export function HerdPlanFilter({ value, onChange, label = true }: Props) {
  const t = useT();
  return (
    <div className="space-y-2">
      {label && <Label>{t("herdPlan")}</Label>}
      <ChoicePills
        options={herdPlanFilterOptions(t)}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
