import type { AssistantProposal } from "@/lib/catalog-types";

export type AssistantProposalUiState = Readonly<{
  proposal: AssistantProposal | null;
  searchRecoveryVisible: boolean;
  requestInFlight: boolean;
}>;

type Listener = () => void;

/** Assistant asks the catalog UI to execute a concrete side effect. */
export type AssistantCatalogAction =
  | { type: "clear-search-and-filters" }
  | { type: "highlight-filters"; filterKeys: string[] }
  | { type: "sort-by-price"; sort: "price_asc" | "price_desc" };

export const ASSISTANT_CATALOG_ACTION_EVENT = "assistant-catalog-action";

export function dispatchAssistantCatalogAction(action: AssistantCatalogAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AssistantCatalogAction>(ASSISTANT_CATALOG_ACTION_EVENT, {
      detail: action,
    }),
  );
}

export function subscribeAssistantCatalogAction(
  listener: (action: AssistantCatalogAction) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<AssistantCatalogAction>;
    if (custom.detail) listener(custom.detail);
  };
  window.addEventListener(ASSISTANT_CATALOG_ACTION_EVENT, handler);
  return () => window.removeEventListener(ASSISTANT_CATALOG_ACTION_EVENT, handler);
}

let state: AssistantProposalUiState = {
  proposal: null,
  searchRecoveryVisible: false,
  requestInFlight: false,
};
const listeners = new Set<Listener>();

export function getAssistantProposalUiState(): AssistantProposalUiState {
  return state;
}

export function subscribeAssistantProposalUiState(
  listener: Listener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAssistantServerProposal(
  proposal: AssistantProposal | null,
): void {
  if (state.proposal === proposal) return;
  state = { ...state, proposal };
  notifyListeners();
}

export function setAssistantRequestInFlight(inFlight: boolean): void {
  if (state.requestInFlight === inFlight) return;
  state = { ...state, requestInFlight: inFlight };
  notifyListeners();
}

export function setAssistantSearchRecoveryVisible(visible: boolean): void {
  if (state.searchRecoveryVisible === visible) return;
  state = { ...state, searchRecoveryVisible: visible };
  notifyListeners();
}

export function clearAssistantProposalUiState(): void {
  if (
    state.proposal === null &&
    !state.searchRecoveryVisible &&
    !state.requestInFlight
  ) return;
  state = { proposal: null, searchRecoveryVisible: false, requestInFlight: false };
  notifyListeners();
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}
