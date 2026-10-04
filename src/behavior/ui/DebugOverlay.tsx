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
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(300px,100dvh)] flex-col border-t border-zinc-200 bg-white/95 text-xs text-zinc-900 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100"
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex h-9 shrink-0 w-full items-center justify-between gap-3 px-4 text-left font-semibold dark:hover:bg-zinc-800 hover:bg-zinc-50"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Behavior debug</span>
        <span className="flex items-center gap-3">
          <span className="text-[10px] font-normal text-zinc-500">{state.lastRawEvents.length} raw · {state.lastSentMetaEvents.length} meta</span>
          <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
        </span>
      </button>
      {!collapsed && (
        <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto border-t border-zinc-100 px-4 py-3 md:grid-cols-[minmax(0,1fr)_13rem] dark:border-zinc-800">
          <section className="flex h-[220px] min-h-0 min-w-0 flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                Intencje zakupowe
              </h3>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                JEV · 30 s
              </span>
            </div>
            <div className="mt-2 flex min-h-0 flex-1">
              <EmotionTimelineChart />
            </div>
          </section>
          <section className="min-w-0 border-t border-zinc-100 pt-2 md:border-t-0 md:border-l md:pl-3 md:pt-0 dark:border-zinc-800">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Meta eventy</h3>
            {state.lastSentMetaEvents.length === 0 ? (
              <p className="text-zinc-400">Brak zdarzeń</p>
            ) : (
              <ul className="flex max-h-20 flex-wrap gap-x-3 gap-y-1 overflow-y-auto font-mono text-[11px] [scrollbar-width:thin] md:max-h-[200px] md:flex-col md:flex-nowrap">
                {state.lastSentMetaEvents.map((event) => (
                  <li key={event.eventId} className="min-w-0 break-all py-0.5 text-zinc-600 dark:text-zinc-400">{event.name}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
