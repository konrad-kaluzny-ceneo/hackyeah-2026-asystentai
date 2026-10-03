import type { PageType } from "../types";

export type PageTypeRule = Readonly<{
  type: PageType;
  pattern: RegExp;
}>;

/**
 * URL → PageType rules. Ordered: the FIRST matching rule wins.
 *
<<<<<<< HEAD
 * Keep in sync with the real routes in `src/app/`.
=======
 * Keep in sync with real routes in `src/app/`.
>>>>>>> origin/main
 * See docs/adding-page-type.md for how to extend.
 */
export const PAGE_TYPE_RULES: readonly PageTypeRule[] = [
  { type: "home", pattern: /^\/$/ },
  { type: "product", pattern: /^\/produkt(?:\/|$)/ },
  { type: "catalog", pattern: /^\/katalog(?:\/|$)/ },
<<<<<<< HEAD
  // Search is represented by the existing Polish /katalog route and its
  // query is never included in the sanitized route template.
=======
  { type: "product", pattern: /^\/produkt(?:\/|$)/ },
>>>>>>> origin/main
] as const;
