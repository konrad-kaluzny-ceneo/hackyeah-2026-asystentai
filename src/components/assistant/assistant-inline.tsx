"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CATALOG_SESSION_CHANGED,
  muteAssistantFor,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { DecisionEngine } from "@/lib/decision-engine";
import {
  MAX_ASSISTANT_PROPOSAL_EVENTS,
  safeParseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import {
  getAssistantMetaEventHistory,
  subscribeAssistantMetaEventHistory,
} from "@/behavior/assistant-meta-event-history";
import type { MetaEvent } from "@/behavior/types";
import type { AssistantProposal, CatalogState, Category, Product } from "@/lib/catalog-types";

const MUTE_DURATION_MS = 15 * 60 * 1000;
const EMPTY_META_EVENT_HISTORY: readonly MetaEvent[] = [];

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
  const [decision, setDecision] = useState<AssistantProposal | null>(null);
  const [muted, setMuted] = useState(false);
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const recentMetaEvents = useSyncExternalStore(
    subscribeAssistantMetaEventHistory,
    getAssistantMetaEventHistory,
    () => EMPTY_META_EVENT_HISTORY,
  );
  const recentMetaEventsRef = useRef(recentMetaEvents);
  const decisionRef = useRef(decision);
  const mutedRef = useRef(muted);
  const requestedFatigueIdsRef = useRef(new Set<string>());
  const hasMetaEvents = recentMetaEvents.length > 0;

  useEffect(() => {
    recentMetaEventsRef.current = recentMetaEvents;
    decisionRef.current = decision;
    mutedRef.current = muted;
  }, [decision, muted, recentMetaEvents]);

  useEffect(() => {
    let muteTimer: number | undefined;
    const refreshDecision = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);

      const mutedUntil = readAssistantMutedUntil();
      if (mutedUntil > Date.now()) {
        setMuted(true);
        setDecision(null);
        setProposal(null);
        muteTimer = window.setTimeout(
          refreshDecision,
          mutedUntil - Date.now(),
        );
        return;
      }

      setMuted(false);
      const nextDecision = DecisionEngine(readCatalogEvents(), state, catalog);
      setDecision((current) =>
        current?.id === nextDecision?.id && current?.kind === nextDecision?.kind
          ? current
          : nextDecision,
      );
    };

    refreshDecision();
    window.addEventListener(CATALOG_SESSION_CHANGED, refreshDecision);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, refreshDecision);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
    };
  }, [catalog, state]);

  useEffect(() => {
    if (decision === null) {
      return;
    }

    if (decision.kind === "search_friction") return;

    if (
      muted ||
      !hasMetaEvents ||
      requestedFatigueIdsRef.current.has(decision.id)
    ) {
      return;
    }

    const request = new AbortController();
    let isCurrentRequest = true;
    // Deferring one task lets React clean up a replayed effect before it sends
    // anything, while the ID set still limits a real trigger to one request.
    const requestTimer = window.setTimeout(() => {
      if (
        !isCurrentRequest ||
        request.signal.aborted ||
        decisionRef.current?.id !== decision.id ||
        mutedRef.current
      ) {
        return;
      }

      const metaEvents = recentMetaEventsRef.current.slice(
        -MAX_ASSISTANT_PROPOSAL_EVENTS,
      );
      if (metaEvents.length === 0) return;

      requestedFatigueIdsRef.current.add(decision.id);
      void fetch("/api/assistant-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ metaEvents }),
        signal: request.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const body: unknown = await response.json();
          const parsed = safeParseAssistantProposalResponse(body);
          if (
            !isCurrentRequest ||
            decisionRef.current?.id !== decision.id ||
            mutedRef.current ||
            !parsed.success ||
            parsed.data.status !== "show"
          ) {
            return;
          }

          setProposal({
            id: decision.id,
            kind: "decision_fatigue",
            title: parsed.data.title,
            message: parsed.data.message,
            actionLabel: parsed.data.actionLabel,
            action: parsed.data.action,
            createdAt: decision.createdAt,
          });
        })
        .catch(() => {
          // Network errors and aborts keep the fatigue proposal hidden.
        });
    }, 0);

    return () => {
      isCurrentRequest = false;
      window.clearTimeout(requestTimer);
      request.abort();
    };
  }, [decision, hasMetaEvents, muted]);

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    mutedRef.current = true;
    decisionRef.current = null;
    setMuted(true);
    setDecision(null);
    setProposal(null);
  };

  const visibleProposal =
    decision?.kind === "search_friction"
      ? decision
      : proposal?.id === decision?.id
        ? proposal
        : null;
  if (!visibleProposal) return null;

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
        {visibleProposal.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">{visibleProposal.message}</p>
      {visibleProposal.kind === "search_friction" ? (
        <button
          type="button"
          onClick={onClearSearchAndFilters}
          data-element-id="assistant-action"
          className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
        >
          {visibleProposal.actionLabel}
        </button>
      ) : (
        <a
          href="#filters"
          data-element-id="assistant-action"
          className="mt-3 inline-flex rounded-lg border border-sky-800 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
        >
          {visibleProposal.actionLabel}
        </a>
      )}
    </aside>
  );
}
