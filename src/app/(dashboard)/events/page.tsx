"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

interface RanchEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
  animal: { id: string; eartag: string; camp: { name: string } };
  recordedBy: { name: string } | null;
}

export default function EventsPage() {
  const [events, setEvents] = useState<RanchEvent[]>([]);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cattle Events</h1>
          <p className="text-muted-foreground">Ranch-wide activity timeline</p>
        </div>
        <Select value={type || "all"} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {["DEATH", "CULLING", "MOVEMENT", "WEIGHT", "HEALTH", "VACCINATION", "BREEDING", "CALVING", "NOTE", "STATUS_CHANGE"].map(
              (t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? "Loading..." : `${events.length} events`}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No events found</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="border-b pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{ev.type.replace(/_/g, " ")}</Badge>
                    <Link href={`/animals/${ev.animal.id}`} className="font-medium text-primary hover:underline">
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
        </CardContent>
      </Card>
    </div>
  );
}
