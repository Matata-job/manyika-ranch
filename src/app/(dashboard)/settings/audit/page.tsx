"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";
import { formatDate } from "@/lib/utils";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

interface StaffUser {
  id: string;
  name: string;
  role: Role;
}

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "MOVE",
  "SALE",
  "DEATH",
  "TRANSFER_OWNERSHIP",
  "IMPORT",
] as const;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("all");
  const [role, setRole] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (userId !== "all") params.set("userId", userId);
    if (role !== "all") params.set("role", role);
    if (action !== "all") params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/audit?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [userId, role, action, from, to]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setUsers(
          (Array.isArray(d) ? d : []).map((u: StaffUser) => ({
            id: u.id,
            name: u.name,
            role: u.role,
          }))
        )
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity log</h1>
        <p className="text-muted-foreground">
          Track who changed what — edits, moves, sales, deaths, imports, and more
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            <Button onClick={load} disabled={loading}>
              {loading ? "Loading..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? "Loading..." : `${logs.length} entries`}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No activity found</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">When</th>
                    <th className="p-3 text-left">Who</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">What</th>
                    <th className="p-3 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b align-top">
                      <td className="p-3 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{log.user.name}</p>
                        <Badge variant="secondary" className="mt-1">
                          {ROLE_LABELS[log.user.role]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{log.entityType}</p>
                        <p className="text-xs text-muted-foreground font-mono break-all">
                          {log.entityId}
                        </p>
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs">
                        {log.changes ? (
                          <pre className="text-xs whitespace-pre-wrap break-words">
                            {JSON.stringify(log.changes, null, 0).slice(0, 280)}
                            {JSON.stringify(log.changes).length > 280 ? "…" : ""}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
