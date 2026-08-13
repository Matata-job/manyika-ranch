"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/providers/locale-provider";
import {
  DISPOSAL_METHODS,
  disposalMethodKey,
  parseDisposalFormValue,
} from "@/lib/death-causes";
import { Plus } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string, meta: ReturnType<typeof parseDisposalFormValue>) => void;
  disabled?: boolean;
  id?: string;
};

export function DisposalMethodPicker({ value, onChange, disabled, id }: Props) {
  const t = useT();
  const [custom, setCustom] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/mortality/disposals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.custom) setCustom(d.custom);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function selectValue(v: string) {
    if (v === "__add_new__") {
      setAdding(true);
      return;
    }
    onChange(v, parseDisposalFormValue(v));
  }

  async function addDisposal() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const res = await fetch("/api/mortality/disposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      window.alert(err.error || t("addDisposalFailed"));
      return;
    }
    const data = await res.json();
    setCustom(data.custom || []);
    const formValue = `custom:${data.added}`;
    onChange(formValue, parseDisposalFormValue(formValue));
    setNewName("");
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("disposal")} *</Label>
      <Select value={value} onValueChange={selectValue} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t("disposal")} />
        </SelectTrigger>
        <SelectContent>
          {DISPOSAL_METHODS.filter((d) => d !== "OTHER").map((d) => (
            <SelectItem key={d} value={d}>
              {t(disposalMethodKey(d))}
            </SelectItem>
          ))}
          {custom.map((name) => (
            <SelectItem key={`custom:${name}`} value={`custom:${name}`}>
              {name}
            </SelectItem>
          ))}
          <SelectItem value="OTHER">{t("other")}</SelectItem>
          <SelectItem value="__add_new__">
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> {t("addNewDisposal")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2 rounded-md border p-3 bg-muted/30">
          <Input
            autoFocus
            placeholder={t("newDisposalPlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDisposal();
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={addDisposal}
              disabled={saving || !newName.trim()}
            >
              {saving ? t("saving") : t("add")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
