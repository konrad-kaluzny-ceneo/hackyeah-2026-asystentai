"use client";

import { useState, useSyncExternalStore } from "react";

import { getDebugState, subscribeDebug } from "./debug-store";

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
      className="fixed inset-x-0 bottom-0 z-50 h-[200px] border-t border-zinc-300 bg-white/95 font-mono text-xs text-zinc-900 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100"
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
        <div className="grid h-[164px] grid-cols-1 gap-4 overflow-hidden px-4 py-3 sm:grid-cols-[minmax(13rem,0.8fr)_minmax(0,2fr)]">
          <div className="min-w-0 overflow-y-auto pr-1">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <Stat label="Page" value={`${state.pageType}`} title={state.pathname} />
              <Stat label="Path" value={state.pathname} />
              <Stat
                label="Raw (sessionStorage)"
                value={String(state.rawEventsInSessionStorage)}
              />
              <Stat
                label="Meta unsent"
                value={String(state.unsentMetaEvents)}
              />
              <Stat
                label="Meta sent (session)"
                value={String(state.totalMetaSentThisSession)}
              />
              <Stat
                label="Session"
                value={state.sessionId?.slice(0, 8) ?? "—"}
                title={state.sessionId ?? undefined}
              />
            </dl>
            <section className="mt-3">
              <h3 className="mb-1 font-semibold text-zinc-600 dark:text-zinc-400">
                Last sent meta events
              </h3>
              {state.lastSentMetaEvents.length === 0 ? (
                <p className="text-zinc-500">none yet</p>
              ) : (
                <ul className="space-y-1">
                  {state.lastSentMetaEvents.map((e) => (
                    <li
                      key={e.eventId}
                      className="truncate rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
                      title={`batch ${e.batchId} · sent ${formatTime(e.sentAt)}`}
                    >
                      <span className="font-semibold">{e.name}</span>
                      <span className="ml-2 text-zinc-500">
                        s={e.strength.toFixed(2)} n={e.evidenceCount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="flex min-w-0 flex-col rounded border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">
                Emocje użytkownika w czasie
              </h3>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                placeholder
              </span>
            </div>
            <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded border border-dashed border-zinc-300 bg-white/70 dark:border-zinc-600 dark:bg-zinc-900/40">
              <svg
                aria-hidden="true"
                className="h-full w-full"
                viewBox="0 0 640 120"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 86 C55 76 62 48 118 58 S177 100 230 72 S290 38 340 56 S400 86 452 48 S515 24 560 42 S610 72 640 28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-sky-500/70"
                />
                <path
                  d="M0 94 H640 M0 60 H640 M0 26 H640"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="4 8"
                  className="text-zinc-200 dark:text-zinc-700"
                />
              </svg>
              <span className="absolute inset-x-0 bottom-2 text-center text-zinc-400">
                dane zostaną podpięte później
              </span>
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
