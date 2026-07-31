/** Suggest the next free eartag for a camp from existing tags + optional camp code. */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usedSet(tags: string[]): Set<string> {
  return new Set(tags.map((t) => t.trim().toUpperCase()).filter(Boolean));
}

function isTaken(used: Set<string>, tag: string): boolean {
  return used.has(tag.trim().toUpperCase());
}

/** Find next free number starting at `start` (inclusive), same prefix/width. */
function nextFreeNumber(
  used: Set<string>,
  build: (n: number) => string,
  start: number,
  maxAttempts = 10000
): string | null {
  for (let i = 0; i < maxAttempts; i++) {
    const tag = build(start + i);
    if (!isTaken(used, tag)) return tag;
  }
  return null;
}

/**
 * Prefer `CAMPCODE-NNN` (e.g. MR-01-042 → MR-01-043).
 * Sequence is derived from `sequenceEartags` (usually this camp);
 * collisions are skipped against `existingEartags` (usually whole ranch).
 */
export function suggestNextEartag(opts: {
  campCode?: string | null;
  /** All occupied eartags (ranch-wide). Used for uniqueness. */
  existingEartags: string[];
  /** Tags that define this camp's numbering sequence. Defaults to existingEartags. */
  sequenceEartags?: string[];
}): string | null {
  const occupied = opts.existingEartags.map((t) => t.trim()).filter(Boolean);
  const sequence = (opts.sequenceEartags ?? opts.existingEartags)
    .map((t) => t.trim())
    .filter(Boolean);
  const used = usedSet(occupied);

  const code = opts.campCode?.trim();
  if (code) {
    const upper = code.toUpperCase();
    const re = new RegExp(`^${escapeRegex(upper)}-(\\d+)$`, "i");
    let max = 0;
    let width = 3;
    for (const tag of sequence) {
      const m = tag.match(re);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= max) {
        max = n;
        width = Math.max(width, m[1].length);
      }
    }
    // Also scan occupied ranch tags with this code (in case animal moved camps)
    for (const tag of occupied) {
      const m = tag.match(re);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= max) {
        max = n;
        width = Math.max(width, m[1].length);
      }
    }
    return nextFreeNumber(
      used,
      (n) => `${upper}-${String(n).padStart(width, "0")}`,
      max + 1
    );
  }

  type Hit = { prefix: string; n: number; width: number };
  let best: Hit | null = null;
  for (const tag of sequence) {
    const m = tag.match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const prefix = m[1];
    const width = m[2].length;
    const n = parseInt(m[2], 10);
    if (!Number.isFinite(n)) continue;
    if (!best || n > best.n) best = { prefix, n, width };
    else if (n === best.n && prefix.length > best.prefix.length) {
      best = { prefix, n, width };
    }
  }

  if (!best) return null;
  const { prefix, width } = best;
  return nextFreeNumber(
    used,
    (n) => `${prefix}${String(n).padStart(width, "0")}`,
    best.n + 1
  );
}

/** True if this eartag is already used (case-insensitive). */
export function eartagExists(eartag: string, existingEartags: string[]): boolean {
  return isTaken(usedSet(existingEartags), eartag);
}

/** Remember last assigned eartag per camp in localStorage (helps offline). */
const LAST_EARTAG_KEY = "manyika.lastEartagByCamp";

export function rememberCampEartag(campId: string, eartag: string) {
  try {
    const raw = localStorage.getItem(LAST_EARTAG_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[campId] = eartag.trim();
    localStorage.setItem(LAST_EARTAG_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function recallCampEartag(campId: string): string | null {
  try {
    const raw = localStorage.getItem(LAST_EARTAG_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[campId] || null;
  } catch {
    return null;
  }
}
