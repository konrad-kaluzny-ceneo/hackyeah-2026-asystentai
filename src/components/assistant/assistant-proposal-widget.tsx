"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  CATALOG_SESSION_CHANGED,
  readAssistantMutedUntil,
} from "@/lib/assistant-events";
import {
  dispatchAssistantCatalogAction,
  getAssistantProposalUiState,
  recordAssistantProposalShown,
  setAssistantServerProposal,
  subscribeAssistantProposalUiState,
} from "@/lib/assistant-proposal-state";
import type { AssistantProposal } from "@/lib/catalog-types";

const EMPTY_PROPOSAL_UI_STATE = {
  proposal: null,
  searchRecoveryVisible: false,
  requestInFlight: false,
} as const;

function catalogHref(proposal: AssistantProposal): string {
  return proposal.data.categorySlug
    ? `/katalog/${proposal.data.categorySlug}`
    : "/katalog";
}

const illustrationAlt: Record<string, string> = {
  "fox-thinking": "Lisek myśli nad najlepszym wyborem",
  "fox-guiding": "Lisek wskazuje następny krok",
  "fox-celebrating": "Lisek cieszy się z dobrego wyboru",
};

function ProposalAction({
  proposal,
  onActionExecuted,
}: {
  proposal: AssistantProposal;
  onActionExecuted: () => void;
}) {
  if (
    proposal.action === "set-budget" ||
    proposal.action === "choose-brand" ||
    proposal.action === "browse-category"
  ) {
    const anchor = proposal.action === "set-budget"
      ? "#filter-price"
      : proposal.action === "choose-brand" ? "#filter-brand" : "";
    return (
      <a
        href={`${catalogHref(proposal)}${anchor}`}
        data-element-id="assistant-action"
        onClick={onActionExecuted}
        className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
      >
        {proposal.actionLabel}
      </a>
    );
  }

  if (proposal.action === "clear-search-and-filters") {
    return (
      <Link
        href={catalogHref(proposal)}
        data-element-id="assistant-action"
        onClick={onActionExecuted}
        className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
      >
        {proposal.actionLabel}
      </Link>
    );
  }

  if (proposal.action === "go-to-product" && proposal.data.productSlug) {
    return (
      <Link
        href={`/produkt/${proposal.data.productSlug}`}
        data-element-id="assistant-action"
        onClick={onActionExecuted}
        className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
      >
        {proposal.actionLabel}
      </Link>
    );
  }

  if (proposal.action === "sort-by-price" && proposal.data.sort) {
    return (
      <Link
        href={`${catalogHref(proposal)}?sort=${proposal.data.sort}`}
        data-element-id="assistant-action"
        onClick={onActionExecuted}
        className="mt-3 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-900"
      >
        {proposal.actionLabel}
      </Link>
    );
  }

  if (proposal.action === "narrow-choice") {
    return (
      <a
        href={`${catalogHref(proposal)}#${proposal.data.filterKeys[0] ? `filter-${proposal.data.filterKeys[0]}` : "filters"}`}
        data-element-id="assistant-action"
        onClick={() => {
          onActionExecuted();
          dispatchAssistantCatalogAction({
            type: "highlight-filters",
            filterKeys: proposal.data.filterKeys,
          });
        }}
        className="mt-3 inline-flex rounded-lg border border-sky-800 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
      >
        {proposal.actionLabel}
      </a>
    );
  }

  if (proposal.action === "explain-choice") {
    return null;
  }

  return null;
}

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

  if (muted || proposal === null) return null;

  const dismiss = () => {
    if (proposal) recordAssistantProposalShown(proposal);
    setAssistantServerProposal(null);
    setMuted(false);
  };

  const executeAction = () => {
    if (proposal) recordAssistantProposalShown(proposal);
    setAssistantServerProposal(null);
  };

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-popover="filters"
      data-ai-request-state="complete"
      className="assistant-proposal-enter fixed top-40 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-sky-200 bg-white p-5 pr-12 text-slate-900 shadow-2xl ring-1 ring-slate-900/5 sm:top-32 lg:top-28"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        aria-label="Zamknij podpowiedź"
        data-element-id="assistant-dismiss"
        className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-sky-100 hover:text-slate-900"
        onClick={dismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="mb-4 flex justify-center">
        <Image
          src={`/illustrations/assistant-fox/${proposal.data.illustration ?? "fox-thinking"}.png`}
          alt={illustrationAlt[proposal.data.illustration ?? "fox-thinking"]}
          width={320}
          height={220}
          sizes="208px"
          className="h-auto w-52 max-w-full"
          priority
        />
      </div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
        Odpowiedź AI
      </p>
      <h2 id="assistant-proposal-title" className="text-base font-semibold">
        {proposal.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">{proposal.message}</p>
      <ProposalAction proposal={proposal} onActionExecuted={executeAction} />
    </aside>
  );
}