"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = `${error?.message || ""} ${error?.name || ""}`;
    const isChunkError =
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
        message
      );
    if (!isChunkError) return;

    const key = "chunk-reload-once";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        This can happen after an app update. Reload to get the latest version.
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            try {
              sessionStorage.removeItem("chunk-reload-once");
            } catch {
              // ignore
            }
            window.location.reload();
          }}
        >
          Reload
        </Button>
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
