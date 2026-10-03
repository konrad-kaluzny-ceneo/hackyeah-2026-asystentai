import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  muteAssistantFor,
  readAssistantMutedUntil,
  CATALOG_SESSION_CHANGED,
} from "@/lib/assistant-events";

describe("assistant mute", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.sessionStorage.removeItem("asystent-ai:muted-until:v1");
    window.sessionStorage.removeItem("asystent-ai:catalog-events:v1");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("muteAssistantFor stores a timestamp offset from Date.now()", () => {
    expect(readAssistantMutedUntil()).toBe(0);
    muteAssistantFor(15 * 60 * 1000);
    expect(readAssistantMutedUntil()).toBe(Date.now() + 15 * 60 * 1000);
  });

  it("notifies subscribers via CATALOG_SESSION_CHANGED", () => {
    const seen: number[] = [];
    const handler = () => seen.push(Date.now());
    window.addEventListener(CATALOG_SESSION_CHANGED, handler);
    muteAssistantFor(1_000);
    window.removeEventListener(CATALOG_SESSION_CHANGED, handler);
    expect(seen).toHaveLength(1);
  });

  it("mute expires naturally when system time advances past the window", () => {
    muteAssistantFor(60_000);
    expect(readAssistantMutedUntil()).toBeGreaterThan(Date.now());
    vi.setSystemTime(new Date("2026-10-03T12:02:00.000Z"));
    expect(readAssistantMutedUntil()).toBeLessThanOrEqual(Date.now());
  });

  it("is resilient to sessionStorage write failures", () => {
    expect(readAssistantMutedUntil()).toBe(0);
    const originalSetItem = window.sessionStorage.setItem.bind(window.sessionStorage);
    Object.defineProperty(window.sessionStorage, "setItem", {
      value: () => { throw new Error("quota"); },
      writable: true,
      configurable: true,
    });
    expect(() => muteAssistantFor(1_000)).not.toThrow();
    Object.defineProperty(window.sessionStorage, "setItem", {
      value: originalSetItem,
      writable: true,
      configurable: true,
    });
    window.sessionStorage.removeItem("asystent-ai:muted-until:v1");
    expect(readAssistantMutedUntil()).toBe(0);
  });
});
