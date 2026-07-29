"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Plus, Pencil, Check, X, UserCircle, Search } from "lucide-react";

interface Camp { id: string; name: string }
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  photoUrl: string | null;
  isActive: boolean;
  campAssignments: { camp: Camp }[];
}

type SortKey = "name" | "role" | "status";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "CAMP_SUPERVISOR" as Role, campIds: [] as string[] });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCampIds, setEditCampIds] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  async function loadCamps() {
    const res = await fetch("/api/camps");
    if (res.ok) setCamps(await res.json());
  }

  useEffect(() => { loadUsers(); loadCamps(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to create user");
      return;
    }
    setShowForm(false);
    setForm({ email: "", name: "", password: "", role: "CAMP_SUPERVISOR", campIds: [] });
    loadUsers();
  }

  function toggleCampId(campId: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(campId) ? list.filter((c) => c !== campId) : [...list, campId]);
  }

  function startEditCamps(user: User) {
    setEditingUserId(user.id);
    setEditCampIds(user.campAssignments.map((a) => a.camp.id));
  }

  async function saveCampAssignment(userId: string) {
    await fetch(`/api/users/${userId}/assign-camp`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campIds: editCampIds }),
    });
    setEditingUserId(null);
    loadUsers();
  }

  async function toggleActive(userId: string, currentlyActive: boolean) {
    setTogglingId(userId);
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentlyActive }),
    });
    setTogglingId(null);
    loadUsers();
  }

  const filtered = users
    .filter((u) => roleFilter === "ALL" || u.role === roleFilter)
    .filter((u) => statusFilter === "ALL" || (statusFilter === "ACTIVE" ? u.isActive : !u.isActive))
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || "").includes(q);
    })
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "role") return a.role.localeCompare(b.role);
      return Number(b.isActive) - Number(a.isActive);
    });

  const isSupervisor = form.role === "CAMP_SUPERVISOR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">{users.length} users · Manage roles, profiles & camp assignments</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />Add User
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role, campIds: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isSupervisor && (
                <div className="sm:col-span-2 space-y-2">
                  <Label>Assign to Camps</Label>
                  <div className="flex flex-wrap gap-2">
                    {camps.map((camp) => (
                      <button
                        key={camp.id}
                        type="button"
                        onClick={() => toggleCampId(camp.id, form.campIds, (v) => setForm({ ...form, campIds: v }))}
                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                          form.campIds.includes(camp.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        }`}
                      >
                        {camp.name}
                      </button>
                    ))}
                  </div>
                  {form.campIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">Select at least one camp for this supervisor</p>
                  )}
                </div>
              )}
              <Button type="submit" className="sm:col-span-2" disabled={isSupervisor && form.campIds.length === 0}>
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="role">Role</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {filtered.length} user{filtered.length === 1 ? "" : "s"}
            {roleFilter !== "ALL" && ` · ${ROLE_LABELS[roleFilter as Role]}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left hidden md:table-cell">Phone</th>
                  <th className="p-3 text-left">Camps</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-3">
                      <Link href={`/settings/users/${user.id}`} className="flex items-center gap-3 hover:underline">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {user.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="p-3"><Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge></td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{user.phone || "—"}</td>
                    <td className="p-3">
                      {editingUserId === user.id ? (
                        <div className="flex flex-wrap gap-1.5">
                          {camps.map((camp) => (
                            <button
                              key={camp.id}
                              type="button"
                              onClick={() => toggleCampId(camp.id, editCampIds, setEditCampIds)}
                              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                editCampIds.includes(camp.id)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted border-border"
                              }`}
                            >
                              {camp.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {user.campAssignments.length > 0
                            ? user.campAssignments.map((a) => a.camp.name).join(", ")
                            : user.role === "CAMP_SUPERVISOR" ? "None" : "All"}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(user.id, user.isActive)}
                        disabled={togglingId === user.id}
                        className="cursor-pointer"
                        title={user.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        <Badge variant={user.isActive ? "success" : "destructive"}>
                          {togglingId === user.id ? "..." : user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Link href={`/settings/users/${user.id}`}>
                          <Button size="sm" variant="ghost">
                            <UserCircle className="h-4 w-4" />
                          </Button>
                        </Link>
                        {user.role === "CAMP_SUPERVISOR" && (
                          editingUserId === user.id ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => saveCampAssignment(user.id)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => startEditCamps(user)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
