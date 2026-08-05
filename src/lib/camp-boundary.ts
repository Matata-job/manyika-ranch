import { polygon, featureCollection } from "@turf/helpers";
import union from "@turf/union";
import areaFn from "@turf/area";

/** Camp border rings use Leaflet order: [lat, lng]. */

export type LatLng = [number, number];

export type CampPolygonBoundary = {
  type: "Polygon";
  ring: LatLng[];
  /** User label for this grazing area (e.g. farm name). */
  name?: string;
};

export type CampMultiPolygonBoundary = {
  type: "MultiPolygon";
  rings: LatLng[][];
  /** Parallel labels for each ring in `rings`. */
  names?: string[];
};

/** Stored camp border: one or many closed grazing areas. */
export type CampBoundary = CampPolygonBoundary | CampMultiPolygonBoundary;

function isFinitePair(p: unknown): p is LatLng {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -90 &&
    p[0] <= 90 &&
    p[1] >= -180 &&
    p[1] <= 180
  );
}

/** Ensure ring is closed and has ≥ 3 unique vertices (4 with close). */
export function normalizeBoundaryRing(points: LatLng[]): LatLng[] | null {
  const cleaned: LatLng[] = [];
  for (const p of points) {
    if (!isFinitePair(p)) continue;
    const lat = Number(p[0].toFixed(6));
    const lng = Number(p[1].toFixed(6));
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev[0] === lat && prev[1] === lng) continue;
    cleaned.push([lat, lng]);
  }
  if (cleaned.length < 3) return null;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleaned.push([first[0], first[1]]);
  }
  if (cleaned.length < 4) return null;
  return cleaned;
}

type RingWithName = { ring: LatLng[]; name?: string };

function trimAreaName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed || undefined;
}

/** Build a stored boundary from one or more rings. */
export function makeBoundaries(
  rings: LatLng[][],
  names?: (string | undefined)[]
): CampBoundary | null {
  const normalized: LatLng[][] = [];
  const normalizedNames: (string | undefined)[] = [];
  rings.forEach((ring, i) => {
    const n = normalizeBoundaryRing(ring);
    if (n) {
      normalized.push(n);
      normalizedNames.push(trimAreaName(names?.[i]));
    }
  });
  if (normalized.length === 0) return null;
  if (normalized.length === 1) {
    return {
      type: "Polygon",
      ring: normalized[0],
      ...(normalizedNames[0] ? { name: normalizedNames[0] } : {}),
    };
  }
  const hasNames = normalizedNames.some(Boolean);
  return {
    type: "MultiPolygon",
    rings: normalized,
    ...(hasNames
      ? { names: normalizedNames.map((n) => n ?? "") }
      : {}),
  };
}

export function makeBoundary(ring: LatLng[]): CampBoundary | null {
  return makeBoundaries([ring]);
}

/** Closed rings from any stored boundary shape. */
export function boundaryRings(b: CampBoundary | null | undefined): LatLng[][] {
  if (!b) return [];
  if (b.type === "MultiPolygon" && Array.isArray(b.rings)) {
    return b.rings.filter((r) => Array.isArray(r) && r.length >= 4);
  }
  if (b.type === "Polygon" && Array.isArray(b.ring)) {
    return b.ring.length >= 4 ? [b.ring] : [];
  }
  return [];
}

/** Open (no closing duplicate) rings for display / editing. */
export function boundaryAreas(b: CampBoundary | null | undefined): LatLng[][] {
  return boundaryRings(b).map(openRingPoints);
}

function openRingPoints(ring: LatLng[]): LatLng[] {
  if (
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    return ring.slice(0, -1);
  }
  return [...ring];
}

export function parseBoundary(value: unknown): CampBoundary | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return parseBoundary(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  if (obj.type === "MultiPolygon" && Array.isArray(obj.rings)) {
    const names = Array.isArray(obj.names)
      ? (obj.names as unknown[]).map((n) =>
          typeof n === "string" ? n : undefined
        )
      : undefined;
    return makeBoundaries(obj.rings as LatLng[][], names);
  }

  if (obj.type === "Polygon" && Array.isArray(obj.ring)) {
    const name =
      typeof obj.name === "string" ? trimAreaName(obj.name) : undefined;
    const ring = makeBoundary(obj.ring as LatLng[]);
    if (!ring) return null;
    if (name && ring.type === "Polygon") return { ...ring, name };
    return ring;
  }

  // GeoJSON Polygon: coordinates[0] is outer ring as [lng, lat]
  if (obj.type === "Polygon" && Array.isArray(obj.coordinates)) {
    const outer = obj.coordinates[0];
    if (!Array.isArray(outer)) return null;
    const ring = outer.map((p) => {
      if (!Array.isArray(p) || p.length < 2) return null;
      return [Number(p[1]), Number(p[0])] as LatLng;
    });
    if (ring.some((p) => p == null)) return null;
    return makeBoundary(ring as LatLng[]);
  }

  // GeoJSON MultiPolygon
  if (obj.type === "MultiPolygon" && Array.isArray(obj.coordinates)) {
    const rings: LatLng[][] = [];
    for (const poly of obj.coordinates) {
      if (!Array.isArray(poly) || !Array.isArray(poly[0])) continue;
      const outer = poly[0] as unknown[];
      const ring: LatLng[] = [];
      for (const p of outer) {
        if (!Array.isArray(p) || p.length < 2) continue;
        ring.push([Number(p[1]), Number(p[0])]);
      }
      rings.push(ring);
    }
    return makeBoundaries(rings);
  }

  // Bare array of [lat,lng] or {lat,lng}
  if (Array.isArray(value)) {
    const ring: LatLng[] = [];
    for (const item of value) {
      if (isFinitePair(item)) {
        ring.push([item[0], item[1]]);
      } else if (
        item &&
        typeof item === "object" &&
        "lat" in item &&
        "lng" in item
      ) {
        const lat = Number((item as { lat: unknown }).lat);
        const lng = Number((item as { lng: unknown }).lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) ring.push([lat, lng]);
      }
    }
    return makeBoundary(ring);
  }
  return null;
}

/** Parse pasted text: "lat,lng" per line or "lat lng" or JSON. */
export function parseBoundaryPaste(text: string): CampBoundary | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const direct = parseBoundary(json);
      if (direct) return direct;
      const items = collectRingsFromGeoJson(json);
      if (items.length) return makeBoundariesFromItems(items);
    } catch {
      /* fall through */
    }
  }
  const ring: LatLng[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || s.toLowerCase().startsWith("lat")) continue;
    const parts = s.split(/[,;\s]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
      ring.push([b, a]);
    } else {
      ring.push([a, b]);
    }
  }
  return makeBoundary(ring);
}

function geoJsonFeatureName(props: unknown): string | undefined {
  if (!props || typeof props !== "object") return undefined;
  const p = props as Record<string, unknown>;
  for (const key of ["name", "Name", "areaName", "label", "title"]) {
    if (typeof p[key] === "string") return trimAreaName(p[key] as string);
  }
  return undefined;
}

function makeBoundariesFromItems(items: RingWithName[]): CampBoundary | null {
  return makeBoundaries(
    items.map((i) => i.ring),
    items.map((i) => i.name)
  );
}

/** Collect every outer polygon ring from GeoJSON (FeatureCollection, MultiPolygon, etc.). */
function collectRingsFromGeoJson(obj: unknown): RingWithName[] {
  const rings: RingWithName[] = [];
  collectRingsInto(obj, rings);
  return rings;
}

function collectRingsInto(
  obj: unknown,
  rings: RingWithName[],
  inheritedName?: string
) {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  if (o.type === "Feature" && o.geometry) {
    const name = geoJsonFeatureName(o.properties) ?? inheritedName;
    collectRingsInto(o.geometry, rings, name);
    return;
  }
  if (o.type === "FeatureCollection" && Array.isArray(o.features)) {
    for (const f of o.features) collectRingsInto(f, rings, inheritedName);
    return;
  }
  if (o.type === "GeometryCollection" && Array.isArray(o.geometries)) {
    for (const g of o.geometries) collectRingsInto(g, rings, inheritedName);
    return;
  }
  if (o.type === "Polygon" && Array.isArray(o.coordinates)) {
    const outer = o.coordinates[0];
    if (Array.isArray(outer)) {
      const ring: LatLng[] = [];
      for (const p of outer) {
        if (Array.isArray(p) && p.length >= 2) {
          ring.push([Number(p[1]), Number(p[0])]);
        }
      }
      if (ring.length >= 3) {
        rings.push({ ring, name: inheritedName });
      }
    }
    return;
  }
  if (o.type === "MultiPolygon" && Array.isArray(o.coordinates)) {
    for (const poly of o.coordinates) {
      if (!Array.isArray(poly) || !Array.isArray(poly[0])) continue;
      const ring: LatLng[] = [];
      for (const p of poly[0] as unknown[]) {
        if (Array.isArray(p) && p.length >= 2) {
          ring.push([Number(p[1]), Number(p[0])]);
        }
      }
      if (ring.length >= 3) {
        rings.push({ ring, name: inheritedName });
      }
    }
    return;
  }
  if (o.type === "LineString" && Array.isArray(o.coordinates)) {
    const ring: LatLng[] = [];
    for (const p of o.coordinates) {
      if (Array.isArray(p) && p.length >= 2) {
        ring.push([Number(p[1]), Number(p[0])]);
      }
    }
    if (ring.length >= 3) rings.push({ ring, name: inheritedName });
  }
}

/** All <coordinates> blocks in KML as separate rings (disconnected areas). */
function parseKmlRings(text: string): LatLng[][] {
  const rings: LatLng[][] = [];
  const re = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const ring: LatLng[] = [];
    const block = match[1].trim();
    for (const token of block.split(/\s+/)) {
      const parts = token.split(",");
      if (parts.length < 2) continue;
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        ring.push([lat, lng]);
      }
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

export function parseBoundaryFile(
  text: string,
  filename: string
): CampBoundary | null {
  const name = filename.toLowerCase();
  if (name.endsWith(".kml") || text.includes("<kml") || text.includes("<KML")) {
    return makeBoundaries(parseKmlRings(text));
  }
  if (
    name.endsWith(".geojson") ||
    name.endsWith(".json") ||
    text.trim().startsWith("{") ||
    text.trim().startsWith("[")
  ) {
    try {
      const json = JSON.parse(text);
      const direct = parseBoundary(json);
      if (direct && boundaryRings(direct).length > 0) return direct;
      const items = collectRingsFromGeoJson(json);
      return makeBoundariesFromItems(items);
    } catch {
      return parseBoundaryPaste(text);
    }
  }
  if (name.endsWith(".gpx") || text.includes("<gpx")) {
    const ring: LatLng[] = [];
    const re = /lat=["']([-\d.]+)["'][^>]*lon=["']([-\d.]+)["']/gi;
    const re2 = /lon=["']([-\d.]+)["'][^>]*lat=["']([-\d.]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      ring.push([parseFloat(m[1]), parseFloat(m[2])]);
    }
    if (ring.length < 3) {
      while ((m = re2.exec(text))) {
        ring.push([parseFloat(m[2]), parseFloat(m[1])]);
      }
    }
    return makeBoundary(ring);
  }
  return parseBoundaryPaste(text);
}

/** @deprecated Prefer boundaryAreas — open vertices of the first / only ring. */
export function openBoundaryRing(b: CampBoundary | null): LatLng[] {
  const areas = boundaryAreas(b);
  return areas[0] ? [...areas[0]] : [];
}

export function boundaryPointCount(b: CampBoundary | null): number {
  return boundaryAreas(b).reduce((sum, a) => sum + a.length, 0);
}

export function boundaryAreaCount(b: CampBoundary | null): number {
  return boundaryRings(b).length;
}

/** User labels for each grazing area (parallel to rings). */
export function boundaryAreaNames(
  b: CampBoundary | null | undefined
): (string | undefined)[] {
  const parsed = parseBoundary(b);
  if (!parsed) return [];
  const count = boundaryRings(parsed).length;
  if (parsed.type === "Polygon") {
    return count > 0 ? [trimAreaName(parsed.name)] : [];
  }
  const names = parsed.names ?? [];
  return Array.from({ length: count }, (_, i) => trimAreaName(names[i]));
}

export function areaDisplayName(
  b: CampBoundary | null,
  index: number,
  fallback: string
): string {
  const name = boundaryAreaNames(b)[index];
  return name || fallback;
}

export function renameBoundaryArea(
  b: CampBoundary | null,
  index: number,
  name: string
): CampBoundary | null {
  const parsed = parseBoundary(b);
  if (!parsed) return null;
  const rings = boundaryRings(parsed);
  if (index < 0 || index >= rings.length) return parsed;
  const names = boundaryAreaNames(parsed);
  names[index] = trimAreaName(name);
  return makeBoundaries(rings, names);
}

/** Centroid of a single open ring (for map labels). */
export function ringCentroid(
  openRing: LatLng[]
): { lat: number; lng: number } | null {
  if (openRing.length === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of openRing) {
    lat += p[0];
    lng += p[1];
  }
  return { lat: lat / openRing.length, lng: lng / openRing.length };
}

export function boundaryCentroid(
  b: CampBoundary | null
): { lat: number; lng: number } | null {
  const areas = boundaryAreas(b);
  if (areas.length === 0) return null;
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const ring of areas) {
    for (const p of ring) {
      lat += p[0];
      lng += p[1];
      n += 1;
    }
  }
  if (n === 0) return null;
  return { lat: lat / n, lng: lng / n };
}

function ringAreaAcres(openRing: LatLng[]): number | null {
  if (openRing.length < 3) return null;
  const R = 6378137;
  let area = 0;
  const n = openRing.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = (openRing[i][0] * Math.PI) / 180;
    const lat2 = (openRing[j][0] * Math.PI) / 180;
    const lng1 = (openRing[i][1] * Math.PI) / 180;
    const lng2 = (openRing[j][1] * Math.PI) / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2);
  const acres = area / 4046.8564224;
  if (!Number.isFinite(acres) || acres <= 0) return null;
  return roundAcres(acres);
}

function roundAcres(acres: number): number {
  if (acres < 100) return Math.round(acres * 100) / 100;
  return Math.round(acres * 10) / 10;
}

/** Acres for a single-ring boundary, or sum of rings (no union). Prefer per-area helpers for multi. */
export function boundaryAreaAcres(b: CampBoundary | null): number | null {
  const areas = boundaryAreas(parseBoundary(b));
  if (areas.length === 0) return null;
  if (areas.length === 1) return ringAreaAcres(areas[0]);
  let sum = 0;
  for (const a of areas) {
    const ac = ringAreaAcres(a);
    if (ac == null) return null;
    sum += ac;
  }
  return roundAcres(sum);
}

export function boundaryPerAreaAcres(
  b: CampBoundary | null
): { index: number; acres: number; corners: number }[] {
  const areas = boundaryAreas(parseBoundary(b));
  const out: { index: number; acres: number; corners: number }[] = [];
  areas.forEach((ring, i) => {
    const acres = ringAreaAcres(ring);
    if (acres != null) {
      out.push({ index: i, acres, corners: ring.length });
    }
  });
  return out;
}

function ringToTurfPolygon(openRing: LatLng[]) {
  const coords = openRing.map(([lat, lng]) => [lng, lat] as [number, number]);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }
  return polygon([coords]);
}

/**
 * Total acres with geometric union so overlapping areas are not double-counted.
 * Falls back to simple sum if union fails.
 */
export function boundaryTotalAcresUnion(b: CampBoundary | null): {
  acres: number | null;
  usedUnion: boolean;
} {
  const areas = boundaryAreas(parseBoundary(b));
  if (areas.length === 0) return { acres: null, usedUnion: false };
  if (areas.length === 1) {
    return { acres: ringAreaAcres(areas[0]), usedUnion: false };
  }

  const sum = areas.reduce((s, a) => s + (ringAreaAcres(a) ?? 0), 0);

  try {
    let combined = ringToTurfPolygon(areas[0]);
    for (let i = 1; i < areas.length; i++) {
      const next = ringToTurfPolygon(areas[i]);
      const u = union(featureCollection([combined, next]));
      if (!u) {
        return { acres: roundAcres(sum), usedUnion: false };
      }
      combined = u as typeof combined;
    }
    const m2 = areaFn(combined);
    const acres = m2 / 4046.8564224;
    if (!Number.isFinite(acres) || acres <= 0) {
      return { acres: roundAcres(sum), usedUnion: false };
    }
    return { acres: roundAcres(acres), usedUnion: true };
  } catch {
    return { acres: roundAcres(sum), usedUnion: false };
  }
}

/** Append areas from `incoming` onto `existing` (import / paste). */
export function addBoundaryAreas(
  existing: CampBoundary | null,
  incoming: CampBoundary | null
): CampBoundary | null {
  const e = parseBoundary(existing);
  const i = parseBoundary(incoming);
  const rings = [...boundaryRings(e), ...boundaryRings(i)];
  const names = [...boundaryAreaNames(e), ...boundaryAreaNames(i)];
  return makeBoundaries(rings, names);
}

export function removeBoundaryArea(
  b: CampBoundary | null,
  index: number
): CampBoundary | null {
  const parsed = parseBoundary(b);
  const rings = boundaryRings(parsed);
  if (index < 0 || index >= rings.length) return parsed;
  rings.splice(index, 1);
  const names = boundaryAreaNames(parsed);
  names.splice(index, 1);
  return makeBoundaries(rings, names);
}

/** GeoJSON FeatureCollection (lng,lat) for download. */
export function toGeoJsonFeatureCollection(
  b: CampBoundary | null
): {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { areaIndex: number; acres: number | null };
    geometry: {
      type: "Polygon";
      coordinates: [number, number][][];
    };
  }[];
} {
  const areas = boundaryAreas(parseBoundary(b));
  const names = boundaryAreaNames(b);
  const features = areas.map((openRing, i) => {
    const coords = openRing.map(
      ([lat, lng]) => [lng, lat] as [number, number]
    );
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first && (first[0] !== last[0] || first[1] !== last[1])) {
      coords.push([first[0], first[1]]);
    }
    return {
      type: "Feature" as const,
      properties: {
        areaIndex: i + 1,
        name: names[i] ?? null,
        acres: ringAreaAcres(openRing),
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
    };
  });
  return { type: "FeatureCollection", features };
}

export function downloadBoundaryGeoJson(
  b: CampBoundary | null,
  filename = "camp-border.geojson"
) {
  const fc = toGeoJsonFeatureCollection(b);
  if (fc.features.length === 0) return false;
  const blob = new Blob([JSON.stringify(fc, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export function formatAcresEstimate(acres: number): string {
  if (acres < 100) return acres.toFixed(2);
  if (acres < 1000) return acres.toFixed(1);
  return String(Math.round(acres));
}

/** All latlngs for fitBounds. */
export function boundaryAllPoints(b: CampBoundary | null): LatLng[] {
  return boundaryAreas(b).flat();
}
