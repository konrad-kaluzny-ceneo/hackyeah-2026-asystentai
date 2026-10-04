"use client";

import { useSyncExternalStore } from "react";

import { isBehaviorTrackingEnabled } from "@/behavior/config/feature-flag";
import {
  getDebugState,
  subscribeDebug,
  toggleBehaviorDebugOverlay,
} from "@/behavior/ui/debug-store";

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-6" />
      <path d="M22 20H2" />
    </svg>
  );
}

export function BehaviorAnalyticsToggle() {
  const trackingConfigured = isBehaviorTrackingEnabled();
  const { trackerEnabled, overlayOpen } = useSyncExternalStore(
    subscribeDebug,
    getDebugState,
    getDebugState,
  );

  if (!trackingConfigured || !trackerEnabled) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => toggleBehaviorDebugOverlay()}
      aria-pressed={overlayOpen}
      aria-label={
        overlayOpen ? "Ukryj panel analityki zachowania" : "Pokaż panel analityki zachowania"
      }
      title={overlayOpen ? "Ukryj analitykę" : "Analityka zachowania (demo)"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 ${
        overlayOpen
          ? "border-purple-600 bg-purple-700 text-white shadow-sm"
          : "border-purple-200 bg-purple-50/50 text-purple-700 hover:border-purple-300 hover:bg-white hover:text-purple-900"
      }`}
    >
      <AnalyticsIcon className="h-5 w-5" />
    </button>
  );
}
