"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  CATALOG_SESSION_CHANGED,
  muteAssistantFor,
  readAssistantMutedUntil,
} from "@/lib/assistant-events";
import {
  getAssistantProposalUiState,
  setAssistantServerProposal,
  subscribeAssistantProposalUiState,
} from "@/lib/assistant-proposal-state";

const MUTE_DURATION_MS = 15 * 60 * 1000;
const EMPTY_PROPOSAL_UI_STATE = {
  proposal: null,
  searchRecoveryVisible: false,
  requestInFlight: false,
} as const;

export function AssistantProposalWidget() {
  const proposalUiState = useSyncExternalStore(
    subscribeAssistantProposalUiState,
    getAssistantProposalUiState,
    () => EMPTY_PROPOSAL_UI_STATE,
  );
  const [muted, setMuted] = useState(() => readAssistantMutedUntil() > Date.now());
  const proposal =
    !muted && proposalUiState.proposal?.kind === "jev_proposal"
      ? proposalUiState.proposal
      : null;

  useEffect(() => {
    let muteTimer: number | undefined;
    const refreshMute = () => {
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
      const mutedUntil = readAssistantMutedUntil();
      setMuted(mutedUntil > Date.now());
      if (mutedUntil > Date.now()) {
        muteTimer = window.setTimeout(refreshMute, mutedUntil - Date.now());
      }
    };

    refreshMute();
    window.addEventListener(CATALOG_SESSION_CHANGED, refreshMute);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, refreshMute);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
    };
  }, []);

  if (muted || (!proposalUiState.requestInFlight && proposal === null)) return null;

  const dismiss = () => {
    muteAssistantFor(MUTE_DURATION_MS);
    setAssistantServerProposal(null);
    setMuted(true);
  };

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-popover="filters"
      data-ai-request-state={proposalUiState.requestInFlight ? "pending" : "complete"}
      className="fixed top-40 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-sky-200 bg-white p-5 pr-12 text-slate-900 shadow-2xl ring-1 ring-slate-900/5 sm:top-32 lg:top-28"
      role="status"
      aria-live="polite"
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
      {proposalUiState.requestInFlight ? (
        <>
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
            OpenAI
          </p>
          <h2 id="assistant-proposal-title" className="text-base font-semibold">
            Trwa generowanie odpowiedzi
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Wysyłanie requestu do OpenAI…
          </p>
        </>
      ) : proposal !== null ? (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
            Odpowiedź AI
          </p>
          <h2 id="assistant-proposal-title" className="text-base font-semibold">
            {proposal.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">{proposal.message}</p>
          <Link
            href="/katalog#filters"
            data-element-id="assistant-action"
            className="mt-3 inline-flex rounded-lg border border-sky-800 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
          >
            {proposal.actionLabel}
          </Link>
        </>
      ) : null}
    </aside>
  );
}