import type { PageType } from "../types";

export type PageTypeRule = Readonly<{
  type: PageType;
  pattern: RegExp;
}>;

/**
 * URL → PageType rules. Ordered: the FIRST matching rule wins.
 *
 * Keep in sync with real routes in `src/app/`. As of 2026-10-03 only
 * `/` and `/katalog` exist; everything else falls through to "unknown".
 * See docs/adding-page-type.md for how to extend.
 */
export const PAGE_TYPE_RULES: readonly PageTypeRule[] = [
  { type: "home", pattern: /^\/$/ },
  { type: "catalog", pattern: /^\/katalog(?:\/|$)/ },
  // Future routes (reserved; do not enable until the corresponding
  // route exists in src/app/):
  // { type: "search", pattern: /^\/search(?:\/|$)/ },
  // { type: "category", pattern: /^\/kategoria(?:\/|$)/ },
  // { type: "product", pattern: /^\/produkt(?:\/|$)/ },
] as const;
