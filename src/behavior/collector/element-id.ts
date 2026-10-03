/**
 * Resolves a stable, semantic identifier for a DOM element without capturing
 * user text. Returns `undefined` when nothing usable exists (callers then
 * treat the event as anonymous).
 *
 * Priority:
 *  1. `data-element-id` (explicit, application-controlled)
 *  2. `aria-label` (already curated for accessibility) — hashed
 *  3. Semantic signal: `role` or tag name — never hashed, no user content
 *
 * We never fall back to `innerText` or `value` attributes.
 */
export function semanticElementId(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const explicit = target.closest("[data-element-id]");
  if (explicit !== null) {
    const value = explicit.getAttribute("data-element-id");
    if (value !== null && value.length > 0) {
      return truncate(value);
    }
  }
  const aria = target.closest("[aria-label]");
  if (aria !== null) {
    const label = aria.getAttribute("aria-label");
    if (label !== null && label.length > 0) {
      return `aria:${stableHash(truncate(label))}`;
    }
  }
  const roleTarget = target.closest("[role]");
  if (roleTarget !== null) {
    const role = roleTarget.getAttribute("role");
    if (role !== null && role.length > 0) {
      return `role:${truncate(role)}`;
    }
  }
  // Last resort: a sanitized tag name so we still get "button" vs "a" signals.
  const tag = target.tagName.toLowerCase();
  if (tag === "button" || tag === "a" || tag === "input" || tag === "select") {
    return `tag:${tag}`;
  }
  return undefined;
}

/** Bucketed scroll depth: 0, 25, 50, 75, 100. */
export function scrollDepthBucket(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 0;
  }
  if (ratio >= 1) {
    return 100;
  }
  return Math.round((ratio * 4)) * 25;
}

function truncate(value: string): string {
  return value.length > 96 ? value.slice(0, 96) : value;
}

/** Tiny non-cryptographic hash, only used to shorten aria labels. */
function stableHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  }
  // Force unsigned and trim.
  return (h >>> 0).toString(36);
}
