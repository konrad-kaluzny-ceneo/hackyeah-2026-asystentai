import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearAssistantMetaEventHistory,
  recordAssistantMetaEventBatch,
} from "@/behavior/assistant-meta-event-history";
import { AssistantProposalCoordinator } from "@/components/assistant/assistant-proposal-coordinator";
import { AssistantInline } from "@/components/assistant/assistant-inline";
import { muteAssistantFor, readAssistantMutedUntil } from "@/lib/assistant-events";
import { clearAssistantProposalUiState } from "@/lib/assistant-proposal-state";
import type { CatalogState, Category, Product } from "@/lib/catalog-types";
import { makeMetaEvent, resetFixtureSeed } from "../../behavior/fixtures";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FIXED_PROPOSAL = {
  status: "show",
  kind: "jev_proposal",
  situation: "PRODUCT_HESITATION",
  title: "Stała propozycja",
  message: "To demonstracyjna podpowiedź.",
  action: "narrow-choice",
  actionLabel: "Przejdź do filtrów",
} as const;

const category: Category = {
  id: "category-fridges",
  slug: "lodowki",
  name: "Lodówki",
  description: "",
  imageUrl: "",
  specFilters: [
    { key: "capacityLiters", label: "Pojemność", kind: "range", min: 100, max: 500 },
  ],
};

const products: Product[] = [300, 320, 340].map((capacity, index) => ({
  id: `fridge-${index + 1}`,
  slug: `fridge-${index + 1}`,
  categorySlug: category.slug,
  categoryId: category.id,
  brandId: "brand-demo",
  brand: "Demo",
  model: `F-${index + 1}`,
  name: `Lodówka ${index + 1}`,
  price: 2_000 + index * 100,
  shortDescription: "Model demonstracyjny",
  description: "Model demonstracyjny",
  imageUrl: "",
  specifications: { capacityLiters: capacity },
}));

const catalog = { categories: [category], products };
const catalogState: CatalogState = {
  categorySlug: category.slug,
  query: "",
  filters: {},
  resultCount: products.length,
  page: 1,
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let clearSearch: ReturnType<typeof vi.fn>;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function metaEvent(index: number) {
  return makeMetaEvent("rage_click", {
    eventId: `meta-event-${index}`,
    detectedAt: new Date(1_800_000_000_000 + index * 1_000).toISOString(),
  });
}

async function renderAssistant(state = catalogState) {
  await act(async () => {
    root.render(
      <>
        <AssistantProposalCoordinator />
        <AssistantInline
          state={state}
          catalog={catalog}
          onClearSearchAndFilters={clearSearch}
        />
      </>,
    );
  });
}

async function renderCoordinatorOnly() {
  await act(async () => {
    root.render(<AssistantProposalCoordinator />);
  });
}

async function flushRequestTasks() {
  await act(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 5));
  });
}

async function addMetaEvents(...indexes: number[]) {
  await act(async () => {
    recordAssistantMetaEventBatch(indexes.map(metaEvent));
  });
}

beforeEach(() => {
  clearAssistantMetaEventHistory();
  clearAssistantProposalUiState();
  resetFixtureSeed();
  window.sessionStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(response(FIXED_PROPOSAL));
  vi.stubGlobal("fetch", fetchMock);
  clearSearch = vi.fn();
});

afterEach(async () => {
  await act(async () => root.unmount());
  clearAssistantMetaEventHistory();
  clearAssistantProposalUiState();
  container.remove();
  vi.unstubAllGlobals();
});

describe("AssistantInline MetaEvent proposal lifecycle", () => {
  it("sends the threshold request while the shopper is off the listing page", async () => {
    await renderCoordinatorOnly();
    await addMetaEvents(1, 2, 3, 4);
    await flushRequestTasks();
    expect(fetchMock).not.toHaveBeenCalled();

    await addMetaEvents(5);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await renderAssistant();
    expect(container.querySelector("h2")?.textContent).toBe(FIXED_PROPOSAL.title);
  });

  it("waits for five events, then sends only MetaEvents and renders a known-state proposal", async () => {
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4);
    await flushRequestTasks();
    expect(fetchMock).not.toHaveBeenCalled();

    await addMetaEvents(5);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/assistant-proposal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      metaEvents: [1, 2, 3, 4, 5].map(metaEvent),
    });
    expect(container.querySelectorAll('[data-element-id="assistant-proposal"]')).toHaveLength(1);
    expect(container.querySelector("h2")?.textContent).toBe(FIXED_PROPOSAL.title);
  });

  it("queues one request for each event after the threshold until one shows", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ status: "hide" }))
      .mockResolvedValueOnce(response({ status: "hide" }))
      .mockResolvedValueOnce(response(FIXED_PROPOSAL));
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4);
    await addMetaEvents(5, 6);
    await flushRequestTasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      metaEvents: [1, 2, 3, 4, 5].map(metaEvent),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      metaEvents: [1, 2, 3, 4, 5, 6].map(metaEvent),
    });

    await addMetaEvents(7);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      metaEvents: [1, 2, 3, 4, 5, 6, 7].map(metaEvent),
    });
    expect(container.querySelectorAll('[data-element-id="assistant-proposal"]')).toHaveLength(1);

    await addMetaEvents(8);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not request while muted", async () => {
    muteAssistantFor(60_000);
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4, 5, 6);
    await flushRequestTasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();
  });

  it("keeps empty-search recovery local and suppresses Jev requests", async () => {
    await renderAssistant({
      ...catalogState,
      query: "no such product",
      resultCount: 0,
    });
    await addMetaEvents(1, 2, 3, 4, 5, 6);
    await flushRequestTasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe("Nie znaleźliśmy produktów");
    expect(container.querySelector('[data-element-id="assistant-action"]')?.tagName).toBe("BUTTON");
  });

  it("hides invalid responses and retries on the next event", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ status: "show", kind: "unknown" }))
      .mockResolvedValueOnce(response(FIXED_PROPOSAL));
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4, 5);
    await flushRequestTasks();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();

    await addMetaEvents(6);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector("h2")?.textContent).toBe(FIXED_PROPOSAL.title);
  });

  it("aborts and ignores a pending Jev result when local empty-search recovery takes priority", async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => { resolveRequest = resolve; }),
    );
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4, 5);
    await flushRequestTasks();
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(requestSignal?.aborted).toBe(false);

    await renderAssistant({
      ...catalogState,
      query: "no such product",
      resultCount: 0,
    });
    expect(requestSignal?.aborted).toBe(true);

    await act(async () => {
      resolveRequest?.(response(FIXED_PROPOSAL));
      await Promise.resolve();
    });
    expect(container.querySelector("h2")?.textContent).toBe("Nie znaleźliśmy produktów");
  });

  it("dismissal hides the box and mutes the assistant for 15 minutes", async () => {
    await renderAssistant();
    await addMetaEvents(1, 2, 3, 4, 5);
    await flushRequestTasks();
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).not.toBeNull();

    const mutedAt = Date.now();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-element-id="assistant-dismiss"]')?.click();
    });

    expect(readAssistantMutedUntil()).toBeGreaterThanOrEqual(mutedAt + 15 * 60 * 1000);
    expect(readAssistantMutedUntil()).toBeLessThanOrEqual(mutedAt + 15 * 60 * 1000 + 5);
    expect(container.querySelector('[data-element-id="assistant-proposal"]')).toBeNull();

    await addMetaEvents(6);
    await flushRequestTasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
