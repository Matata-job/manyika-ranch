"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Download,
  Plus,
} from "lucide-react";
import { useT } from "@/components/providers/locale-provider";
import {
  addBoundaryAreas,
  areaDisplayName,
  boundaryAllPoints,
  boundaryAreaCount,
  boundaryAreaNames,
  boundaryAreas,
  boundaryCentroid,
  boundaryPerAreaAcres,
  boundaryRings,
  boundaryTotalAcresUnion,
  downloadBoundaryGeoJson,
  formatAcresEstimate,
  makeBoundaries,
  normalizeBoundaryRing,
  parseBoundary,
  parseBoundaryFile,
  parseBoundaryPaste,
  removeBoundaryArea,
  renameBoundaryArea,
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
  onApplyAcresEstimate?: (acres: number) => void;
  disabled?: boolean;
  className?: string;
  downloadName?: string;
};

/**
 * Border drawing: points accumulate in `draft`. Once ≥3, the draft is written
 * into `boundary` as the last area (form save-safe). “Add another area” freezes
 * that ring and starts a new draft.
 */
export function CampMapPanel({
  latitude,
  longitude,
  onPinChange,
  boundary,
  onBoundaryChange,
  onApplyAcresEstimate,
  disabled = false,
  className,
  downloadName = "camp-border",
}: Props) {
  const t = useT();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const pinMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const polygonLayersRef = useRef<import("leaflet").Polygon[]>([]);
  const polylineRef = useRef<import("leaflet").Polyline | null>(null);
  const vertexMarkersRef = useRef<import("leaflet").CircleMarker[]>([]);
  const modeRef = useRef<MapMode>("pin");
  const boundaryRef = useRef(boundary);
  const draftRef = useRef<LatLng[]>([]);
  /** When true, the last ring in boundary is the live draft (≥3 pts). */
  const draftingIntoBoundaryRef = useRef(false);
  const pinRef = useRef({ latitude, longitude });
  const disabledRef = useRef(disabled);
  const onBoundaryChangeRef = useRef(onBoundaryChange);
  const onPinChangeRef = useRef(onPinChange);

  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<MapMode>("pin");
  const [draftPoints, setDraftPoints] = useState<LatLng[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [selectedAreaIndex, setSelectedAreaIndex] = useState<number | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedAreaRef = useRef<number | null>(null);

  modeRef.current = mode;
  boundaryRef.current = boundary;
  draftRef.current = draftPoints;
  pinRef.current = { latitude, longitude };
  disabledRef.current = disabled;
  onBoundaryChangeRef.current = onBoundaryChange;
  onPinChangeRef.current = onPinChange;
  selectedAreaRef.current = selectedAreaIndex;

  const validBoundary = parseBoundary(boundary);
  const areaCount = boundaryAreaCount(validBoundary);
  const areaNames = boundaryAreaNames(validBoundary);
  const perArea = boundaryPerAreaAcres(validBoundary);
  const { acres: totalAcres, usedUnion } =
    boundaryTotalAcresUnion(validBoundary);
  const draftCount = draftPoints.length;
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

  /** Frozen rings (exclude live draft ring if drafting into boundary). */
  function frozenRings(): LatLng[][] {
    const rings = boundaryRings(boundaryRef.current);
    if (draftingIntoBoundaryRef.current && rings.length > 0) {
      return rings.slice(0, -1);
    }
    return rings;
  }

  function publishDraft(points: LatLng[]) {
    const frozen = frozenRings();
    if (points.length < 3) {
      draftingIntoBoundaryRef.current = false;
      onBoundaryChangeRef.current(makeBoundaries(frozen));
      return;
    }
    const closed = normalizeBoundaryRing(points);
    if (!closed) {
      draftingIntoBoundaryRef.current = false;
      onBoundaryChangeRef.current(makeBoundaries(frozen));
      return;
    }
    draftingIntoBoundaryRef.current = true;
    onBoundaryChangeRef.current(makeBoundaries([...frozen, closed]));
  }

  function freezeDraft() {
    draftingIntoBoundaryRef.current = false;
    setDraftPoints([]);
  }

  function startNewArea() {
    freezeDraft();
    setMode("border");
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
          onPinChangeRef.current({
            latitude: pos.lat.toFixed(6),
            longitude: pos.lng.toFixed(6),
          });
        });
      }
      pinMarkerRef.current = marker;
    }

    for (const poly of polygonLayersRef.current) map.removeLayer(poly);
    polygonLayersRef.current = [];
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    for (const m of vertexMarkersRef.current) map.removeLayer(m);
    vertexMarkersRef.current = [];

    const completed = boundaryAreas(boundaryRef.current);
    const draft = draftRef.current;
    const liveDraft = draftingIntoBoundaryRef.current;
    const frozenCount = liveDraft
      ? Math.max(0, completed.length - 1)
      : completed.length;
    const selected = selectedAreaRef.current;
    const hasSelection = selected != null;

    completed.forEach((pts, areaIdx) => {
      const isLive = liveDraft && areaIdx === completed.length - 1;
      const isSelected = selected === areaIdx;
      const isDimmed = hasSelection && !isSelected && !isLive;

      const stroke = isLive
        ? "#fbbf24"
        : isSelected
          ? "#fde047"
          : isDimmed
            ? "#a8a29e"
            : "#f5f0e6";
      const fill = isLive
        ? "#f59e0b"
        : isSelected
          ? "#f59e0b"
          : isDimmed
            ? "#78716c"
            : "#c4a35a";
      const fillOpacity = isLive ? 0.38 : isSelected ? 0.55 : isDimmed ? 0.12 : 0.32;
      const weight = isSelected ? 3.5 : 2.5;
      const vertexRadius = isSelected ? 7 : isLive ? 6 : 5;
      const vertexStroke = isSelected ? "#fde047" : isLive ? "#fbbf24" : "#f5f0e6";
      const vertexFill = isSelected ? "#fde047" : "#1c1917";

      const label = areaDisplayName(
        boundaryRef.current,
        areaIdx,
        t("campBoundaryAreaLabel", { n: areaIdx + 1 })
      );

      const poly = L.polygon(pts, {
        color: stroke,
        weight,
        fillColor: fill,
        fillOpacity,
        dashArray: isLive ? "4 4" : undefined,
      }).addTo(map);
      poly.bindTooltip(label, { sticky: true });
      if (!disabledRef.current) {
        poly.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedAreaIndex(areaIdx);
        });
      }
      polygonLayersRef.current.push(poly);

      pts.forEach((p, i) => {
        const m = L.circleMarker(p, {
          radius: vertexRadius,
          color: vertexStroke,
          fillColor: vertexFill,
          fillOpacity: 1,
          weight: isSelected ? 2.5 : 2,
        }).addTo(map);
        m.bindTooltip(`${areaIdx + 1}.${i + 1}`, {
          direction: "top",
          offset: [0, -6],
          className: "camp-map-vertex-tip",
        });
        if (!disabledRef.current) {
          m.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedAreaIndex(areaIdx);
          });
        }
        vertexMarkersRef.current.push(m);
      });
    });

    // Incomplete draft (<3) not yet in boundary
    if (!liveDraft && draft.length > 0) {
      if (draft.length >= 2) {
        polylineRef.current = L.polyline(draft, {
          color: "#fbbf24",
          weight: 2,
          dashArray: "6 6",
        }).addTo(map);
      }
      draft.forEach((p, i) => {
        const m = L.circleMarker(p, {
          radius: 6,
          color: "#fbbf24",
          fillColor: "#1c1917",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        m.bindTooltip(`${frozenCount + 1}.${i + 1}`, {
          direction: "top",
          offset: [0, -6],
          className: "camp-map-vertex-tip",
        });
        vertexMarkersRef.current.push(m);
      });
    }
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
        zoomControl: false,
      });
      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(map);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { attribution: "", maxZoom: 19, opacity: 0.85 }
      ).addTo(map);

      mapInstance.current = map;
      await redrawLayers(L, map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (disabledRef.current) return;
        const ll: LatLng = [
          Number(e.latlng.lat.toFixed(6)),
          Number(e.latlng.lng.toFixed(6)),
        ];
        if (modeRef.current === "pin") {
          onPinChangeRef.current({
            latitude: ll[0].toFixed(6),
            longitude: ll[1].toFixed(6),
          });
          return;
        }
        setDraftPoints((prev) => {
          const next = [...prev, ll];
          // Defer publish so draftRef is updated via render cycle after setState
          queueMicrotask(() => {
            draftRef.current = next;
            publishDraft(next);
          });
          return next;
        });
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
        polygonLayersRef.current = [];
        polylineRef.current = null;
        vertexMarkersRef.current = [];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Keep Leaflet container classes stable — toggling cursor classes on the
  // map div blanks tiles (black bg). Set cursor on Leaflet's own container.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const el = map.getContainer();
    if (!disabled) {
      el.style.cursor = mode === "border" ? "crosshair" : "pointer";
    } else {
      el.style.cursor = "";
    }
    // Mode toggle can shift layout; force tile reload
    const id = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 50);
    return () => window.clearTimeout(id);
  }, [mode, disabled]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      await redrawLayers(L, map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, draftPoints, latitude, longitude, disabled, selectedAreaIndex]);

  // Fit once when area count changes (not on every vertex while drawing)
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const pts = boundaryAllPoints(boundary);
    if (pts.length < 2) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.panTo([lat, lng]);
      }
      return;
    }
    try {
      map.fitBounds(pts as [number, number][], {
        padding: [40, 40],
        maxZoom: 17,
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCount, online]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert(t("geolocationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onPinChange({
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        });
        setMode("pin");
        const map = mapInstance.current;
        if (map) {
          map.setView([lat, lng], Math.max(map.getZoom(), 15), {
            animate: true,
          });
        }
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
    const map = mapInstance.current;
    if (map) {
      map.setView([c.lat, c.lng], Math.max(map.getZoom(), 15), {
        animate: true,
      });
    }
  }

  function undoLast() {
    if (draftPoints.length > 0) {
      const next = draftPoints.slice(0, -1);
      setDraftPoints(next);
      draftRef.current = next;
      publishDraft(next);
      return;
    }
    // Peel the last corner from the last saved area (friendlier than deleting it)
    const areas = boundaryAreas(validBoundary);
    if (areas.length === 0) return;
    const last = areas[areas.length - 1];
    const frozen = boundaryRings(validBoundary).slice(0, -1);
    if (last.length <= 3) {
      draftingIntoBoundaryRef.current = false;
      setDraftPoints([]);
      draftRef.current = [];
      boundaryRef.current = makeBoundaries(frozen);
      onBoundaryChange(makeBoundaries(frozen));
      return;
    }
    const nextDraft = last.slice(0, -1);
    setDraftPoints(nextDraft);
    draftRef.current = nextDraft;
    boundaryRef.current = makeBoundaries(frozen);
    // Sync refs before publish so we don't duplicate the peeled area
    if (nextDraft.length >= 3) {
      const closed = normalizeBoundaryRing(nextDraft);
      draftingIntoBoundaryRef.current = Boolean(closed);
      const next = closed
        ? makeBoundaries([...frozen, closed])
        : makeBoundaries(frozen);
      boundaryRef.current = next;
      onBoundaryChange(next);
    } else {
      draftingIntoBoundaryRef.current = false;
      onBoundaryChange(makeBoundaries(frozen));
    }
    setMode("border");
  }

  const canUndo = draftCount > 0 || areaCount > 0;

  function clearAll() {
    draftingIntoBoundaryRef.current = false;
    setDraftPoints([]);
    onBoundaryChange(null);
  }

  function applyPaste() {
    setPasteError(null);
    const parsed = parseBoundaryPaste(pasteText);
    if (!parsed) {
      setPasteError(t("campBoundaryInvalid"));
      return;
    }
    freezeDraft();
    onBoundaryChange(addBoundaryAreas(makeBoundaries(frozenRings()), parsed));
    setPasteText("");
    setMode("border");
  }

  async function onFiles(files: FileList | File[]) {
    setImportError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    freezeDraft();
    let next = makeBoundaries(frozenRings());
    let ok = 0;
    for (const file of list) {
      try {
        const text = await file.text();
        const parsed = parseBoundaryFile(text, file.name);
        if (!parsed) continue;
        next = addBoundaryAreas(next, parsed);
        ok += 1;
      } catch {
        /* skip */
      }
    }
    if (ok === 0) {
      setImportError(t("campBoundaryInvalid"));
      return;
    }
    onBoundaryChange(next);
    setMode("border");
  }

  function onDownload() {
    if (!downloadBoundaryGeoJson(validBoundary, `${downloadName}.geojson`)) {
      alert(t("campBoundaryEmpty"));
    }
  }

  function removeAreaAt(index: number) {
    const rings = boundaryRings(validBoundary);
    const names = boundaryAreaNames(validBoundary);
    if (index < 0 || index >= rings.length) return;
    setSelectedAreaIndex((prev) => {
      if (prev == null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
    const nextRings = rings.filter((_, i) => i !== index);
    const nextNames = names.filter((_, i) => i !== index);
    if (draftingIntoBoundaryRef.current) {
      if (index === rings.length - 1) {
        freezeDraft();
        onBoundaryChange(makeBoundaries(nextRings, nextNames));
        return;
      }
      onBoundaryChange(makeBoundaries(nextRings, nextNames));
      return;
    }
    onBoundaryChange(removeBoundaryArea(validBoundary, index));
  }

  function renameAreaAt(index: number, name: string) {
    const next = renameBoundaryArea(validBoundary, index, name);
    if (next) onBoundaryChange(next);
  }

  const statusLine = (() => {
    if (draftCount > 0 && draftCount < 3) {
      return t("campBoundaryDraft", { n: draftCount });
    }
    if (areaCount > 1) {
      return t("campBoundaryAreasCount", { n: areaCount });
    }
    if (areaCount === 1) {
      const corners = boundaryAreas(validBoundary)[0]?.length ?? 0;
      return t("campBoundaryPoints", { n: corners });
    }
    return t("campBoundaryEmpty");
  })();

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-base">{t("campMapTitle")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
            {t("campMapHelp")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {areaCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDownload}
            >
              <Download className="h-4 w-4 mr-1" />
              {t("campBoundaryDownload")}
            </Button>
          )}
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
            className="h-[22rem] sm:h-[28rem] w-full z-0 bg-muted"
            aria-label={t("campMapTitle")}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-muted/40 px-4 text-center text-sm text-muted-foreground">
            {t("mapUnavailableOffline")}
          </div>
        )}

        {!disabled && (
          <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={undoLast}
              disabled={!canUndo}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-md backdrop-blur-sm transition-colors",
                canUndo
                  ? "border-white/25 bg-stone-950/80 text-stone-50 hover:bg-stone-900"
                  : "cursor-not-allowed border-white/10 bg-stone-950/40 text-stone-500"
              )}
              title={t("campBoundaryUndo")}
            >
              <Undo2 className="h-4 w-4" />
              {t("campBoundaryUndo")}
            </button>
            {mode === "border" && (
              <>
                <button
                  type="button"
                  onClick={startNewArea}
                  disabled={areaCount === 0 && draftCount < 3}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-md backdrop-blur-sm transition-colors",
                    areaCount > 0 || draftCount >= 3
                      ? "border-white/25 bg-stone-950/80 text-stone-50 hover:bg-stone-900"
                      : "cursor-not-allowed border-white/10 bg-stone-950/40 text-stone-500"
                  )}
                  title={t("campBoundaryAddArea")}
                >
                  <Plus className="h-4 w-4" />
                  {t("campBoundaryAddArea")}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={!canUndo}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-md backdrop-blur-sm transition-colors",
                    canUndo
                      ? "border-white/25 bg-stone-950/80 text-red-200 hover:bg-stone-900"
                      : "cursor-not-allowed border-white/10 bg-stone-950/40 text-stone-500"
                  )}
                  title={t("campBoundaryClear")}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("campBoundaryClearShort")}
                </button>
              </>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] max-w-[min(100%-1.5rem,18rem)] rounded-lg border border-white/20 bg-stone-950/75 px-3 py-2 text-xs text-stone-100 backdrop-blur-sm shadow-lg">
          <p className="font-medium tracking-wide">
            {!disabled
              ? mode === "pin"
                ? t("campMapHintPin")
                : t("campMapHintBorder")
              : t("campMapViewOnly")}
          </p>
          <p className="mt-1 text-stone-300">
            {hasPin ? `${latitude}, ${longitude}` : t("noLocationSet")}
            {" · "}
            {statusLine}
          </p>
        </div>
      </div>
      {(perArea.length > 0 || totalAcres != null) && (
        <div className="space-y-2 text-sm">
          {perArea.map((a) => (
            <div
              key={a.index}
              className="flex flex-wrap items-center gap-2 py-1"
              onClick={() => !disabled && setSelectedAreaIndex(a.index)}
            >
              <Input
                value={areaNames[a.index] ?? ""}
                placeholder={t("campBoundaryAreaNamePlaceholder", {
                  n: a.index + 1,
                })}
                disabled={disabled}
                className="h-8 max-w-[14rem] text-sm"
                onFocus={() => setSelectedAreaIndex(a.index)}
                onChange={(e) => renameAreaAt(a.index, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label={t("campBoundaryAreaName")}
              />
              <span className="text-muted-foreground tabular-nums">
                ≈ {formatAcresEstimate(a.acres)} {t("acres")}
              </span>
              {!disabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive ml-auto"
                  onClick={() => removeAreaAt(a.index)}
                >
                  {t("campBoundaryRemoveArea")}
                </Button>
              )}
            </div>
          ))}
          {totalAcres != null && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-2 mt-1">
              <span className="font-medium">
                {t("campBoundaryTotalAcres", {
                  acres: formatAcresEstimate(totalAcres),
                })}
              </span>
              {usedUnion && areaCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  {t("campBoundaryUnionNote")}
                </span>
              )}
              {!disabled && onApplyAcresEstimate && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onApplyAcresEstimate(totalAcres)}
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
        </div>
      )}

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startNewArea}
            disabled={areaCount === 0 && draftCount < 3}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("campBoundaryAddArea")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canUndo}
            onClick={undoLast}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            {t("campBoundaryUndo")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canUndo}
            onClick={clearAll}
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
              multiple
              accept=".geojson,.json,.kml,.gpx,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void onFiles(e.target.files);
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
              {t("campBoundaryChooseFiles")}
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

