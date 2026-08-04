"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LocateFixed,
  MapPin,
  Pentagon,
  Trash2,
  Undo2,
  Upload,
  Crosshair,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import {
  boundaryAreaAcres,
  boundaryCentroid,
  boundaryPointCount,
  formatAcresEstimate,
  makeBoundary,
  openBoundaryRing,
  parseBoundary,
  parseBoundaryFile,
  parseBoundaryPaste,
  type CampBoundary,
  type LatLng,
} from "@/lib/camp-boundary";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [-4.8167, 34.75];

type MapMode = "pin" | "border";

type Props = {
  latitude: string;
  longitude: string;
  onPinChange: (coords: { latitude: string; longitude: string }) => void;
  boundary: CampBoundary | null;
  onBoundaryChange: (next: CampBoundary | null) => void;
  /** Called when estimated acres from border should fill farm size */
  onApplyAcresEstimate?: (acres: number) => void;
  disabled?: boolean;
  className?: string;
};

export function CampMapPanel({
  latitude,
  longitude,
  onPinChange,
  boundary,
  onBoundaryChange,
  onApplyAcresEstimate,
  disabled = false,
  className,
}: Props) {
  const t = useT();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const pinMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const polygonRef = useRef<import("leaflet").Polygon | null>(null);
  const polylineRef = useRef<import("leaflet").Polyline | null>(null);
  const vertexMarkersRef = useRef<import("leaflet").CircleMarker[]>([]);
  const modeRef = useRef<MapMode>("pin");
  const boundaryRef = useRef(boundary);
  const pinRef = useRef({ latitude, longitude });
  const disabledRef = useRef(disabled);

  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<MapMode>("pin");
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  modeRef.current = mode;
  boundaryRef.current = boundary;
  pinRef.current = { latitude, longitude };
  disabledRef.current = disabled;

  const validBoundary = parseBoundary(boundary);
  const acres = boundaryAreaAcres(validBoundary);
  const draftCount = openBoundaryRing(boundary).length;
  const cornerCount = boundaryPointCount(validBoundary);
  const hasPin =
    Number.isFinite(parseFloat(latitude)) &&
    Number.isFinite(parseFloat(longitude));

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

  function commitBorderPoints(points: LatLng[]) {
    if (points.length === 0) {
      onBoundaryChange(null);
      return;
    }
    if (points.length < 3) {
      onBoundaryChange({ type: "Polygon", ring: points });
      return;
    }
    onBoundaryChange(makeBoundary(points));
  }

  async function redrawLayers(
    L: typeof import("leaflet"),
    map: import("leaflet").Map
  ) {
    const pinLat = parseFloat(pinRef.current.latitude);
    const pinLng = parseFloat(pinRef.current.longitude);

    if (pinMarkerRef.current) {
      map.removeLayer(pinMarkerRef.current);
      pinMarkerRef.current = null;
    }
    if (Number.isFinite(pinLat) && Number.isFinite(pinLng)) {
      const marker = L.marker([pinLat, pinLng], {
        draggable: !disabledRef.current,
        title: t("campLocation"),
      }).addTo(map);
      if (!disabledRef.current) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onPinChange({
            latitude: pos.lat.toFixed(6),
            longitude: pos.lng.toFixed(6),
          });
        });
      }
      pinMarkerRef.current = marker;
    }

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    for (const m of vertexMarkersRef.current) map.removeLayer(m);
    vertexMarkersRef.current = [];

    const pts = openBoundaryRing(boundaryRef.current);
    if (pts.length >= 3 && parseBoundary(boundaryRef.current)) {
      polygonRef.current = L.polygon(pts, {
        color: "#f5f0e6",
        weight: 2.5,
        fillColor: "#c4a35a",
        fillOpacity: 0.35,
      }).addTo(map);
    } else if (pts.length >= 2) {
      polylineRef.current = L.polyline(pts, {
        color: "#f5f0e6",
        weight: 2,
        dashArray: "6 6",
      }).addTo(map);
    }

    pts.forEach((p, i) => {
      const m = L.circleMarker(p, {
        radius: 6,
        color: "#f5f0e6",
        fillColor: "#1c1917",
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      m.bindTooltip(String(i + 1), {
        direction: "top",
        offset: [0, -6],
        className: "camp-map-vertex-tip",
      });
      vertexMarkersRef.current.push(m);
    });
  }

  useEffect(() => {
    if (!online || !mapRef.current || mapInstance.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // @ts-expect-error leaflet CSS
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const pinLat = parseFloat(pinRef.current.latitude);
      const pinLng = parseFloat(pinRef.current.longitude);
      const centroid = boundaryCentroid(boundaryRef.current);
      const start: [number, number] = centroid
        ? [centroid.lat, centroid.lng]
        : Number.isFinite(pinLat) && Number.isFinite(pinLng)
          ? [pinLat, pinLng]
          : DEFAULT_CENTER;

      const map = L.map(mapRef.current, {
        center: start,
        zoom:
          centroid || (Number.isFinite(pinLat) && Number.isFinite(pinLng))
            ? 15
            : 9,
        zoomControl: true,
      });

      const imagery = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri",
          maxZoom: 19,
        }
      );
      const labels = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 19,
          opacity: 0.85,
        }
      );
      imagery.addTo(map);
      labels.addTo(map);

      mapInstance.current = map;
      await redrawLayers(L, map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (disabledRef.current) return;
        const ll = {
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        };
        if (modeRef.current === "pin") {
          onPinChange({
            latitude: ll.lat.toFixed(6),
            longitude: ll.lng.toFixed(6),
          });
          return;
        }
        const pts = openBoundaryRing(boundaryRef.current);
        pts.push([ll.lat, ll.lng]);
        commitBorderPoints(pts);
      });

      setTimeout(() => map.invalidateSize(), 120);
    }

    void init();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        pinMarkerRef.current = null;
        polygonRef.current = null;
        polylineRef.current = null;
        vertexMarkersRef.current = [];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      await redrawLayers(L, map);
      const pts = openBoundaryRing(boundary);
      if (pts.length >= 2) {
        try {
          map.fitBounds(pts as [number, number][], {
            padding: [40, 40],
            maxZoom: 17,
          });
        } catch {
          /* ignore */
        }
      } else {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          map.panTo([lat, lng]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, latitude, longitude, disabled]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert(t("geolocationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPinChange({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
        setMode("pin");
      },
      () => alert(t("geolocationFailed")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function setPinToBorderCenter() {
    const c = boundaryCentroid(validBoundary);
    if (!c) return;
    onPinChange({
      latitude: c.lat.toFixed(6),
      longitude: c.lng.toFixed(6),
    });
    setMode("pin");
  }

  function undoLast() {
    const pts = openBoundaryRing(boundary);
    if (pts.length === 0) return;
    pts.pop();
    commitBorderPoints(pts);
  }

  function applyPaste() {
    setPasteError(null);
    const parsed = parseBoundaryPaste(pasteText);
    if (!parsed) {
      setPasteError(t("campBoundaryInvalid"));
      return;
    }
    onBoundaryChange(parsed);
    setPasteText("");
    setMode("border");
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
      onBoundaryChange(parsed);
      setMode("border");
    } catch {
      setImportError(t("campBoundaryInvalid"));
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-base">{t("campMapTitle")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
            {t("campMapHelp")}
          </p>
        </div>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
          >
            <LocateFixed className="h-4 w-4 mr-1" />
            {t("useMyLocation")}
          </Button>
        )}
      </div>

      {!disabled && (
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setMode("pin")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "pin"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            {t("campMapModePin")}
          </button>
          <button
            type="button"
            onClick={() => setMode("border")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "border"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Pentagon className="h-3.5 w-3.5" />
            {t("campMapModeBorder")}
          </button>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border shadow-sm">
        {online ? (
          <div
            ref={mapRef}
            className={cn(
              "h-[22rem] sm:h-[28rem] w-full z-0 bg-stone-900",
              !disabled && (mode === "border" ? "cursor-crosshair" : "cursor-pointer")
            )}
            aria-label={t("campMapTitle")}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-muted/40 px-4 text-center text-sm text-muted-foreground">
            {t("mapUnavailableOffline")}
          </div>
        )}

        <div className="absolute left-3 top-3 z-[1000] max-w-[min(100%-1.5rem,16rem)] rounded-lg border border-white/20 bg-stone-950/75 px-3 py-2 text-xs text-stone-100 backdrop-blur-sm shadow-lg">
          <p className="font-medium tracking-wide">
            {!disabled
              ? mode === "pin"
                ? t("campMapHintPin")
                : t("campMapHintBorder")
              : t("campMapViewOnly")}
          </p>
          <p className="mt-1 text-stone-300">
            {hasPin
              ? `${latitude}, ${longitude}`
              : t("noLocationSet")}
            {" · "}
            {validBoundary
              ? t("campBoundaryPoints", { n: cornerCount })
              : draftCount > 0
                ? t("campBoundaryDraft", { n: draftCount })
                : t("campBoundaryEmpty")}
          </p>
          {acres != null && (
            <p className="mt-1.5 font-semibold text-amber-200">
              {t("campBoundaryAcresEstimate", {
                acres: formatAcresEstimate(acres),
              })}
            </p>
          )}
        </div>
      </div>

      {acres != null && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <span>
            {t("campBoundaryAcresEstimate", {
              acres: formatAcresEstimate(acres),
            })}
          </span>
          {!disabled && onApplyAcresEstimate && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onApplyAcresEstimate(acres)}
            >
              {t("campBoundaryUseAcres")}
            </Button>
          )}
          {!disabled && validBoundary && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={setPinToBorderCenter}
            >
              <Crosshair className="h-3.5 w-3.5 mr-1" />
              {t("campMapPinToCenter")}
            </Button>
          )}
        </div>
      )}

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
            disabled={!boundary}
            onClick={() => onBoundaryChange(null)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t("campBoundaryClear")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setToolsOpen((v) => !v)}
          >
            {toolsOpen ? t("campMapHideTools") : t("campMapShowTools")}
          </Button>
        </div>
      )}

      {!disabled && toolsOpen && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="camp-boundary-paste">{t("campBoundaryPaste")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("campBoundaryPasteHelp")}
            </p>
            <Textarea
              id="camp-boundary-paste"
              rows={4}
              className="font-mono text-xs"
              placeholder={
                "-4.812100, 34.751000\n-4.812500, 34.758200\n-4.819000, 34.757500"
              }
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

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="camp-map-lat">{t("latitude")}</Label>
              <input
                id="camp-map-lat"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={latitude}
                onChange={(e) =>
                  onPinChange({ latitude: e.target.value, longitude })
                }
                placeholder="-4.816700"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="camp-map-lng">{t("longitude")}</Label>
              <input
                id="camp-map-lng"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={longitude}
                onChange={(e) =>
                  onPinChange({ latitude, longitude: e.target.value })
                }
                placeholder="34.750000"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
