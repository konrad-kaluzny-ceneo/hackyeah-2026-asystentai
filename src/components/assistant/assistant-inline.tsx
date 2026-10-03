"use client";

import { useEffect, useState } from "react";

import {
  CATALOG_SESSION_CHANGED,
  muteAssistantFor,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { DecisionEngine } from "@/lib/decision-engine";
import {
  setAssistantSearchRecoveryVisible,
  setAssistantServerProposal,
} from "@/lib/assistant-proposal-state";
import type { AssistantProposal, CatalogState, Category, Product } from "@/lib/catalog-types";

const MUTE_DURATION_MS = 15 * 60 * 1000;
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

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    setAssistantServerProposal(null);
    setAssistantSearchRecoveryVisible(false);
    setMuted(true);
    setLocalProposal(null);
  };

  if (muted || !proposal) return null;

  const recommendsFilters = proposal.action === "narrow-choice";

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-popover={recommendsFilters ? "filters" : undefined}
      className="fixed top-40 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-sky-200 bg-white p-5 pr-12 text-slate-900 shadow-2xl ring-1 ring-slate-900/5 sm:top-32 lg:top-28"
      role="status"
    >
      <button
        type="button"
        aria-label="Zamknij podpowiedź na 15 minut"
        data-element-id="assistant-dismiss"
        className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-sky-100 hover:text-slate-900"
        onClick={dismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
        Podpowiedź asystenta
      </p>
      <h2 id="assistant-proposal-title" className="text-base font-semibold">
        {proposal.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">{proposal.message}</p>
      {proposal.action === "clear-search-and-filters" ? (
        <button
          type="button"
          onClick={onClearSearchAndFilters}
          data-element-id="assistant-action"
          className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
        >
          {proposal.actionLabel}
        </button>
      ) : (
        <a
          href="#filters"
          data-element-id="assistant-action"
          className="mt-3 inline-flex rounded-lg border border-sky-800 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
        >
          {proposal.actionLabel}
        </a>
      )}
    </aside>
  );
}
