"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { flushSyncQueue, getPendingSyncCount } from "@/lib/sync/offline-db";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export function SyncStatusBadge() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      handleSync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    refreshPending();

    const interval = setInterval(refreshPending, 10000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function refreshPending() {
    const count = await getPendingSyncCount();
    setPending(count);
  }

  async function handleSync() {
    if (!navigator.onLine) return;
    setSyncing(true);
    await flushSyncQueue();
    await refreshPending();
    setSyncing(false);
  }

  if (!online) {
    return (
      <Badge variant="warning" className="gap-1">
        <CloudOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  if (pending > 0) {
    return (
      <button onClick={handleSync} disabled={syncing}>
        <Badge variant="warning" className="gap-1 cursor-pointer">
          {syncing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
          {pending} pending
        </Badge>
      </button>
    );
  }

  return (
    <Badge variant="success" className="gap-1">
      <Cloud className="h-3 w-3" />
      Synced
    </Badge>
  );
}
