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
  const [localProposal, setLocalProposal] = useState<AssistantProposal | null>(null);
  const [muted, setMuted] = useState(false);
  const [serverProposal, setServerProposal] = useState<AssistantProposal | null>(null);
  const recentMetaEvents = useSyncExternalStore(
    subscribeAssistantMetaEventHistory,
    getAssistantMetaEventHistory,
    () => EMPTY_META_EVENT_HISTORY,
  );
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const requestAllowedRef = useRef(false);
  const mountedRef = useRef(false);
  const workerActiveRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const activeTriggerRef = useRef<ReturnType<typeof takeAssistantProposalTrigger>>(null);
  const proposal = localProposal ?? serverProposal;
  const requestAllowed = !muted && localProposal === null && serverProposal === null;
  requestAllowedRef.current = requestAllowed;

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
        setMuted(true);
        setLocalProposal(null);
        setServerProposal(null);
        muteTimer = window.setTimeout(
          refreshDecision,
          mutedUntil - Date.now(),
        );
        return;
      }

      setMuted(false);
      mutedRef.current = false;
      const hasActiveEmptySearch =
        state.resultCount === 0 &&
        (state.query.trim().length > 0 ||
          Object.values(state.filters).some((value) => value.trim().length > 0));
      // DecisionEngine's first and only eligible branch here is local
      // search_friction. The client never evaluates its fatigue rules.
      const localRecovery = hasActiveEmptySearch
        ? DecisionEngine(readCatalogEvents(), state, catalog)
        : null;
      if (localRecovery?.kind === "search_friction") {
        setServerProposal(null);
      }
      setLocalProposal(
        localRecovery?.kind === "search_friction" ? localRecovery : null,
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
    // A single worker preserves event order while still queueing new triggers
    // that arrive during an in-flight Jev request.
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
          setServerProposal({
            id: `jev-proposal:${trigger.eventId}`,
            kind: "jev_proposal",
            title: parsed.data.title,
            message: parsed.data.message,
            actionLabel: parsed.data.actionLabel,
            action: parsed.data.action,
            createdAt:
              trigger.metaEvents.at(-1)?.detectedAt ?? new Date().toISOString(),
          });
          return;
        } catch {
          // Network failures and aborted requests leave the proposal hidden.
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

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    mutedRef.current = true;
    requestAllowedRef.current = false;
    clearAssistantProposalTriggers();
    activeControllerRef.current?.abort();
    setMuted(true);
    setLocalProposal(null);
    setServerProposal(null);
  };

  if (!proposal) return null;

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
