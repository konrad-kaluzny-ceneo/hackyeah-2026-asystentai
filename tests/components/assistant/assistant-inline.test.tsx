import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const decisionEngineMock = vi.hoisted(() => ({
  current: null as AssistantProposal | null,
}));

vi.mock("@/lib/decision-engine", () => ({
  DecisionEngine: vi.fn(() => decisionEngineMock.current),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/katalog/lodowki",
  useRouter: () => ({ replace: vi.fn() }),
}));

import CatalogListing from "@/components/catalog/catalog-listing";
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
  vi.restoreAllMocks();
});

describe("assistant proposal coordinator and listing UI", () => {
  it("can show a different proposal after a duplicate response is suppressed", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    fetchMock.mockResolvedValueOnce(response(SHOW_PROPOSAL))
      .mockResolvedValueOnce(response(SHOW_PROPOSAL))
      .mockResolvedValueOnce(response({
        ...SHOW_PROPOSAL, action: "set-budget", actionLabel: "Ustaw budżet",
        data: { target: "filters", filterKeys: ["price"], categorySlug: "lodowki" },
      }));
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click());
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAssistantProposalUiState().proposal).toBeNull();

    now += 6_000;
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAssistantProposalUiState().proposal?.action).toBe("set-budget");
  });

  it("allows the same useful proposal again after the 30-second cooldown", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click());
    now += 30_000;
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAssistantProposalUiState().proposal?.action).toBe("narrow-choice");
  });

  it.each([
    ["price", "Cena od"],
    ["brand", "Producent"],
    ["capacityLiters", "Pojemność od"],
  ])("focuses and highlights the %s filter after cross-page navigation", async (filterKey, label) => {
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, "", `/katalog/lodowki#filter-${filterKey}`);
    try {
      await act(async () => root.render(<CatalogListing
        category={{
          id: "lodowki", slug: "lodowki", name: "Lodówki", description: "", imageUrl: "",
          specFilters: [{ key: "capacityLiters", label: "Pojemność", kind: "range", min: 100, max: 500 }],
        }}
        products={[]}
      />));
      expect(document.activeElement?.getAttribute("data-filter-id")).toBe(filterKey);
      const focusedControl = document.activeElement as HTMLInputElement | HTMLSelectElement | null;
      expect(focusedControl?.getAttribute("aria-label") ?? focusedControl?.labels?.[0]?.textContent).toContain(label);
      expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      const filter = container.querySelector(`#filter-${filterKey}`);
      expect(filter?.textContent).toBeTruthy();

      window.history.replaceState(null, "", "/katalog/lodowki#filter-brand");
      await act(async () => window.dispatchEvent(new Event("hashchange")));
      expect(document.activeElement?.getAttribute("data-filter-id")).toBe("brand");
      expect(container.querySelector('#filter-brand')?.getAttribute("data-highlighted")).toBe("true");
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll;
      window.history.replaceState(null, "", "/");
    }
  });

  it("keeps the proposal hidden until the response arrives", async () => {
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

    expect(container.querySelector('[data-ai-request-state="pending"]')).toBeNull();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();

    await act(async () => resolveResponse?.(response(SHOW_PROPOSAL)));
    await flushRequestTasks();

    expect(
      container.querySelector('[data-ai-request-state="complete"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain(SHOW_PROPOSAL.message);
  });

  it("renders the fox illustration selected by the server", async () => {
    fetchMock.mockResolvedValue(
      response({
        ...SHOW_PROPOSAL,
        data: {
          ...SHOW_PROPOSAL.data,
          illustration: "fox-celebrating",
        },
      }),
    );

    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    const illustration = container.querySelector<HTMLImageElement>(
      '[data-element-id="assistant-proposal"] img',
    );
    expect(illustration?.src).toContain(
      "fox-celebrating.png",
    );
    expect(illustration?.alt).toBe("Lisek cieszy się z dobrego wyboru");
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
    expect(filtersLink?.getAttribute("href")).toBe("/katalog#filters");
  });

  it("does not call the server while muted", async () => {
    await act(async () => muteAssistantFor(60_000));
    await renderAssistant();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it.each([
    ["set-budget", "Ustaw budżet", "/katalog/lodowki#filter-price"],
    ["choose-brand", "Wybierz producenta", "/katalog/lodowki#filter-brand"],
    ["browse-category", "Zobacz kategorię", "/katalog/lodowki"],
    ["narrow-choice", "Przejdź do filtrów", "/katalog/lodowki#filter-capacityLiters"],
  ])("navigates %s from the root widget and closes the notification", async (action, label, href) => {
    fetchMock.mockResolvedValue(response({
      ...SHOW_PROPOSAL,
      action,
      actionLabel: label,
      data: {
        target: action === "browse-category" ? "catalog" : "filters",
        filterKeys: action === "narrow-choice" ? ["capacityLiters"] : [],
        categorySlug: "lodowki",
      },
    }));
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL);
    await flushRequestTasks();

    const link = container.querySelector<HTMLAnchorElement>('[data-element-id="assistant-action"]');
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.textContent).toBe(label);
    expect(container.querySelectorAll('[data-element-id="assistant-action"]')).toHaveLength(1);

    link?.addEventListener("click", (event) => event.preventDefault());
    await act(async () => link?.click());
    expect(getAssistantProposalUiState().proposal).toBeNull();
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

  it("coalesces an event burst into one request without showing loading", async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    await renderCoordinatorOnly();
    await recordEvents(MIN_ASSISTANT_META_EVENTS_FOR_PROPOSAL + 1);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-ai-request-state="pending"]')).toBeNull();

    await recordEvents(2);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-ai-request-state="pending"]')).toBeNull();

    await act(async () => resolveResponse?.(response({ status: "hide" })));
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-ai-request-state="pending"]')).toBeNull();
  });

  it("dismissal clears the shared proposal without blocking later requests", async () => {
    fetchMock
      .mockResolvedValueOnce(response(SHOW_PROPOSAL))
      .mockResolvedValueOnce(
        response({
          ...SHOW_PROPOSAL,
          action: "sort-by-price",
          actionLabel: "Sortuj po cenie",
          data: { target: "catalog", filterKeys: [], sort: "price_asc" },
        }),
      );
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
