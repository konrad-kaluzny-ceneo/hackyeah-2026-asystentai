import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decisionEngineMock = vi.hoisted(() => ({
  current: null as null | {
    id: string;
    kind: "decision_fatigue" | "search_friction" | "jev_proposal";
    title: string;
    message: string;
    actionLabel: string;
    action: "narrow-choice" | "clear-search-and-filters";
    data: { target: "filters" | "catalog"; filterKeys: string[] };
    createdAt: string;
  },
}));

vi.mock("@/lib/decision-engine", () => ({
  DecisionEngine: vi.fn(() => decisionEngineMock.current),
}));

import { AssistantInline } from "@/components/assistant/assistant-inline";
import {
  clearAssistantMetaEventHistory,
  recordAssistantMetaEventBatch,
  MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL,
} from "@/behavior/assistant-meta-event-history";
import {
  muteAssistantFor,
  readAssistantMutedUntil,
} from "@/lib/assistant-events";
import type { AssistantProposal, CatalogState } from "@/lib/catalog-types";
import { makeMetaEvent } from "../../behavior/fixtures";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SHOW_PROPOSAL = {
  status: "show",
  action: "narrow-choice",
  data: { target: "filters", filterKeys: ["capacity"] },
} as const;

const fatigueProposal: AssistantProposal = {
  id: "decision-fatigue:return-1",
  kind: "decision_fatigue",
  title: "Pomóc zawęzić wybór?",
  message: "Spróbuj zawęzić wybór według pojemności.",
  actionLabel: "Przejdź do filtrów",
  action: "narrow-choice",
  data: { target: "filters", filterKeys: [] },
  createdAt: "2026-10-03T12:00:00.000Z",
};

const frictionProposal: AssistantProposal = {
  id: "empty-results:search-1",
  kind: "search_friction",
  title: "Nie znaleźliśmy produktów",
  message: "Wyczyść wyszukiwanie i filtry, aby zobaczyć cały katalog w tej kategorii.",
  actionLabel: "Wyczyść wyszukiwanie i filtry",
  action: "clear-search-and-filters",
  data: { target: "catalog", filterKeys: [] },
  createdAt: "2026-10-03T12:00:00.000Z",
};

const catalogState: CatalogState = {
  categorySlug: "lodowki",
  query: "",
  filters: {},
  resultCount: 8,
  page: 1,
};

const catalog = { categories: [], products: [] };

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let renderRevision = 0;
let eventSequence = 0;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function nextMetaEvents(count: number) {
  return Array.from({ length: count }, () => {
    eventSequence += 1;
    return makeMetaEvent("rage_click", {
      eventId: `meta-event-${eventSequence}`,
      detectedAt: new Date(1_791_024_000_000 + eventSequence * 1_000).toISOString(),
    });
  });
}

async function renderAssistant(decision: AssistantProposal | null) {
  decisionEngineMock.current = decision;
  renderRevision += 1;
  await act(async () => {
    root.render(
      <AssistantInline
        state={{ ...catalogState, page: renderRevision }}
        catalog={catalog}
        onClearSearchAndFilters={vi.fn()}
      />,
    );
  });
}

async function flushRequestTask() {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 5));
  });
}

async function recordEvents(count: number) {
  await act(async () => {
    recordAssistantMetaEventBatch(nextMetaEvents(count));
  });
}

beforeEach(() => {
  clearAssistantMetaEventHistory();
  window.sessionStorage.clear();
  decisionEngineMock.current = null;
  renderRevision = 0;
  eventSequence = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(response(SHOW_PROPOSAL));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearAssistantMetaEventHistory();
  container.remove();
  vi.unstubAllGlobals();
});

describe("AssistantInline proposal lifecycle", () => {
  it("waits for five unique MetaEvents and sends the bounded event snapshot", async () => {
    await renderAssistant(fatigueProposal);
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL - 1);
    await flushRequestTask();
    expect(fetchMock).not.toHaveBeenCalled();

    await recordEvents(1);
    await flushRequestTask();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant-proposal");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { metaEvents: unknown[] };
    expect(body.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    expect(container.querySelectorAll('[data-element-id="assistant-proposal"]')).toHaveLength(1);
    expect(container.querySelector("h2")?.textContent).toBe(fatigueProposal.title);
  });

  it("does not call the server while muted", async () => {
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await act(async () => muteAssistantFor(60_000));
    await renderAssistant(fatigueProposal);
    await flushRequestTask();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("keeps empty-search recovery local and preserves its clear action", async () => {
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await renderAssistant(frictionProposal);
    await flushRequestTask();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe(frictionProposal.title);
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("BUTTON");
  });

  it("maps the server clear action to local copy and a button", async () => {
    fetchMock.mockResolvedValue(
      response({
        status: "show",
        action: "clear-search-and-filters",
        data: { target: "catalog", filterKeys: [] },
      }),
    );
    await renderAssistant(fatigueProposal);
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTask();

    expect(container.querySelector("h2")?.textContent).toBe("Zacznij od pełnego katalogu");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("BUTTON");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.textContent).toBe(
      "Wyczyść wyszukiwanie i filtry",
    );
  });

  it.each([
    ["hide response", { status: "hide" }],
    ["invalid response", { status: "show", kind: "other" }],
  ])("does not render a box for a %s", async (_label, body) => {
    fetchMock.mockResolvedValue(response(body));
    await renderAssistant(fatigueProposal);
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTask();

    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("serializes queued event triggers and continues after a hide response", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ status: "hide" }))
      .mockResolvedValueOnce(response(SHOW_PROPOSAL));
    await renderAssistant(fatigueProposal);
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL + 1);
    await flushRequestTask();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { metaEvents: unknown[] };
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { metaEvents: unknown[] };
    expect(firstBody.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    expect(secondBody.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL + 1);
    expect(container.querySelector("h2")?.textContent).toBe(fatigueProposal.title);
  });

  it("dismissal hides the box and mutes the assistant for 15 minutes", async () => {
    await renderAssistant(fatigueProposal);
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTask();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).not.toBeNull();

    const mutedAt = Date.now();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click();
    });

    expect(readAssistantMutedUntil()).toBeGreaterThanOrEqual(mutedAt + 15 * 60 * 1000);
    expect(readAssistantMutedUntil()).toBeLessThanOrEqual(mutedAt + 15 * 60 * 1000 + 5);
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
