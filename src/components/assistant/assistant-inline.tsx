"use client";

import { useEffect, useState } from "react";
import {
  CATALOG_SESSION_CHANGED,
  muteAssistantFor,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { DecisionEngine } from "@/lib/decision-engine";
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
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);

  useEffect(() => {
    let muteTimer: number | undefined;
    const refreshProposal = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);

      const mutedUntil = readAssistantMutedUntil();
      if (mutedUntil > Date.now()) {
        setProposal(null);
        muteTimer = window.setTimeout(refreshProposal, mutedUntil - Date.now());
        return;
      }
      setProposal(DecisionEngine(readCatalogEvents(), state, catalog));
    };

    refreshProposal();
    window.addEventListener(CATALOG_SESSION_CHANGED, refreshProposal);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, refreshProposal);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
    };
  }, [catalog, state]);

  if (!proposal) return null;

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    setProposal(null);
  };

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      className="relative my-6 rounded-xl border border-sky-200 bg-sky-50 p-5 pr-12 text-slate-900 shadow-sm"
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
      {proposal.kind === "search_friction" ? (
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
