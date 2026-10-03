import type { AssistantProposal } from "@/lib/catalog-types";

export type AssistantProposalUiState = Readonly<{
  proposal: AssistantProposal | null;
  searchRecoveryVisible: boolean;
}>;

type Listener = () => void;

let state: AssistantProposalUiState = {
  proposal: null,
  searchRecoveryVisible: false,
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

export function setAssistantSearchRecoveryVisible(visible: boolean): void {
  if (state.searchRecoveryVisible === visible) return;
  state = { ...state, searchRecoveryVisible: visible };
  notifyListeners();
}

export function clearAssistantProposalUiState(): void {
  if (state.proposal === null && !state.searchRecoveryVisible) return;
  state = { proposal: null, searchRecoveryVisible: false };
  notifyListeners();
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}
