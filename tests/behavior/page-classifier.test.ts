import { describe, expect, it } from "vitest";

import { PAGE_TYPE_RULES } from "@/behavior/config/page-types";
import { classifyPathname } from "@/behavior/page-classifier/classifier";

describe("classifyPathname", () => {
  it("classifies the home page", () => {
    expect(classifyPathname("/", PAGE_TYPE_RULES)).toBe("home");
  });

  it("classifies /katalog without query", () => {
    expect(classifyPathname("/katalog", PAGE_TYPE_RULES)).toBe("catalog");
    expect(classifyPathname("/katalog/", PAGE_TYPE_RULES)).toBe("catalog");
  });

  it("returns 'unknown' for routes that don't exist in the app yet", () => {
    // Spec examples mention /search, /product, etc. — none of them exist in
    // src/app/, so they must classify as 'unknown' rather than be guessed.
    expect(classifyPathname("/search", PAGE_TYPE_RULES)).toBe("unknown");
    expect(classifyPathname("/product/pralka-x", PAGE_TYPE_RULES)).toBe(
      "unknown",
    );
    expect(classifyPathname("/cart", PAGE_TYPE_RULES)).toBe("unknown");
  });

  it("returns 'unknown' for arbitrary paths", () => {
    expect(classifyPathname("/admin", PAGE_TYPE_RULES)).toBe("unknown");
    expect(classifyPathname("/katalog-extra", PAGE_TYPE_RULES)).toBe("unknown");
  });

  it("first matching rule wins (order matters)", () => {
    const customRules = [
      { type: "catalog" as const, pattern: /^\/katalog/ },
      { type: "home" as const, pattern: /^\/$/ },
    ];
    expect(classifyPathname("/katalog/produkty", customRules)).toBe("catalog");
    expect(classifyPathname("/", customRules)).toBe("home");
  });
});
