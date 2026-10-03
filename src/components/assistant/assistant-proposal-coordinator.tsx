"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  clearAssistantProposalTriggers,
  getAssistantMetaEventHistory,
  requeueAssistantProposalTrigger,
  subscribeAssistantMetaEventHistory,
  takeAssistantProposalTrigger,
} from "@/behavior/assistant-meta-event-history";
import type { MetaEvent } from "@/behavior/types";
import { safeParseAssistantProposalResponse } from "@/lib/assistant-proposal-api";
import type { AssistantProposal } from "@/lib/catalog-types";
import {
  CATALOG_SESSION_CHANGED,
  readAssistantMutedUntil,
} from "@/lib/assistant-events";
import {
  getAssistantProposalUiState,
  setAssistantSearchRecoveryVisible,
  setAssistantServerProposal,
  subscribeAssistantProposalUiState,
} from "@/lib/assistant-proposal-state";

const EMPTY_META_EVENT_HISTORY: readonly MetaEvent[] = [];
const EMPTY_PROPOSAL_UI_STATE = {
  proposal: null,
  searchRecoveryVisible: false,
} as const;

/**
 * Lives in the root behavior shell so threshold requests continue while the
 * shopper navigates between product and category pages. The listing box only
 * renders the proposal; it does not classify or trigger Jev requests.
 */
export function AssistantProposalCoordinator() {
  const recentMetaEvents = useSyncExternalStore(
    subscribeAssistantMetaEventHistory,
    getAssistantMetaEventHistory,
    () => EMPTY_META_EVENT_HISTORY,
  );
  const proposalUiState = useSyncExternalStore(
    subscribeAssistantProposalUiState,
    getAssistantProposalUiState,
    () => EMPTY_PROPOSAL_UI_STATE,
  );
  const [muted, setMuted] = useState(() => readAssistantMutedUntil() > Date.now());
  const mountedRef = useRef(false);
  const workerActiveRef = useRef(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const activeTriggerRef = useRef<ReturnType<typeof takeAssistantProposalTrigger>>(null);
  const requestAllowedRef = useRef(false);
  const requestAllowed =
    !muted &&
    proposalUiState.proposal === null &&
    !proposalUiState.searchRecoveryVisible;

  useEffect(() => {
    requestAllowedRef.current = requestAllowed;
  }, [requestAllowed]);

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
    const refreshMute = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      const mutedUntil = readAssistantMutedUntil();
      if (mutedUntil > Date.now()) {
        requestAllowedRef.current = false;
        clearAssistantProposalTriggers();
        activeControllerRef.current?.abort();
        setAssistantServerProposal(null);
        setAssistantSearchRecoveryVisible(false);
        setMuted(true);
        muteTimer = window.setTimeout(refreshMute, mutedUntil - Date.now());
      } else {
        setMuted(false);
      }
    };

    refreshMute();
    window.addEventListener(CATALOG_SESSION_CHANGED, refreshMute);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, refreshMute);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
    };
  }, []);

  const drainProposalTriggers = useCallback(async (): Promise<void> => {
    if (workerActiveRef.current) return;
    workerActiveRef.current = true;

    try {
      while (mountedRef.current
        // && requestAllowedRef.current
      ) {
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
          const proposal: AssistantProposal = {
            id: `jev-proposal:${trigger.eventId}`,
            kind: "jev_proposal",
            title: parsed.data.title,
            message: parsed.data.message,
            actionLabel: "Przejdź do filtrów",
            action: "narrow-choice",
            data: { target: "filters", filterKeys: [] },
            createdAt:
              trigger.metaEvents.at(-1)?.detectedAt ?? new Date().toISOString(),
          };
          setAssistantServerProposal({
            ...proposal,
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

  return null;
}
