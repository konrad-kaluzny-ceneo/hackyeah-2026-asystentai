import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decisionEngineMock = vi.hoisted(() => ({
  current: null as null | {
    id: string;
    kind: "decision_fatigue" | "search_friction";
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
} from "@/behavior/assistant-meta-event-history";
import {
  muteAssistantFor,
  readAssistantMutedUntil,
} from "@/lib/assistant-events";
import type { AssistantProposal, CatalogState } from "@/lib/catalog-types";
import { makeMetaEvent } from "../../behavior/fixtures";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FIXED_PROPOSAL = {
  status: "show",
  action: "narrow-choice",
  data: { target: "filters", filterKeys: ["capacity"] },
} as const;

const fatigueProposal: AssistantProposal = {
  id: "decision-fatigue:return-1",
  kind: "decision_fatigue",
  title: "Lokalny tytuł nie powinien się pokazać",
  message: "Oczekiwanie na serwer",
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
const metaEvent = makeMetaEvent("rage_click", { eventId: "meta-event-1" });

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let renderRevision = 0;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
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
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1));
  });
}

async function addMetaEvent() {
  await act(async () => {
    recordAssistantMetaEventBatch([metaEvent]);
  });
}

beforeEach(() => {
  clearAssistantMetaEventHistory();
  window.sessionStorage.clear();
  decisionEngineMock.current = null;
  renderRevision = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(response(FIXED_PROPOSAL));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearAssistantMetaEventHistory();
  container.remove();
  vi.unstubAllGlobals();
});

describe("AssistantInline proposal lifecycle", () => {
  it("waits for MetaEvents, sends one events-only request, and combines server action with local copy", async () => {
    await renderAssistant(fatigueProposal);
    await flushRequestTask();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();

    await addMetaEvent();
    await flushRequestTask();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant-proposal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ metaEvents: [metaEvent] });
    expect(container.querySelectorAll('[data-element-id="assistant-proposal"]')).toHaveLength(1);
    expect(container.querySelector("h2")?.textContent).toBe(fatigueProposal.title);
    expect(container.textContent).toContain(fatigueProposal.message);
  });

  it("does not request for null decisions or while muted", async () => {
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(null);
    await flushRequestTask();
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      muteAssistantFor(60_000);
    });
    await renderAssistant(fatigueProposal);
    await flushRequestTask();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("keeps empty-search recovery local and preserves its clear action", async () => {
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(frictionProposal);
    await flushRequestTask();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe(frictionProposal.title);
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("BUTTON");
  });

  it("uses local clear-catalog copy and a button for a server clear action", async () => {
    fetchMock.mockResolvedValue(
      response({
        status: "show",
        action: "clear-search-and-filters",
        data: { target: "catalog", filterKeys: [] },
      }),
    );
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(fatigueProposal);
    await flushRequestTask();

    expect(container.querySelector("h2")?.textContent).toBe(
      "Zacznij od pełnego katalogu",
    );
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("BUTTON");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.textContent).toBe(
      "Wyczyść wyszukiwanie i filtry",
    );
  });

  it.each([
    ["hide response", { status: "hide" }],
    ["invalid response", { status: "show", kind: "other" }],
  ])("does not render a fatigue box for a %s", async (_label, body) => {
    fetchMock.mockResolvedValue(response(body));
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(fatigueProposal);
    await flushRequestTask();

    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("ignores an older response after its request is aborted for a newer trigger", async () => {
    const pending: Array<(value: Response) => void> = [];
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => pending.push(resolve)),
    );
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(fatigueProposal);
    await flushRequestTask();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const newerProposal = { ...fatigueProposal, id: "decision-fatigue:return-2" };
    await renderAssistant(newerProposal);
    await flushRequestTask();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit).signal;
    expect(firstSignal?.aborted).toBe(true);
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();

    await act(async () => {
      pending[1]?.(response(FIXED_PROPOSAL));
      await Promise.resolve();
    });
    await act(async () => {
      pending[0]?.(response(FIXED_PROPOSAL));
      await Promise.resolve();
    });

    expect(container.querySelector("h2")?.textContent).toBe(fatigueProposal.title);
    expect(container.querySelectorAll('[data-element-id="assistant-proposal"]')).toHaveLength(1);
  });

  it("dismissal hides the box and mutes the assistant for 15 minutes", async () => {
    recordAssistantMetaEventBatch([metaEvent]);
    await renderAssistant(fatigueProposal);
    await flushRequestTask();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).not.toBeNull();

    const mutedAt = Date.now();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click();
    });

    expect(readAssistantMutedUntil()).toBeGreaterThanOrEqual(
      mutedAt + 15 * 60 * 1000,
    );
    expect(readAssistantMutedUntil()).toBeLessThanOrEqual(
      mutedAt + 15 * 60 * 1000 + 5,
    );
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
