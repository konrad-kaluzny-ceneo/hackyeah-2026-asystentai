import type { PageType } from "../types";
import type { PageTypeRule } from "../config/page-types";

/**
 * Pure, testable URL → PageType classifier. First matching rule wins.
 * Returns "unknown" when nothing matches — never throws.
 */
export function classifyPathname(
  pathname: string,
  rules: readonly PageTypeRule[],
): PageType {
  for (const rule of rules) {
    if (rule.pattern.test(pathname)) {
      return rule.type;
    }
  }
  return "unknown";
}
