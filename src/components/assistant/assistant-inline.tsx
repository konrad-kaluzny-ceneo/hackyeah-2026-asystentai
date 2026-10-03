"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CATALOG_SESSION_CHANGED,
  muteAssistantFor,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { DecisionEngine } from "@/lib/decision-engine";
import { safeParseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import {
  clearAssistantProposalTriggers,
  getAssistantMetaEventHistory,
  requeueAssistantProposalTrigger,
  subscribeAssistantMetaEventHistory,
  takeAssistantProposalTrigger,
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
  const decisionRef = useRef(decision);
  const mutedRef = useRef(muted);
  const requestAllowedRef = useRef(false);
  const mountedRef = useRef(false);
  const workerActiveRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const activeTriggerRef = useRef<ReturnType<typeof takeAssistantProposalTrigger>>(null);
  const requestAllowed =
    !muted && decision?.kind !== "search_friction" && proposal === null;

  useEffect(() => {
    decisionRef.current = decision;
    mutedRef.current = muted;
    requestAllowedRef.current = requestAllowed;
  }, [decision, muted, recentMetaEvents, requestAllowed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestAllowedRef.current = false;
      const activeTrigger = activeTriggerRef.current;
      if (activeTrigger !== null) {
        requeueAssistantProposalTrigger(activeTrigger);
        activeTriggerRef.current = null;
      }
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let muteTimer: number | undefined;
    const refreshDecision = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);

      const mutedUntil = readAssistantMutedUntil();
      if (mutedUntil > Date.now()) {
        mutedRef.current = true;
        requestAllowedRef.current = false;
        clearAssistantProposalTriggers();
        activeControllerRef.current?.abort();
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
      mutedRef.current = false;
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

  const drainProposalTriggers = useCallback(async (): Promise<void> => {
    if (workerActiveRef.current) return;
    workerActiveRef.current = true;

    try {
      while (mountedRef.current && requestAllowedRef.current) {
        const trigger = takeAssistantProposalTrigger();
        if (trigger === null) return;

        const controller = new AbortController();
        activeTriggerRef.current = trigger;
        activeControllerRef.current = controller;

        try {
          const response = await fetch("/api/assistant-proposal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ metaEvents: trigger.metaEvents }),
            signal: controller.signal,
          });
          if (!response.ok || !mountedRef.current) continue;

          const body: unknown = await response.json();
          const parsed = safeParseAssistantProposalResponse(body);
          if (
            !requestAllowedRef.current ||
            !parsed.success ||
            parsed.data.status !== "show"
          ) {
            continue;
          }

          requestAllowedRef.current = false;
          clearAssistantProposalTriggers();
          const clearsCatalog =
            parsed.data.action === "clear-search-and-filters";
          const localDecision =
            decisionRef.current?.kind === "decision_fatigue"
              ? decisionRef.current
              : null;
          setProposal({
            id: `jev-proposal:${trigger.eventId}`,
            kind: "jev_proposal",
            title: clearsCatalog
              ? "Zacznij od pełnego katalogu"
              : localDecision?.title ?? "Pomóc zawęzić wybór?",
            message: clearsCatalog
              ? "Wyczyść wyszukiwanie i filtry, aby ponownie zobaczyć pełną ofertę."
              : localDecision?.message ??
                "Na podstawie ostatniej aktywności warto zawęzić wybór.",
            actionLabel: clearsCatalog
              ? "Wyczyść wyszukiwanie i filtry"
              : localDecision?.actionLabel ?? "Przejdź do filtrów",
            action: parsed.data.action,
            data: parsed.data.data,
            createdAt:
              trigger.metaEvents.at(-1)?.detectedAt ??
              new Date().toISOString(),
          });
          return;
        } catch {
          // Network failures and aborted requests keep the proposal hidden.
        } finally {
          if (activeControllerRef.current === controller) {
            activeControllerRef.current = null;
            activeTriggerRef.current = null;
          }
        }
      }
    } finally {
      workerActiveRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!requestAllowed) {
      clearAssistantProposalTriggers();
      activeControllerRef.current?.abort();
      return;
    }

    let isCurrentEffect = true;
    const requestTimer = window.setTimeout(() => {
      if (!isCurrentEffect || !mountedRef.current) return;
      void drainProposalTriggers();
    }, 0);

    return () => {
      isCurrentEffect = false;
      window.clearTimeout(requestTimer);
    };
  }, [drainProposalTriggers, recentMetaEvents, requestAllowed]);

  const visibleProposal = muted
    ? null
    : decision?.kind === "search_friction"
      ? decision
      : proposal;

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    mutedRef.current = true;
    requestAllowedRef.current = false;
    clearAssistantProposalTriggers();
    activeControllerRef.current?.abort();
    decisionRef.current = null;
    setMuted(true);
    setDecision(null);
    setProposal(null);
  };

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
      {visibleProposal.action === "clear-search-and-filters" ? (
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
