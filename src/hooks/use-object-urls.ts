"use client";

import { useEffect, useMemo, useState } from "react";

/** Stable object URLs for File previews; revokes on change/unmount. */
export function useObjectUrls(files: File[]): string[] {
  const signature = useMemo(
    () => files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join("|"),
    [files]
  );
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => {
      next.forEach((url) => URL.revokeObjectURL(url));
    };
    // signature tracks file identity; files read from latest render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return urls;
}
