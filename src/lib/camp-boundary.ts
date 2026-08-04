/** Camp border as closed [lat, lng] ring (Leaflet order). */
export type CampBoundary = {
  type: "Polygon";
  ring: [number, number][];
};

export type LatLng = [number, number];

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

export function makeBoundary(ring: LatLng[]): CampBoundary | null {
  const normalized = normalizeBoundaryRing(ring);
  if (!normalized) return null;
  return { type: "Polygon", ring: normalized };
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
  if (obj.type === "Polygon" && Array.isArray(obj.ring)) {
    return makeBoundary(obj.ring as LatLng[]);
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

/** Parse pasted text: "lat,lng" per line or "lat lng" or JSON array. */
export function parseBoundaryPaste(text: string): CampBoundary | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return parseBoundary(JSON.parse(trimmed));
    } catch {
      /* fall through to line parse */
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
    // Heuristic: if |a| > 90, treat as lng,lat
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
      ring.push([b, a]);
    } else {
      ring.push([a, b]);
    }
  }
  return makeBoundary(ring);
}

function collectCoordsFromGeoJson(obj: unknown, out: LatLng[]) {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  if (o.type === "Feature" && o.geometry) {
    collectCoordsFromGeoJson(o.geometry, out);
    return;
  }
  if (o.type === "FeatureCollection" && Array.isArray(o.features)) {
    for (const f of o.features) collectCoordsFromGeoJson(f, out);
    return;
  }
  if (o.type === "Polygon" && Array.isArray(o.coordinates)) {
    const outer = o.coordinates[0];
    if (Array.isArray(outer)) {
      for (const p of outer) {
        if (Array.isArray(p) && p.length >= 2) {
          out.push([Number(p[1]), Number(p[0])]);
        }
      }
    }
    return;
  }
  if (o.type === "MultiPolygon" && Array.isArray(o.coordinates)) {
    const first = o.coordinates[0]?.[0];
    if (Array.isArray(first)) {
      for (const p of first) {
        if (Array.isArray(p) && p.length >= 2) {
          out.push([Number(p[1]), Number(p[0])]);
        }
      }
    }
    return;
  }
  if (o.type === "LineString" && Array.isArray(o.coordinates)) {
    for (const p of o.coordinates) {
      if (Array.isArray(p) && p.length >= 2) {
        out.push([Number(p[1]), Number(p[0])]);
      }
    }
  }
}

/** Very light KML coordinate scrape (no full XML parser). */
function parseKmlCoordinates(text: string): LatLng[] {
  const ring: LatLng[] = [];
  const re = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
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
    if (ring.length >= 3) break;
  }
  return ring;
}

export function parseBoundaryFile(
  text: string,
  filename: string
): CampBoundary | null {
  const name = filename.toLowerCase();
  if (name.endsWith(".kml") || text.includes("<kml") || text.includes("<KML")) {
    return makeBoundary(parseKmlCoordinates(text));
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
      if (direct) return direct;
      const collected: LatLng[] = [];
      collectCoordsFromGeoJson(json, collected);
      return makeBoundary(collected);
    } catch {
      return parseBoundaryPaste(text);
    }
  }
  // CSV / GPX-ish / plain text
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

export function boundaryPointCount(b: CampBoundary | null): number {
  if (!b?.ring?.length) return 0;
  // exclude closing duplicate
  const ring = b.ring;
  if (
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
  ) {
    return ring.length - 1;
  }
  return ring.length;
}

export function boundaryCentroid(
  b: CampBoundary | null
): { lat: number; lng: number } | null {
  if (!b?.ring?.length) return null;
  let n = b.ring.length;
  let ring = b.ring;
  if (
    n >= 2 &&
    ring[0][0] === ring[n - 1][0] &&
    ring[0][1] === ring[n - 1][1]
  ) {
    ring = ring.slice(0, -1);
    n = ring.length;
  }
  if (n === 0) return null;
  let lat = 0;
  let lng = 0;
  for (const p of ring) {
    lat += p[0];
    lng += p[1];
  }
  return { lat: lat / n, lng: lng / n };
}
