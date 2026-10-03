"use client";

import { useState, useSyncExternalStore } from "react";

import { getDebugState, subscribeDebug } from "./debug-store";
import { EmotionTimelineChart } from "./EmotionTimelineChart";

// Cached server snapshot — `useSyncExternalStore` requires a stable value
// for SSR. The overlay only renders when tracker is enabled, which is
// never the case on the server.
const SERVER_SNAPSHOT = getDebugState();

/**
 * Floating dev-only overlay with behavior-pipeline telemetry. Rendered as a
 * sibling of the page content (fixed-position, doesn't disturb layout).
 *
 * Renders `null` when the tracker is disabled — production bundle without
 * the feature flag pays only the import cost.
 */
export function DebugOverlay() {
  const state = useSyncExternalStore(
    subscribeDebug,
    getDebugState,
    () => SERVER_SNAPSHOT,
  );
  const [collapsed, setCollapsed] = useState(false);

  if (!state.trackerEnabled) {
    return null;
  }

  return (
    <aside
      aria-label="Behavior debug"
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(20rem,calc(100dvh-300px))] flex-col border-t border-zinc-300 bg-white/95 font-mono text-xs text-zinc-900 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100"
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex h-9 w-full items-center justify-between border-b border-zinc-200 px-4 text-left font-semibold tracking-tight dark:border-zinc-700"
        aria-expanded={!collapsed}
      >
        <span>Behavior debug</span>
        <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto px-4 py-3 sm:grid-cols-[minmax(13rem,0.8fr)_minmax(0,2fr)]">
          <div className="min-w-0 space-y-3 overflow-y-auto pr-1">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <Stat label="Page" value={`${state.pageType}`} title={state.pathname} />
              <Stat
                label="Session ID"
                value={state.sessionId?.slice(0, 8) ?? "—"}
                title={state.sessionId ?? undefined}
              />
            </dl>
            <section className="rounded border border-zinc-200 bg-zinc-50/70 p-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-600 dark:text-zinc-400">
                  Raw events
                </h3>
                <span className="text-zinc-400">{state.lastRawEvents.length}</span>
              </div>
            </section>
            <section className="rounded border border-zinc-200 bg-zinc-50/70 p-2 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-600 dark:text-zinc-400">
                  Sent meta events
                </h3>
                <span className="text-zinc-400">{state.lastSentMetaEvents.length}</span>
              </div>
              {state.lastSentMetaEvents.length === 0 ? (
                <p className="mt-2 text-zinc-500">none yet</p>
              ) : (
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                  {state.lastSentMetaEvents.map((event) => (
                    <li
                      key={event.eventId}
                      className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
                      title={`batch ${event.batchId}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{event.name}</span>
                        <time className="shrink-0 text-zinc-500">
                          {formatTime(event.sentAt)}
                        </time>
                      </div>
                      <div className="text-zinc-500">
                        strength={event.strength.toFixed(2)} · evidence={event.evidenceCount}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="flex h-full min-h-[180px] min-w-0 flex-col rounded border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                Intencje zakupowe użytkownika w czasie
              </h3>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                JEV · 30 s
              </span>
            </div>
            <div className="mt-2 flex min-h-0 flex-1">
              <EmotionTimelineChart />
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <>
      <dt className="truncate text-zinc-500">{label}</dt>
      <dd className="truncate font-medium" title={title}>
        {value}
      </dd>
    </>
  );
}

function formatTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleTimeString("pl-PL", { hour12: false });
}

