"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { useT } from "@/components/providers/locale-provider";
import { parseAnimalsList } from "@/lib/animals-api";
import { ArrowRightLeft } from "lucide-react";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";

interface Camp {
  id: string;
  name: string;
}

interface AnimalRow {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  status: string;
  camp: { id: string; name: string };
}

interface Movement {
  id: string;
  date: string;
  reason: string | null;
  animal: { id: string; eartag: string; breed?: string };
  fromCamp: { name: string };
  toCamp: { name: string };
  authorizedBy: { name: string };
}

export default function MovementsPage() {
  const t = useT();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const canMove = role ? hasPermission(role, "manageMovements") : false;

  const [camps, setCamps] = useState<Camp[]>([]);
  const [fromCampId, setFromCampId] = useState("");
  const [toCampId, setToCampId] = useState("");
  const [sex, setSex] = useState("all");
  const [search, setSearch] = useState("");
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<{
    moved: number;
    skipped: number;
    toCamp: string;
  } | null>(null);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyCamp, setHistoryCamp] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetch("/api/camps?for=movement")
      .then((r) => r.json())
      .then((d) => setCamps(Array.isArray(d) ? d : d.camps || []))
      .catch(() => {});
  }, []);

  const loadAnimals = useCallback(async (campId: string, nextSex: string) => {
    if (!campId) {
      setAnimals([]);
      setSelected(new Set());
      return;
    }
    setLoadingAnimals(true);
    const params = new URLSearchParams({
      camp: campId,
      limit: "5000",
      status: "ALL",
    });
    if (nextSex !== "all") params.set("sex", nextSex);
    const res = await fetch(`/api/animals?${params}`);
    const data = res.ok ? await res.json() : null;
    const list = parseAnimalsList<AnimalRow>(data)
      .filter((a) => a.status === "ACTIVE" || a.status === "QUARANTINE")
      .sort((a, b) => a.eartag.localeCompare(b.eartag));
    setAnimals(list);
    setSelected(new Set());
    setLoadingAnimals(false);
  }, []);

  useEffect(() => {
    if (fromCampId) loadAnimals(fromCampId, sex);
  }, [fromCampId, sex, loadAnimals]);

  const filteredAnimals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return animals;
    return animals.filter(
      (a) =>
        a.eartag.toLowerCase().includes(q) ||
        a.breed.toLowerCase().includes(q)
    );
  }, [animals, search]);

  const allSelected =
    filteredAnimals.length > 0 &&
    filteredAnimals.every((a) => selected.has(a.id));
  const someSelected =
    filteredAnimals.some((a) => selected.has(a.id)) && !allSelected;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const a of filteredAnimals) next.delete(a.id);
      } else {
        for (const a of filteredAnimals) next.add(a.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedInView = filteredAnimals.filter((a) => selected.has(a.id)).length;
  const selectedLabel = t("selectedOf", {
    selected: selected.size,
    total: animals.length,
  });

  const loadHistory = useCallback(
    async (pageOffset = 0) => {
      setLoadingHistory(true);
      const params = new URLSearchParams({
        limit: String(DEFAULT_PAGE_SIZE),
        offset: String(pageOffset),
      });
      if (historyCamp !== "all") params.set("camp", historyCamp);
      if (historyFrom) params.set("from", historyFrom);
      if (historyTo) params.set("to", historyTo);
      const res = await fetch(`/api/movements?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMovements(data);
          setHistoryTotal(data.length);
          setHistoryOffset(0);
        } else {
          setMovements(Array.isArray(data.movements) ? data.movements : []);
          setHistoryTotal(typeof data.total === "number" ? data.total : 0);
          setHistoryOffset(pageOffset);
        }
      } else {
        setMovements([]);
        setHistoryTotal(0);
      }
      setLoadingHistory(false);
    },
    [historyCamp, historyFrom, historyTo]
  );

  useEffect(() => {
    loadHistory(0);
  }, [loadHistory]);

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    if (!canMove) return;
    if (selected.size === 0) {
      alert(t("selectAtLeastOneAnimal"));
      return;
    }
    if (!toCampId) {
      alert(t("selectDestinationCamp"));
      return;
    }
    if (toCampId === fromCampId) {
      alert(t("destinationMustDiffer"));
      return;
    }
    if (
      !confirm(
        t("confirmBulkMove", {
          n: selected.size,
          camp: camps.find((c) => c.id === toCampId)?.name || "",
        })
      )
    ) {
      return;
    }

    setSaving(true);
    setResult(null);
    const res = await fetch("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animalIds: [...selected],
        toCampId,
        date: moveDate || undefined,
        reason: reason || undefined,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || t("bulkMoveFailed"));
      return;
    }

    const data = await res.json();
    setResult({
      moved: data.moved,
      skipped: data.skipped,
      toCamp: data.toCamp,
    });
    setReason("");
    setMoveDate("");
    await loadAnimals(fromCampId, sex);
    await loadHistory(0);
  }

  const destinationCamps = camps.filter((c) => c.id !== fromCampId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("movementsTitle")}</h1>
        <p className="text-muted-foreground">{t("movementsSubtitle")}</p>
      </div>

      <Tabs defaultValue="move" className="space-y-4">
        <TabsList>
          <TabsTrigger value="move">{t("moveAnimalsTab")}</TabsTrigger>
          <TabsTrigger value="history">{t("movementHistoryTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="move" className="space-y-4">
          {!canMove ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {t("onlyOwnerManagerMove")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={submitMove} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t("bulkMoveTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>{t("fromCamp")} *</Label>
                      <Select
                        value={fromCampId || undefined}
                        onValueChange={(v) => {
                          setFromCampId(v);
                          setToCampId("");
                          setResult(null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectCamp")} />
                        </SelectTrigger>
                        <SelectContent>
                          {camps.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("toCamp")} *</Label>
                      <Select
                        value={toCampId || undefined}
                        onValueChange={setToCampId}
                        disabled={!fromCampId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("moveToCamp")} />
                        </SelectTrigger>
                        <SelectContent>
                          {destinationCamps.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("sex")}</Label>
                      <Select value={sex} onValueChange={setSex}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("allSexes")}</SelectItem>
                          <SelectItem value="MALE">{t("male")}</SelectItem>
                          <SelectItem value="FEMALE">{t("female")}</SelectItem>
                          <SelectItem value="UNKNOWN">{t("unknownSex")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t("date")}</Label>
                      <Input
                        type="date"
                        value={moveDate}
                        onChange={(e) => setMoveDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("reason")}</Label>
                    <Textarea
                      placeholder={t("moveReasonPlaceholder")}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                  <CardTitle>{t("selectAnimalsToMove")}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{selectedLabel}</Badge>
                    {fromCampId && (
                      <Input
                        className="w-40 h-8"
                        placeholder={t("searchEartagBreed")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!fromCampId ? (
                    <p className="text-sm text-muted-foreground">
                      {t("pickSourceCampFirst")}
                    </p>
                  ) : loadingAnimals ? (
                    <p className="text-sm text-muted-foreground">{t("loading")}</p>
                  ) : filteredAnimals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("noAnimalsInCamp")}
                    </p>
                  ) : (
                    <div className="rounded-lg border max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                          <tr className="border-b text-left">
                            <th className="p-2 w-10">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = someSelected;
                                }}
                                onChange={toggleAll}
                                aria-label={t("selectAll")}
                              />
                            </th>
                            <th className="p-2">{t("eartag")}</th>
                            <th className="p-2">{t("breed")}</th>
                            <th className="p-2">{t("sex")}</th>
                            <th className="p-2">{t("status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAnimals.map((a) => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={selected.has(a.id)}
                                  onChange={() => toggleOne(a.id)}
                                />
                              </td>
                              <td className="p-2">
                                <Link
                                  href={`/animals/${a.id}`}
                                  className="text-primary hover:underline font-medium"
                                >
                                  {a.eartag}
                                </Link>
                              </td>
                              <td className="p-2">{a.breed}</td>
                              <td className="p-2">{a.sex}</td>
                              <td className="p-2">{a.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    selected.size === 0 ||
                    !fromCampId ||
                    !toCampId
                  }
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {saving
                    ? t("saving")
                    : t("moveNAnimals", { n: selected.size })}
                </Button>
                {selectedInView > 0 && selectedInView !== selected.size && (
                  <span className="text-xs text-muted-foreground">
                    {t("selectedInFilter", {
                      n: selectedInView,
                      total: selected.size,
                    })}
                  </span>
                )}
              </div>

              {result && (
                <Card>
                  <CardContent className="pt-6 text-sm">
                    <p>
                      {t("bulkMoveResult", {
                        moved: result.moved,
                        skipped: result.skipped,
                        camp: result.toCamp,
                      })}
                    </p>
                  </CardContent>
                </Card>
              )}
            </form>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>{t("camp")}</Label>
                  <Select value={historyCamp} onValueChange={setHistoryCamp}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allCamps")}</SelectItem>
                      {camps.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("dateFrom")}</Label>
                  <Input
                    type="date"
                    value={historyFrom}
                    onChange={(e) => setHistoryFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("dateTo")}</Label>
                  <Input
                    type="date"
                    value={historyTo}
                    onChange={(e) => setHistoryTo(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => loadHistory(0)}
                    disabled={loadingHistory}
                  >
                    {loadingHistory ? t("loading") : t("applyFilters")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {t("recentMovements")}
                {historyTotal > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    ({historyTotal})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMovements")}</p>
              ) : (
                <>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left">{t("date")}</th>
                        <th className="p-3 text-left">{t("animal")}</th>
                        <th className="p-3 text-left">{t("fromCamp")}</th>
                        <th className="p-3 text-left">{t("toCamp")}</th>
                        <th className="p-3 text-left">{t("reason")}</th>
                        <th className="p-3 text-left">{t("authorizedBy")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr key={m.id} className="border-b">
                          <td className="p-3">{formatDate(m.date)}</td>
                          <td className="p-3">
                            <Link
                              href={`/animals/${m.animal.id}`}
                              className="text-primary hover:underline"
                            >
                              {m.animal.eartag}
                            </Link>
                          </td>
                          <td className="p-3">{m.fromCamp.name}</td>
                          <td className="p-3">{m.toCamp.name}</td>
                          <td className="p-3 text-muted-foreground">
                            {m.reason || "—"}
                          </td>
                          <td className="p-3">{m.authorizedBy.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ListPagination
                  total={historyTotal}
                  limit={DEFAULT_PAGE_SIZE}
                  offset={historyOffset}
                  loading={loadingHistory}
                  onPrev={() =>
                    loadHistory(Math.max(0, historyOffset - DEFAULT_PAGE_SIZE))
                  }
                  onNext={() => loadHistory(historyOffset + DEFAULT_PAGE_SIZE)}
                />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
