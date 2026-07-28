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
import { Plus } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  campAssignments: { camp: { id: string; name: string } }[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "VIEWER" as Role });

  async function loadUsers() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => { loadUsers(); }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ email: "", name: "", password: "", role: "VIEWER" });
    loadUsers();
  }

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
              <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2 max-w-lg">
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
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="sm:col-span-2">Create User</Button>
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
                    <th className="p-3 text-left">Camps</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-3 font-medium">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3"><Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge></td>
                      <td className="p-3 text-muted-foreground">
                        {user.campAssignments.map((a) => a.camp.name).join(", ") || "All"}
                      </td>
                      <td className="p-3">
                        <Badge variant={user.isActive ? "success" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
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
