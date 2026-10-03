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

const SHOWN_PROPOSALS_STORAGE_KEY = "assistant:shown-proposals";
const LAST_PROPOSAL_STORAGE_KEY = "assistant:last-proposal";
const PROPOSAL_COOLDOWN_MS = 90_000;
const MAX_SHOWN_PROPOSALS = 30;

type LastProposal = {
  action: AssistantProposal["action"];
  key: string;
  shownAt: number;
};

function readSessionJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.sessionStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

function proposalKey(proposal: Pick<AssistantProposal, "action" | "data">): string {
  return JSON.stringify({
    action: proposal.action,
    categorySlug: proposal.data.categorySlug ?? null,
    filterKeys: [...proposal.data.filterKeys].sort(),
    productSlug: proposal.data.productSlug ?? null,
    sort: proposal.data.sort ?? null,
  });
}

export function shouldSuppressAssistantProposal(
  proposal: Pick<AssistantProposal, "action" | "data">,
): boolean {
  const key = proposalKey(proposal);
  const shown = readSessionJson<string[]>(SHOWN_PROPOSALS_STORAGE_KEY, []);
  if (shown.includes(key)) return true;

  const last = readSessionJson<LastProposal | null>(LAST_PROPOSAL_STORAGE_KEY, null);
  return (
    last !== null &&
    last.action === proposal.action &&
    Date.now() - last.shownAt < PROPOSAL_COOLDOWN_MS
  );
}

export function recordAssistantProposalShown(
  proposal: Pick<AssistantProposal, "action" | "data">,
): void {
  if (typeof window === "undefined") return;
  const key = proposalKey(proposal);
  const shown = readSessionJson<string[]>(SHOWN_PROPOSALS_STORAGE_KEY, []).filter(
    (item) => item !== key,
  );
  shown.push(key);
  window.sessionStorage.setItem(
    SHOWN_PROPOSALS_STORAGE_KEY,
    JSON.stringify(shown.slice(-MAX_SHOWN_PROPOSALS)),
  );
  window.sessionStorage.setItem(
    LAST_PROPOSAL_STORAGE_KEY,
    JSON.stringify({ action: proposal.action, key, shownAt: Date.now() } satisfies LastProposal),
  );
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}
