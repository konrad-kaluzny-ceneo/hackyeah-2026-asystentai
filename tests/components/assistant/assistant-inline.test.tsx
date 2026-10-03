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
    action:
      | "narrow-choice"
      | "clear-search-and-filters"
      | "go-to-product"
      | "sort-by-price"
      | "explain-choice"
      | "none";
    data: {
      target: "filters" | "catalog" | "product";
      filterKeys: string[];
      productSlug?: string;
      sort?: "price_asc" | "price_desc";
    };
    createdAt: string;
  },
}));

vi.mock("@/lib/decision-engine", () => ({
  DecisionEngine: vi.fn(() => decisionEngineMock.current),
}));

import { AssistantInline } from "@/components/assistant/assistant-inline";
import { AssistantProposalCoordinator } from "@/components/assistant/assistant-proposal-coordinator";
import { AssistantProposalWidget } from "@/components/assistant/assistant-proposal-widget";
import {
  clearAssistantMetaEventHistory,
  MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL,
  recordAssistantMetaEventBatch,
} from "@/behavior/assistant-meta-event-history";
import { clearAssistantProposalUiState, getAssistantProposalUiState } from "@/lib/assistant-proposal-state";
import {
  muteAssistantFor,
} from "@/lib/assistant-events";
import type { AssistantProposal, CatalogState } from "@/lib/catalog-types";
import { makeMetaEvent, resetFixtureSeed } from "../../behavior/fixtures";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SHOW_PROPOSAL = {
  status: "show",
  title: "Pomóc zawęzić wybór?",
  message: "Na podstawie ostatniej aktywności warto zawęzić wybór.",
  action: "narrow-choice",
  actionLabel: "Przejdź do filtrów",
  data: { target: "filters" as const, filterKeys: [] },
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

async function renderAssistant(
  decision: AssistantProposal | null = fatigueProposal,
  state: CatalogState = catalogState,
) {
  decisionEngineMock.current = decision;
  await act(async () => {
    root.render(
      <>
        <AssistantProposalCoordinator />
        <AssistantProposalWidget />
        <AssistantInline
          state={state}
          catalog={catalog}
          onClearSearchAndFilters={vi.fn()}
        />
      </>,
    );
  });
}

async function renderCoordinatorOnly() {
  await act(async () =>
    root.render(
      <>
        <AssistantProposalCoordinator />
        <AssistantProposalWidget />
      </>,
    ),
  );
}

async function flushRequestTasks() {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 10));
  });
}

async function recordEvents(count: number) {
  await act(async () => recordAssistantMetaEventBatch(nextMetaEvents(count)));
}

beforeEach(() => {
  clearAssistantMetaEventHistory();
  clearAssistantProposalUiState();
  resetFixtureSeed();
  window.sessionStorage.clear();
  decisionEngineMock.current = null;
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
  clearAssistantProposalUiState();
  container.remove();
  vi.unstubAllGlobals();
});

describe("assistant proposal coordinator and listing UI", () => {
  it("shows a visible OpenAI request state until the response arrives", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    expect(
      container.querySelector('[data-ai-request-state="pending"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Wysyłanie requestu do OpenAI");

    await act(async () => resolveResponse?.(response(SHOW_PROPOSAL)));
    await flushRequestTasks();

    expect(
      container.querySelector('[data-ai-request-state="pending"]'),
    ).toBeNull();
    expect(container.textContent).toContain(SHOW_PROPOSAL.message);
  });

  it("waits for five events and can complete classification off the listing page", async () => {
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL - 1);
    await flushRequestTasks();
    expect(fetchMock).not.toHaveBeenCalled();

    await recordEvents(1);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant-proposal");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { metaEvents: unknown[] };
    expect(body.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    expect(getAssistantProposalUiState().proposal?.data).toEqual({
      target: "filters",
      filterKeys: [],
    });

    await renderAssistant();
    expect(container.querySelector("h2")?.textContent).toBe("Pomóc zawęzić wybór?");
    const widget = container.querySelector<HTMLElement>('[data-assistant-popover="filters"]');
    expect(widget).not.toBeNull();
    expect(widget?.className).toContain("fixed");
    const filtersLink = container.querySelector<HTMLAnchorElement>(
      '[data-element-id="assistant-action"]',
    );
    expect(filtersLink?.tagName).toBe("A");
    expect(filtersLink?.getAttribute("href")).toBe("#filters");
  });

  it("does not call the server while muted", async () => {
    await act(async () => muteAssistantFor(60_000));
    await renderAssistant();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("does not show a predefined proposal for an empty search", async () => {
    const emptySearchState = {
      ...catalogState,
      query: "no-matching-product",
      resultCount: 0,
    };
    await renderAssistant(null, emptySearchState);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).not.toContain("Nie znaleźliśmy produktów");
  });

  it("uses server copy while keeping the filter action local", async () => {
    fetchMock.mockResolvedValue(
      response({
        status: "show",
        title: "Pomogę zawęzić wybór",
        message: "Wskaż parametr, który ma dla Ciebie największe znaczenie.",
        action: "narrow-choice",
        actionLabel: "Przejdź do filtrów",
        data: { target: "filters", filterKeys: [] },
      }),
    );
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    await renderAssistant();

    expect(container.querySelector("h2")?.textContent).toBe("Pomogę zawęzić wybór");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("A");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.textContent).toBe(
      "Przejdź do filtrów",
    );
  });

  it.each([
    ["hide response", { status: "hide" }],
    ["invalid response", { status: "show", kind: "other" }],
  ])("does not render a box for a %s", async (_label, body) => {
    fetchMock.mockResolvedValue(response(body));
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    await renderAssistant(null);

    expect(getAssistantProposalUiState().proposal).toBeNull();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("serializes event snapshots and continues after a hide response", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ status: "hide" }))
      .mockResolvedValueOnce(response(SHOW_PROPOSAL));
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL + 1);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { metaEvents: unknown[] };
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { metaEvents: unknown[] };
    expect(firstBody.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    expect(secondBody.metaEvents).toHaveLength(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL + 1);
  });

  it("dismissal clears the shared proposal without blocking later requests", async () => {
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    await renderAssistant();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click();
    });

    expect(getAssistantProposalUiState().proposal).toBeNull();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).not.toBeNull();
  });
});
