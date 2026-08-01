"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { useT } from "@/components/providers/locale-provider";
import {
  DEFAULT_PAGE_SIZE,
  ListPagination,
} from "@/components/list-pagination";

interface RanchEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
  animal: { id: string; eartag: string; camp: { name: string } };
  recordedBy: { name: string } | null;
}

const EVENT_TYPES = [
  "DEATH",
  "CULLING",
  "SALE",
  "MOVEMENT",
  "TREATMENT",
  "VACCINATION",
  "WEIGHT",
  "HEALTH",
  "BREEDING",
  "CALVING",
  "CASTRATION",
  "NOTE",
  "STATUS_CHANGE",
  "REGISTERED",
  "QUARANTINE",
  "OWNERSHIP_TRANSFER",
] as const;

function monthOptions(count = 24): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    opts.push({ value, label });
  }
  return opts;
}

export default function EventsPage() {
  const t = useT();
  const months = useMemo(() => monthOptions(), []);
  const [events, setEvents] = useState<RanchEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [type, setType] = useState("");
  const [mode, setMode] = useState<"all" | "month" | "range">("all");
  const [month, setMonth] = useState(months[0]?.value || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (pageOffset: number) => {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(DEFAULT_PAGE_SIZE),
        offset: String(pageOffset),
      });
      if (type) params.set("type", type);
      if (mode === "month" && month) params.set("month", month);
      if (mode === "range") {
        if (from) params.set("from", from);
        if (to) params.set("to", to);
      }
      const res = await fetch(`/api/events?${params}`);
      const data = res.ok ? await res.json() : null;
      if (Array.isArray(data)) {
        setEvents(data);
        setTotal(data.length);
        setOffset(0);
      } else {
        setEvents(Array.isArray(data?.events) ? data.events : []);
        setTotal(typeof data?.total === "number" ? data.total : 0);
        setOffset(pageOffset);
      }
      setLoading(false);
    },
    [type, mode, month, from, to]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("eventsTitle")}</h1>
        <p className="text-muted-foreground">{t("eventsSubtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {EVENT_TYPES.map((ev) => (
                  <SelectItem key={ev} value={ev}>
                    {ev.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "all" | "month" | "range")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Date filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="month">By month</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
              </SelectContent>
            </Select>

            {mode === "month" && (
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {mode === "range" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
              </>
            )}

            {(mode !== "all" || type) && (
              <Button
                variant="outline"
                onClick={() => {
                  setType("");
                  setMode("all");
                  setFrom("");
                  setTo("");
                }}
              >
                {t("clearFilters")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading
              ? t("loading")
              : t("showingRangeOf", {
                  from: total === 0 ? 0 : offset + 1,
                  to: Math.min(offset + events.length, total),
                  total,
                })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="border-b pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{ev.type.replace(/_/g, " ")}</Badge>
                    <Link
                      href={`/animals/${ev.animal.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {ev.animal.eartag}
                    </Link>
                    <span>{ev.title}</span>
                  </div>
                  {ev.description && (
                    <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(ev.occurredAt)} · {ev.animal.camp.name}
                    {ev.recordedBy ? ` · ${ev.recordedBy.name}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          <ListPagination
            total={total}
            limit={DEFAULT_PAGE_SIZE}
            offset={offset}
            loading={loading}
            onPrev={() => load(Math.max(0, offset - DEFAULT_PAGE_SIZE))}
            onNext={() => load(offset + DEFAULT_PAGE_SIZE)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
