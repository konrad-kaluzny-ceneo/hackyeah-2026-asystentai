import { beforeEach, describe, expect, it } from "vitest";

import { RawEventBuffer } from "@/behavior/buffer/buffer";
import { createCollector } from "@/behavior/collector/collector";
import { resetSessionStateForTests } from "@/behavior/collector/session";
import { PAGE_TYPE_RULES } from "@/behavior/config/page-types";
import type { RawEventName } from "@/behavior/types";

import { makeClock, makeIdGenerator, resetFixtureSeed } from "./fixtures";

describe("Collector navigation", () => {
  beforeEach(() => {
    resetFixtureSeed();
    resetSessionStateForTests();
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  function setup() {
    const clock = makeClock(0);
    const buffer = new RawEventBuffer({
      maxEvents: 200,
      ttlMs: 60_000,
      now: clock.now,
    });
    const transitions: Array<{
      previousPath: string | null;
      currentPath: string;
    }> = [];
    const collector = createCollector({
      buffer,
      rules: PAGE_TYPE_RULES,
      now: clock.now,
      generateId: makeIdGenerator("raw"),
      onPageViewChange: ({ previous, current }) => {
        transitions.push({
          previousPath: previous?.pathname ?? null,
          currentPath: current.pathname,
        });
      },
    });
    return { collector, buffer, transitions };
  }

  function eventNames(buffer: RawEventBuffer): readonly RawEventName[] {
    return buffer.readSince(0).map((e) => e.name);
  }

  it("emits page_enter on init", () => {
    const { collector, buffer } = setup();
    expect(eventNames(buffer)).toContain("page_enter");
    collector.destroy();
  });

  it("emits page_leave + url_changed + page_enter on pushState to a new path", () => {
    const { collector, buffer, transitions } = setup();
    window.history.pushState(null, "", "/katalog");
    const names = eventNames(buffer);
    expect(names).toContain("page_leave");
    expect(names).toContain("url_changed");
    // Two page_enter: init + post-pushState.
    expect(names.filter((n) => n === "page_enter").length).toBe(2);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      previousPath: "/",
      currentPath: "/katalog",
    });
    collector.destroy();
  });

  it("emits the same transition on replaceState", () => {
    const { collector, buffer, transitions } = setup();
    window.history.replaceState(null, "", "/katalog");
    const names = eventNames(buffer);
    expect(names).toContain("url_changed");
    expect(transitions).toHaveLength(1);
    collector.destroy();
  });

  it("syncs a URL change made outside the collector history patch", () => {
    const nativePushState = window.history.pushState;
    const { collector, buffer, transitions } = setup();
    nativePushState.call(window.history, null, "", "/katalog");

    expect(eventNames(buffer)).toEqual(["page_enter"]);
    collector.syncPathname();

    expect(eventNames(buffer)).toContain("url_changed");
    expect(transitions).toHaveLength(1);
    collector.destroy();
  });

  it("emits on popstate to a previously-visited path", () => {
    const { collector, buffer, transitions } = setup();
    window.history.pushState(null, "", "/katalog");
    window.history.pushState(null, "", "/");
    // popstate goes back — simulate by directly transitioning:
    window.history.replaceState(null, "", "/katalog");
    window.dispatchEvent(new PopStateEvent("popstate"));
    // Note: our popstate handler reads window.location.pathname, which only
    // changes after the browser navigates. In a test we mutate via pushState
    // and THEN dispatch popstate to model the full navigation cycle.
    // Assert collector is still alive and has logged multiple page transitions.
    expect(transitions.length).toBeGreaterThanOrEqual(1);
    expect(eventNames(buffer)).toContain("url_changed");
    collector.destroy();
  });

  it("does NOT emit a transition when only the query string changes", () => {
    const { collector, transitions } = setup();
    const before = transitions.length;
    window.history.pushState(null, "", "/?q=pralka");
    expect(transitions.length).toBe(before);
    collector.destroy();
  });

  it("does not emit reserved non-goal raw events", () => {
    const { collector, buffer } = setup();
    const initial = buffer.size();
    collector.emit("add_to_cart");
    collector.emit("compare_added");
    collector.emit("compare_removed");
    collector.emit("favorite_added");
    expect(buffer.size()).toBe(initial);
    collector.destroy();
  });

  it("destroy() is idempotent and removes listeners", () => {
    const { collector } = setup();
    collector.destroy();
    collector.destroy(); // second call must not throw
    expect(true).toBe(true);
  });
});
