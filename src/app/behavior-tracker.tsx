"use client";

import { useEffect } from "react";

import { initBehaviorTracker } from "@/behavior/initializer";

/**
 * Mounts the behavior tracker for the lifetime of the root layout. Renders
 * nothing — it's purely a side-effect wrapper. The tracker no-ops when the
 * feature flag is off (NEXT_PUBLIC_BEHAVIOR_TRACKING !== "true").
 */
export function BehaviorTracker() {
  useEffect(() => {
    const handle = initBehaviorTracker();
    if (handle === null) {
      return undefined;
    }
    return () => {
      void handle.destroy();
    };
  }, []);
  return null;
}
