import type { PageType } from "../types";

export type PageTypeRule = Readonly<{
  type: PageType;
  pattern: RegExp;
}>;

/**
 * URL → PageType rules. Ordered: the FIRST matching rule wins.
 *
 * Keep in sync with the real routes in `src/app/`.
 * See docs/adding-page-type.md for how to extend.
 */
export const PAGE_TYPE_RULES: readonly PageTypeRule[] = [
  { type: "home", pattern: /^\/$/ },
  { type: "product", pattern: /^\/produkt(?:\/|$)/ },
  { type: "catalog", pattern: /^\/katalog(?:\/|$)/ },
  // Search is represented by the existing Polish /katalog route and its
  // query is never included in the sanitized route template.
] as const;
