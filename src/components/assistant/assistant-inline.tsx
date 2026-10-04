"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import {
  CATALOG_SESSION_CHANGED,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { DecisionEngine } from "@/lib/decision-engine";
import {
  setAssistantSearchRecoveryVisible,
  setAssistantServerProposal,
} from "@/lib/assistant-proposal-state";
import type { AssistantProposal, CatalogState, Category, Product } from "@/lib/catalog-types";

type AssistantInlineProps = {
  state: CatalogState;
  catalog: { categories: Category[]; products: Product[] };
  onClearSearchAndFilters: () => void;
};

export function AssistantInline({
  state,
  catalog,
  onClearSearchAndFilters,
}: AssistantInlineProps) {
  const [localProposal, setLocalProposal] = useState<AssistantProposal | null>(null);
  const [muted, setMuted] = useState(false);
  const proposal = localProposal;

  useEffect(() => {
    let muteTimer: number | undefined;
    const refreshProposal = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);

      const mutedUntil = readAssistantMutedUntil();
      if (mutedUntil > Date.now()) {
        setMuted(true);
        setLocalProposal(null);
        setAssistantServerProposal(null);
        setAssistantSearchRecoveryVisible(false);
        muteTimer = window.setTimeout(
          refreshProposal,
          mutedUntil - Date.now(),
        );
        return;
      }

      setMuted(false);
      const hasActiveEmptySearch =
        state.resultCount === 0 &&
        (state.query.trim().length > 0 ||
          Object.values(state.filters).some((value) => value.trim().length > 0));
      const localRecovery = hasActiveEmptySearch
        ? DecisionEngine(readCatalogEvents(), state, catalog)
        : null;
      const isSearchRecovery = localRecovery?.kind === "search_friction";
      setAssistantSearchRecoveryVisible(isSearchRecovery);
      if (isSearchRecovery) setAssistantServerProposal(null);
      setLocalProposal(isSearchRecovery ? localRecovery : null);
    };

    refreshProposal();
    window.addEventListener(CATALOG_SESSION_CHANGED, refreshProposal);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, refreshProposal);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      setAssistantSearchRecoveryVisible(false);
    };
  }, [catalog, state]);

  if (muted || !proposal) return null;

  const recommendsFilters = proposal.action === "narrow-choice";

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-popover={recommendsFilters ? "filters" : undefined}
      className="assistant-proposal-enter relative mb-6 w-full overflow-hidden rounded-2xl border border-purple-200/90 bg-gradient-to-br from-purple-50/90 via-white to-violet-50/80 p-5 shadow-[0_8px_25px_rgba(109,40,217,0.08)] sm:p-6"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="relative shrink-0 flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-b from-purple-100/70 to-violet-100/80 border border-purple-200/80 p-1.5 shadow-inner">
          <Image
            src="/illustrations/assistant-fox/fox-guiding.png"
            alt="Lisek wskazuje następny krok"
            width={80}
            height={80}
            sizes="80px"
            className="h-full w-full object-contain"
            priority
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-600 ring-2 ring-white" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/60 bg-purple-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
              Podpowiedź asystenta · dobre.agd
            </span>
          </div>
          <h2 id="assistant-proposal-title" className="text-base sm:text-lg font-bold tracking-tight text-[#181126]">
            {proposal.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[#6b617a]">
            {proposal.message}
          </p>
        </div>

        <div className="shrink-0 sm:self-center">
          {proposal.action === "clear-search-and-filters" ? (
            <button
              type="button"
              onClick={onClearSearchAndFilters}
              data-element-id="assistant-action"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-700 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:from-purple-800 hover:to-purple-700 active:scale-[0.98]"
            >
              {proposal.actionLabel}
            </button>
          ) : (
            <a
              href="#filters"
              data-element-id="assistant-action"
              className="inline-flex items-center justify-center rounded-xl border border-purple-600 bg-white px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50/60 transition active:scale-[0.98]"
            >
              {proposal.actionLabel}
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
