"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { DecisionShortlist } from "@/lib/assistant-decision-shortlist";
import type { AssistantProposal } from "@/lib/catalog-types";

function renderEmphasis(text: string): ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${part}-${index}`} className="font-bold text-[var(--assistant-violet)]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(price);
}

type AssistantDecisionCardProps = {
  proposal: AssistantProposal | null;
  shortlist: DecisionShortlist | null;
  loading?: boolean;
  onDismiss: () => void;
  onCompare: (productSlugs: string[]) => void;
  onSeeMore: () => void;
};

export function AssistantDecisionCard({
  proposal,
  shortlist,
  loading = false,
  onDismiss,
  onCompare,
  onSeeMore,
}: AssistantDecisionCardProps) {
  const title = proposal?.title ?? "Przygotowujemy propozycję…";
  const fallbackMessage = proposal?.message ?? "Analizujemy Twoją aktywność w katalogu.";
  const sessionLine = shortlist?.sessionSummary ?? fallbackMessage;

  return (
    <aside
      aria-labelledby="assistant-proposal-title"
      data-element-id="assistant-proposal"
      data-assistant-layout="decision-card"
      data-ai-request-state={loading ? "loading" : "complete"}
      className="assistant-proposal-enter assistant-proposal-expand assistant-violet-surface assistant-ai-glow relative mb-6 w-full overflow-hidden rounded-2xl border p-5 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        aria-label="Zamknij podpowiedź"
        data-element-id="assistant-dismiss"
        className="absolute right-3.5 top-3.5 z-10 rounded-full p-1.5 text-[#7c6b9e] transition hover:bg-[#ede9fe] hover:text-[var(--assistant-violet-hover)]"
        onClick={onDismiss}
      >
        <span aria-hidden="true" className="text-xl leading-none font-medium">×</span>
      </button>

      <div className="pr-8 sm:pr-10">
        <div className="assistant-proposal-stagger flex flex-wrap items-center gap-2">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--assistant-violet-border)] bg-[var(--assistant-violet-muted)] p-1 shadow-inner">
            <Image
              src="/illustrations/assistant-fox/fox-thinking.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              aria-hidden
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--assistant-violet)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--assistant-violet)] ring-2 ring-white" />
            </span>
          </div>
          <span className="text-sm font-bold text-[var(--assistant-violet-hover)]">Asystent zakupowy AI</span>
          <span className="rounded-md bg-[var(--assistant-violet)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Beta
          </span>
        </div>

        <div className="assistant-proposal-stagger mt-4">
          <h2
            id="assistant-proposal-title"
            className="text-xl font-bold tracking-tight text-[#1e1b2e] sm:text-2xl"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#5c5470]">
            {renderEmphasis(sessionLine)}
          </p>
        </div>

        <div className="assistant-proposal-stagger mt-4 rounded-xl border border-[var(--assistant-violet-border)] bg-[var(--assistant-violet-soft)]/90 px-4 py-3">
          <p className="text-sm text-[#5c5470]">
            Na podstawie Twoich preferencji zostały{" "}
            <strong className="text-[var(--assistant-violet-hover)]">3 najlepsze opcje dla Ciebie</strong>
          </p>
          {shortlist && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {shortlist.chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full bg-[var(--assistant-violet-chip)] px-2.5 py-1 text-[11px] font-semibold text-[var(--assistant-violet-hover)]"
                >
                  {chip}
                </li>
              ))}
            </ul>
          )}
        </div>

        <ol className="assistant-proposal-stagger mt-4 space-y-3 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
          {(loading ? [0, 1, 2] : shortlist?.items ?? []).map((entry, index) => {
            if (loading) {
              return (
                <li
                  key={`skeleton-${index}`}
                  className="assistant-proposal-shimmer flex gap-3 rounded-xl border border-[var(--assistant-violet-border)] bg-white/70 p-3"
                  aria-hidden
                >
                  <span className="h-8 w-6 rounded bg-[var(--assistant-violet-chip)]" />
                  <span className="h-14 w-14 shrink-0 rounded-lg bg-[var(--assistant-violet-chip)]" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="h-4 w-full rounded bg-[var(--assistant-violet-chip)]" />
                    <span className="h-3 w-2/3 rounded bg-[var(--assistant-violet-chip)]" />
                  </span>
                </li>
              );
            }
            const item = entry as DecisionShortlist["items"][number];
            return (
              <li key={item.product.slug}>
                <Link
                  href={`/produkt/${item.product.slug}`}
                  data-element-id="assistant-shortlist-product"
                  className="group flex gap-3 rounded-xl border border-[var(--assistant-violet-border)] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[var(--assistant-violet)] hover:shadow-[0_8px_24px_rgba(109,40,217,0.12)]"
                >
                  <span className="text-lg font-bold text-[var(--assistant-violet-hover)]">{item.rank}</span>
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f8f6fc]">
                    <Image
                      src={item.product.imageUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-[#1e1b2e]">
                      {item.product.name}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.badgeTone === "primary"
                          ? "bg-[#276e43]/15 text-[#276e43]"
                          : "bg-[var(--assistant-violet-chip)] text-[var(--assistant-violet-hover)]"
                      }`}
                    >
                      {item.badge}
                    </span>
                    <p className="mt-1 text-sm font-bold text-[#bd542e]">
                      od {formatPrice(item.product.price)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>

        {!loading && shortlist && shortlist.items.length > 0 && (
          <div className="assistant-proposal-stagger mt-5 space-y-3">
            <button
              type="button"
              data-element-id="assistant-action"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--assistant-violet)] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[var(--assistant-violet-hover)] active:scale-[0.98]"
              onClick={() =>
                onCompare(shortlist.items.map((item) => item.product.slug))
              }
            >
              Porównaj te 3 modele
            </button>
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-[var(--assistant-violet)] underline-offset-2 hover:underline"
              onClick={onSeeMore}
            >
              Nie, chcę zobaczyć więcej ofert
            </button>
          </div>
        )}

        {!loading && shortlist && (
          <div className="assistant-proposal-stagger mt-4 rounded-xl border border-[#ebe4c8] bg-[#faf6ea] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-[#8a7a4a]">
              {shortlist.tipTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#5c5748]">
              {shortlist.tipMessage}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
