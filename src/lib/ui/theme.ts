/**
 * Wspólne klasy UI oparte o tokeny z `src/app/globals.css` (@theme).
 * Zmiana palety: edytuj `:root` w globals.css — komponenty podążą za tokenami.
 */
export const ui = {
  btnCatalogPrimary:
    "inline-flex items-center justify-center rounded-xl bg-catalog-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-catalog-primary-hover active:scale-[0.98]",
  btnCatalogOutline:
    "inline-flex items-center justify-center rounded-xl border border-catalog-primary bg-surface px-4 py-2 text-sm font-semibold text-catalog-primary transition hover:bg-catalog-chip active:scale-[0.98]",
  btnAssistantPrimary:
    "inline-flex items-center justify-center rounded-xl bg-assistant px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-assistant-hover active:scale-[0.98]",
  btnAssistantWide:
    "flex w-full items-center justify-center gap-2 rounded-xl bg-assistant px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-assistant-hover active:scale-[0.98]",
  linkCatalog: "font-semibold text-catalog-link transition hover:text-catalog-primary-hover hover:underline",
  linkSubtle: "text-muted transition hover:text-catalog-link",
  chip: "rounded-full bg-catalog-chip px-2.5 py-1 text-[11px] font-semibold text-catalog-chip-text",
  chipAssistant:
    "rounded-full bg-assistant-chip px-2.5 py-1 text-[11px] font-semibold text-assistant-hover",
  panel: "rounded-2xl border border-border bg-surface shadow-soft",
  panelAssistant: "assistant-panel rounded-2xl border bg-surface shadow-soft",
  labelAssistant:
    "inline-flex items-center gap-1.5 rounded-full bg-assistant-chip px-2.5 py-0.5 text-[11px] font-semibold text-assistant-hover",
  dismissButton:
    "rounded-full p-1.5 text-subtle transition hover:bg-catalog-chip hover:text-catalog-primary",
  price: "font-bold text-price",
  headingPage: "font-semibold tracking-tight text-heading",
  textMuted: "text-sm leading-6 text-muted",
  foxIconWrap:
    "relative flex shrink-0 items-center justify-center rounded-xl border border-assistant-border bg-assistant-chip p-1",
  tipBox: "rounded-xl border border-tip-border bg-tip px-4 py-3",
} as const;
