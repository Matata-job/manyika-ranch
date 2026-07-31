/** Suggest the next eartag for a camp from existing tags + optional camp code. */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prefer `CAMPCODE-NNN` (e.g. MR-01-042 → MR-01-043).
 * If no camp code, reuse the most common prefix that ends with digits among camp tags.
 */
export function suggestNextEartag(opts: {
  campCode?: string | null;
  existingEartags: string[];
}): string | null {
  const tags = opts.existingEartags
    .map((t) => t.trim())
    .filter(Boolean);

  const code = opts.campCode?.trim();
  if (code) {
    const re = new RegExp(`^${escapeRegex(code)}-(\\d+)$`, "i");
    let max = 0;
    let width = 3;
    let found = false;
    for (const tag of tags) {
      const m = tag.match(re);
      if (!m) continue;
      found = true;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= max) {
        max = n;
        width = Math.max(width, m[1].length);
      }
    }
    return `${code.toUpperCase()}-${String(max + 1).padStart(width, "0")}`;
  }

  // No camp code: find tags ending in digits, pick highest numeric suffix with same prefix
  type Hit = { prefix: string; n: number; width: number };
  let best: Hit | null = null;
  for (const tag of tags) {
    const m = tag.match(/^(.*?)(\d+)$/);
    if (!m) continue;
    const prefix = m[1];
    const width = m[2].length;
    const n = parseInt(m[2], 10);
    if (!Number.isFinite(n)) continue;
    if (!best || n > best.n || (n === best.n && prefix.length >= best.prefix.length)) {
      // Prefer the highest number; if tie, longer (more specific) prefix
      if (!best || n > best.n) best = { prefix, n, width };
      else if (n === best.n && prefix.length > best.prefix.length) {
        best = { prefix, n, width };
      }
    }
  }

  if (!best) return null;
  return `${best.prefix}${String(best.n + 1).padStart(best.width, "0")}`;
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
