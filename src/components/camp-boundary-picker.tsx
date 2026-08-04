"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Undo2 } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import {
  boundaryCentroid,
  boundaryPointCount,
  makeBoundary,
  parseBoundary,
  parseBoundaryFile,
  parseBoundaryPaste,
  type CampBoundary,
  type LatLng,
} from "@/lib/camp-boundary";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [-4.8167, 34.75];

type Props = {
  value: CampBoundary | null;
  onChange: (next: CampBoundary | null) => void;
  /** Optional camp pin to center the map */
  pinLat?: string;
  pinLng?: string;
  disabled?: boolean;
};

export function CampBoundaryPicker({
  value,
  onChange,
  pinLat,
  pinLng,
  disabled = false,
}: Props) {
  const t = useT();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const polygonRef = useRef<import("leaflet").Polygon | null>(null);
  const markersRef = useRef<import("leaflet").CircleMarker[]>([]);
  const valueRef = useRef(value);
  const [online, setOnline] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  valueRef.current = value;

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  function openRing(b: CampBoundary | null): LatLng[] {
    if (!b?.ring?.length) return [];
    const ring = b.ring;
    if (
      ring.length >= 2 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      return ring.slice(0, -1);
    }
    return [...ring];
  }

  function commitPoints(points: LatLng[]) {
    if (points.length === 0) {
      onChange(null);
      return;
    }
    if (points.length < 3) {
      onChange({ type: "Polygon", ring: points });
      return;
    }
    onChange(makeBoundary(points));
  }

  function redraw(
    L: typeof import("leaflet"),
    map: import("leaflet").Map,
    boundary: CampBoundary | null
  ) {
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    for (const m of markersRef.current) map.removeLayer(m);
    markersRef.current = [];

    const pts = openRing(boundary);
    if (pts.length === 0) return;

    if (pts.length >= 3) {
      const poly = L.polygon(pts, {
        color: "#1a1a1a",
        weight: 2,
        fillColor: "#1a1a1a",
        fillOpacity: 0.12,
      }).addTo(map);
      polygonRef.current = poly;
    }

    pts.forEach((p, i) => {
      const m = L.circleMarker(p, {
        radius: 5,
        color: "#1a1a1a",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      m.bindTooltip(`${i + 1}`, { permanent: false });
      markersRef.current.push(m);
    });
  }

  useEffect(() => {
    if (!online || !mapRef.current || mapInstance.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // @ts-expect-error leaflet CSS side-effect import
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;

      const pinLatN = pinLat ? parseFloat(pinLat) : NaN;
      const pinLngN = pinLng ? parseFloat(pinLng) : NaN;
      const centroid = boundaryCentroid(valueRef.current);
      const start: [number, number] = centroid
        ? [centroid.lat, centroid.lng]
        : Number.isFinite(pinLatN) && Number.isFinite(pinLngN)
          ? [pinLatN, pinLngN]
          : DEFAULT_CENTER;

      const map = L.map(mapRef.current, {
        center: start,
        zoom: centroid || (Number.isFinite(pinLatN) && Number.isFinite(pinLngN)) ? 14 : 8,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
      redraw(L, map, valueRef.current);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (disabled) return;
        const pts = openRing(valueRef.current);
        pts.push([
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ]);
        commitPoints(pts);
      });

      setTimeout(() => map.invalidateSize(), 100);
    }

    init();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        polygonRef.current = null;
        markersRef.current = [];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, disabled]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      redraw(L, map, value);
      const pts = openRing(value);
      if (pts.length >= 2) {
        try {
          map.fitBounds(pts as [number, number][], { padding: [24, 24], maxZoom: 16 });
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value]);

  function undoLast() {
    const pts = openRing(value);
    if (pts.length === 0) return;
    pts.pop();
    commitPoints(pts);
  }

  function applyPaste() {
    setPasteError(null);
    const parsed = parseBoundaryPaste(pasteText);
    if (!parsed) {
      setPasteError(t("campBoundaryInvalid"));
      return;
    }
    onChange(parsed);
    setPasteText("");
  }

  async function onFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseBoundaryFile(text, file.name);
      if (!parsed) {
        setImportError(t("campBoundaryInvalid"));
        return;
      }
      onChange(parsed);
    } catch {
      setImportError(t("campBoundaryInvalid"));
    }
  }

  const count = boundaryPointCount(
    value && openRing(value).length >= 3 ? parseBoundary(value) : value
  );
  const draftCount = openRing(value).length;
  const ready = !!parseBoundary(value);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>{t("campBoundary")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("campBoundaryHelp")}
          </p>
        </div>
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={draftCount === 0}
              onClick={undoLast}
            >
              <Undo2 className="h-4 w-4 mr-1" />
              {t("campBoundaryUndo")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!value}
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("campBoundaryClear")}
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {ready
          ? t("campBoundaryPoints", { n: count })
          : draftCount > 0
            ? t("campBoundaryDraft", { n: draftCount })
            : t("campBoundaryEmpty")}
      </p>

      {online ? (
        <div
          ref={mapRef}
          className={cn(
            "h-72 w-full rounded-lg border z-0",
            !disabled && "cursor-crosshair"
          )}
          aria-label={t("campBoundary")}
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
          {t("mapUnavailableOffline")}
        </div>
      )}

      {!disabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor="camp-boundary-paste">{t("campBoundaryPaste")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("campBoundaryPasteHelp")}
            </p>
            <Textarea
              id="camp-boundary-paste"
              rows={4}
              className="font-mono text-xs"
              placeholder={"-4.812100, 34.751000\n-4.812500, 34.758200\n-4.819000, 34.757500"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            {pasteError && (
              <p className="text-xs text-destructive">{pasteError}</p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pasteText.trim()}
              onClick={applyPaste}
            >
              {t("campBoundaryApplyPaste")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("campBoundaryImport")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("campBoundaryImportHelp")}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".geojson,.json,.kml,.gpx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              {t("campBoundaryChooseFile")}
            </Button>
            {importError && (
              <p className="text-xs text-destructive">{importError}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
