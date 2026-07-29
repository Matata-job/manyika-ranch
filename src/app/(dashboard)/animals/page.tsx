"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { formatAge, type AgeDisplayMode } from "@/lib/utils";

interface Animal {
  id: string;
  eartag: string;
  breed: string;
  sex: string;
  isCastrated?: boolean;
  isPregnant?: boolean;
  ageMonths: number | null;
  status: string;
  photoUrl: string | null;
  camp: { id: string; name: string };
  owner: { id: string; name: string };
}

export default function AnimalsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role;
  const canCreate = role && hasPermission(role, "createAnimal");

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [search, setSearch] = useState("");
  const [campFilter, setCampFilter] = useState("");
  const [camps, setCamps] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [ageMode, setAgeMode] = useState<AgeDisplayMode>("AUTO");

  useEffect(() => {
    fetch("/api/camps")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCamps(Array.isArray(data) ? data : []));
    fetch("/api/ranch/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ageDisplayMode) setAgeMode(data.ageDisplayMode);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (campFilter && campFilter !== "all") params.set("camp", campFilter);
    params.set("status", "ACTIVE");

    fetch(`/api/animals?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAnimals(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [search, campFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Animals</h1>
          <p className="text-muted-foreground">{animals.length} animals</p>
        </div>
        {canCreate && (
          <Link href="/animals/new">
            <Button><Plus className="h-4 w-4 mr-2" />Add Animal</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by eartag or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={campFilter || "all"} onValueChange={setCampFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All camps" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All camps</SelectItem>
            {camps.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {animals.map((animal) => (
            <Link key={animal.id} href={`/animals/${animal.id}`}>
              <Card className="hover:shadow-md transition-shadow overflow-hidden">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {animal.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={animal.photoUrl} alt={animal.eartag} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-muted-foreground">🐄</span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-bold">{animal.eartag}</h3>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="secondary">{animal.sex}</Badge>
                      {animal.sex === "MALE" && animal.isCastrated && (
                        <Badge variant="outline">Castrated</Badge>
                      )}
                      {animal.sex === "FEMALE" && animal.isPregnant && (
                        <Badge variant="warning">Pregnant</Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{animal.breed}</p>
                  <p className="text-xs text-muted-foreground">
                    {animal.camp.name} · {formatAge(animal.ageMonths, ageMode)} · {animal.owner.name}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
