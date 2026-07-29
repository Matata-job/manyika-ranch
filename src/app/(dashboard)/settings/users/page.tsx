"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { Plus, Pencil, Check, X } from "lucide-react";

interface Camp { id: string; name: string }
interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  campAssignments: { camp: Camp }[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "CAMP_SUPERVISOR" as Role, campIds: [] as string[] });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCampIds, setEditCampIds] = useState<string[]>([]);

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

  const isSupervisor = form.role === "CAMP_SUPERVISOR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage roles and camp assignments</p>
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

      <Card>
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Assigned Camps</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3"><Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge></td>
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
                        <span className="text-muted-foreground">
                          {user.campAssignments.length > 0
                            ? user.campAssignments.map((a) => a.camp.name).join(", ")
                            : user.role === "CAMP_SUPERVISOR" ? "None" : "All"}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={user.isActive ? "success" : "destructive"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {user.role === "CAMP_SUPERVISOR" && (
                        editingUserId === user.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => saveCampAssignment(user.id)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEditCamps(user)}>
                            <Pencil className="h-4 w-4 mr-1" /> Camps
                          </Button>
                        )
                      )}
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
