"use client";

import { trackCatalogEvent } from "@/lib/assistant-events";

type CatalogSearchFormProps = {
  action?: string;
  categorySlug?: string | null;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
};

export function CatalogSearchForm({
  action = "/katalog",
  categorySlug = null,
  placeholder = "Szukaj w katalogu",
  buttonLabel = "Szukaj",
  className = "",
}: CatalogSearchFormProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        trackCatalogEvent({
          type: "search_changed",
          categorySlug,
          query: String(data.get("q") ?? ""),
        });
      }}
      className={className}
    >
      <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
        <span aria-hidden="true" className="text-xl text-catalog-focus">⌕</span>
        <span className="sr-only">Czego szukasz?</span>
        <input name="q" className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-placeholder" placeholder={placeholder} />
      </label>
      <button className="rounded-xl bg-catalog-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-catalog-primary-hover" type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
