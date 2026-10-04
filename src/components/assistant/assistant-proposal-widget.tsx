"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { AssistantDecisionCard } from "@/components/assistant/assistant-decision-card";
import {
  CATALOG_SESSION_CHANGED,
  readAssistantMutedUntil,
  readCatalogEvents,
} from "@/lib/assistant-events";
import { buildDecisionShortlist } from "@/lib/assistant-decision-shortlist";
import {
  dispatchAssistantCatalogAction,
  getAssistantProposalUiState,
  recordAssistantProposalShown,
  setAssistantServerProposal,
  subscribeAssistantProposalUiState,
} from "@/lib/assistant-proposal-state";
import type { AssistantProposal, Category, Product } from "@/lib/catalog-types";
import { ui } from "@/lib/ui/theme";

const EMPTY_PROPOSAL_UI_STATE = {
  proposal: null,
  searchRecoveryVisible: false,
  requestInFlight: false,
} as const;

type AssistantProposalWidgetProps = {
  variant?: "banner" | "decision";
  listingProducts?: readonly Product[];
  category?: Category | null;
};

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
  const baseButtonClass = ui.btnCatalogPrimary;
  const outlineButtonClass = ui.btnCatalogOutline;

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
        className={baseButtonClass}
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
        className={baseButtonClass}
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
        className={baseButtonClass}
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
        className={baseButtonClass}
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
        className={outlineButtonClass}
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

function AssistantProposalBanner({ proposal }: { proposal: AssistantProposal }) {
  const dismiss = () => {
    recordAssistantProposalShown(proposal);
    setAssistantServerProposal(null);
  };

  const executeAction = () => {
    recordAssistantProposalShown(proposal);
    setAssistantServerProposal(null);
  };

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-popover="filters"
      data-ai-request-state="complete"
      className="assistant-proposal-enter assistant-panel relative mb-6 w-full overflow-hidden rounded-2xl border p-5 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        aria-label="Zamknij podpowiedź"
        data-element-id="assistant-dismiss"
        className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-subtle transition hover:bg-catalog-chip hover:text-catalog-primary"
        onClick={dismiss}
      >
        <span aria-hidden="true" className="text-xl leading-none font-medium">×</span>
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 pr-8 sm:pr-10">
        <div className="relative shrink-0 flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border border-border bg-catalog-chip p-1.5">
          <Image
            src={`/illustrations/assistant-fox/${proposal.data.illustration ?? "fox-thinking"}.png`}
            alt={illustrationAlt[proposal.data.illustration ?? "fox-thinking"]}
            width={80}
            height={80}
            sizes="80px"
            className="h-full w-full object-contain"
            priority
          />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-assistant opacity-50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-assistant ring-2 ring-white" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-assistant-chip px-2.5 py-0.5 text-[11px] font-semibold text-assistant-hover">
              Asystent AI · Beta
            </span>
          </div>
          <h2 id="assistant-proposal-title" className="text-base sm:text-lg font-bold tracking-tight text-catalog-primary">
            {proposal.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm leading-relaxed text-muted">
            {proposal.message}
          </p>
        </div>

        <div className="shrink-0 sm:self-center">
          <ProposalAction proposal={proposal} onActionExecuted={executeAction} />
        </div>
      </div>
    </aside>
  );
}

export function AssistantProposalWidget({
  variant = "banner",
  listingProducts = [],
  category = null,
}: AssistantProposalWidgetProps) {
  const proposalUiState = useSyncExternalStore(
    subscribeAssistantProposalUiState,
    getAssistantProposalUiState,
    () => EMPTY_PROPOSAL_UI_STATE,
  );
  const [muted, setMuted] = useState(() => readAssistantMutedUntil() > Date.now());
  const [sessionRevision, setSessionRevision] = useState(0);
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
    const onSessionChange = () => {
      refreshMute();
      setSessionRevision((value) => value + 1);
    };
    window.addEventListener(CATALOG_SESSION_CHANGED, onSessionChange);
    return () => {
      window.removeEventListener(CATALOG_SESSION_CHANGED, onSessionChange);
      if (muteTimer !== undefined) window.clearTimeout(muteTimer);
    };
  }, []);

  const shortlist = useMemo(() => {
    void sessionRevision;
    return buildDecisionShortlist({
      products: listingProducts,
      events: readCatalogEvents(),
      category,
      categorySlug: category?.slug ?? null,
    });
  }, [category, listingProducts, sessionRevision]);

  if (muted) return null;

  if (variant === "decision") {
    if (proposalUiState.searchRecoveryVisible) return null;
    const loading =
      proposalUiState.requestInFlight &&
      proposal === null &&
      listingProducts.length > 0;
    if (!proposal && !loading) return null;
    if (proposal && !shortlist && !loading) {
      return proposal ? <AssistantProposalBanner proposal={proposal} /> : null;
    }

    const dismiss = () => {
      if (proposal) recordAssistantProposalShown(proposal);
      dispatchAssistantCatalogAction({ type: "clear-focus-products" });
      setAssistantServerProposal(null);
    };

    return (
      <AssistantDecisionCard
        proposal={proposal}
        shortlist={shortlist}
        loading={loading}
        onDismiss={dismiss}
        onCompare={(productSlugs) => {
          if (proposal) recordAssistantProposalShown(proposal);
          dispatchAssistantCatalogAction({ type: "focus-products", productSlugs });
        }}
        onSeeMore={() => {
          dispatchAssistantCatalogAction({ type: "clear-focus-products" });
          setAssistantServerProposal(null);
        }}
      />
    );
  }

  if (proposal === null) return null;
  return <AssistantProposalBanner proposal={proposal} />;
}
