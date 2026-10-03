import { beforeEach, describe, expect, it } from "vitest";

import {
  getCurrentPageViewId,
  getSessionId,
  resetSessionStateForTests,
  rotatePageViewId,
} from "@/behavior/collector/session";

describe("collector.session", () => {
  beforeEach(() => {
    resetSessionStateForTests();
    window.sessionStorage.clear();
  });

  it("sessionId is stable across calls within the same tab", () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
  });

  it("sessionId is persisted in sessionStorage", () => {
    const a = getSessionId();
    resetSessionStateForTests();
    const b = getSessionId(); // should re-hydrate from storage
    expect(b).toBe(a);
  });

  it("rotatePageViewId returns the previous id and generates a new one", () => {
    const first = getCurrentPageViewId();
    const rotation = rotatePageViewId();
    expect(rotation.previous).toBe(first);
    expect(rotation.current).not.toBe(first);
    expect(getCurrentPageViewId()).toBe(rotation.current);
  });

  it("first rotatePageViewId call after fresh state yields null previous", () => {
    // State was reset in beforeEach, so no pageViewId exists yet.
    const rotation = rotatePageViewId();
    expect(rotation.previous).toBeNull();
    expect(rotation.current).not.toBeNull();
    const next = rotatePageViewId();
    expect(next.previous).toBe(rotation.current);
  });
});
