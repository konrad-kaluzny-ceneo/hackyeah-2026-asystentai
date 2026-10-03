"""Transform preprocessed MetaEvents into rich prompts and inputs for the AI Assistant.

Aligned with the MetaEvent data contract (docs/meta-behavior-event-data-contract.md)
and the Product Requirements Document (context/foundation/prd.md):
- Analyzes observable behavioral meta-events (not emotional guesswork).
- Generates EXACTLY ONE contextual next-step proposal or clarifying question.
- Weights recommendations by signal strength and enforces hedging when confidence is moderate.
- Supports DO_NOTHING for smooth browsing or weak signals to avoid user intrusion.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

import pandas as pd
from pydantic import BaseModel, Field, field_validator

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "preprocessed_ecommerce_events.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "jev_prompts.jsonl"
DEFAULT_GROUND_TRUTH = PROJECT_ROOT / "data" / "sessions_ground_truth.csv"

# ============================================================================
# SHOPPING SITUATIONS & ACTION TAXONOMY (PRD US-01, US-02)
# ============================================================================

SITUATIONS: dict[str, str] = {
    "DECISION_FATIGUE": (
        "Przeciążenie decyzyjne wywołane zbyt wieloma zbliżonymi modelami AGD. "
        "Sygnały: wielokrotne przechodzenie w tę i z powrotem między 2-4 produktami "
        "(comparison_oscillation) lub gwałtowne zmiany i cofanie filtrów (rapid_filter_churn)."
    ),
    "PRODUCT_HESITATION": (
        "Wahanie i powrót do wcześniej oglądanego produktu po przejrzeniu alternatyw. "
        "Sygnały: ponowne wejście na tę samą kartę produktu (product_revisit) "
        "lub długie oglądanie parametrów bez finalizacji wyboru."
    ),
    "NO_PROGRESS_STALL": (
        "Aktywne przeglądanie katalogu bez przechodzenia do szczegółów produktów. "
        "Sygnały: okno braku postępu (no_progress_window) z dużą liczbą kliknięć i przewinięć."
    ),
    "UI_FRICTION": (
        "Trudności techniczne lub bariery interfejsu w katalogu. "
        "Sygnały: seria kliknięć bez odpowiedzi interfejsu (rage_click) "
        "lub klikanie w nieaktywne elementy z następową ciszą (dead_click_cluster)."
    ),
    "SMOOTH_EXPLORATION": (
        "Płynne, bezproblemowe przeglądanie asortymentu według własnego planu użytkownika. "
        "Brak sygnałów tarcia i zmęczenia decyzyjnego. Wymagana postawa: brak nieproszonych popupów (DO_NOTHING)."
    ),
}

ALL_SITUATIONS: list[str] = list(SITUATIONS.keys())

PROPOSAL_ACTIONS: dict[str, str] = {
    "NARROW_BY_SPEC": "Zaproponuj zawężenie wyboru jednym kluczowym parametrem (np. głębokość pralki, klasa energetyczna, głośność).",
    "COMPARE_MODELS": "Zaproponuj bezpośrednie zestawienie 2 modeli, między którymi użytkownik oscyluje.",
    "RESET_FILTERS": "Zaproponuj wyczyszczenie sprzecznych filtrów lub powrót do szerszego widoku kategorii.",
    "GUIDE_CATEGORY": "Zaproponuj pomoc w określeniu priorytetów wyboru w danej kategorii AGD.",
    "ASSIST_FRICTION": "Zaoferuj pomoc w nawigacji lub alternatywny sposób dotarcia do poszukiwanego parametru.",
    "DO_NOTHING": "Pozostań ukryty lub dyskretny — nie przeszkadzaj użytkownikowi w swobodnym przeglądaniu.",
}

# ============================================================================
# PYDANTIC SCHEMAS (Validation for Assistant Outputs)
# ============================================================================


class SingleProposal(BaseModel):
    """Exactly one proposal from the AI Assistant (PRD Guardrail)."""

    action_type: Literal[
        "NARROW_BY_SPEC",
        "COMPARE_MODELS",
        "RESET_FILTERS",
        "GUIDE_CATEGORY",
        "ASSIST_FRICTION",
        "DO_NOTHING",
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    hedging_required: bool = Field(
        description="True when confidence < 0.75; proposal must use cautious phrasing"
    )
    message_draft: str | None = Field(
        default=None,
        description="Short, empathetic proposal message to display in the assistant box (or null if DO_NOTHING)",
    )
    action_payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Action metadata (e.g. suggested filter id, product IDs to compare)",
    )
    reasoning: str


class JevAssistantResponse(BaseModel):
    """Structured response schema expected from the Assistant AI."""

    situation: str
    primary_meta_event: str
    signal_strength: float = Field(ge=0.0, le=1.0)
    key_evidence: list[str] = Field(default_factory=list)
    user_context_summary: str
    proposal: SingleProposal

    @field_validator("situation")
    @classmethod
    def validate_situation(cls, value: str) -> str:
        if value not in ALL_SITUATIONS:
            raise ValueError(f"Niepoprawna sytuacja: '{value}'. Dozwolone: {ALL_SITUATIONS}")
        return value


@dataclass
class JevPromptRecord:
    """Unified container for an LLM input record."""

    session_id: str
    trigger_event_id: str
    trigger_action: str
    trigger_timestamp: str
    prompt: str
    system_prompt: str
    user_prompt: str
    session_metadata: dict[str, Any]
    persona: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "trigger_event_id": self.trigger_event_id,
            "trigger_action": self.trigger_action,
            "trigger_timestamp": self.trigger_timestamp,
            "prompt": self.prompt,
            "system_prompt": self.system_prompt,
            "user_prompt": self.user_prompt,
            "session_metadata": self.session_metadata,
            **({"persona": self.persona} if self.persona else {}),
        }

    def to_chat_messages(self) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": self.user_prompt},
        ]

    def to_json(self, indent: int | None = None) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


# ============================================================================
# CONTEXT EXTRACTION & FORMATTING HELPERS
# ============================================================================


def _parse_json(val: Any) -> dict[str, Any]:
    if isinstance(val, dict):
        return val
    if not val or pd.isna(val):
        return {}
    try:
        parsed = json.loads(val)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}


def format_meta_events_table(events: list[dict[str, Any]]) -> str:
    """Format detected MetaEvents for LLM consumption."""
    if not events:
        return "Brak zarejestrowanych wzorców behawioralnych (sesja przebiega bez zakłóceń)."

    lines = []
    for idx, e in enumerate(events, start=1):
        name = e.get("event_name", "unknown")
        detected = str(e.get("detected_at", ""))
        ts = detected[11:19] if len(detected) >= 19 else detected
        strength = float(e.get("strength", 0.0))
        metrics = _parse_json(e.get("metrics"))
        metrics_str = ", ".join(f"{k}: {v}" for k, v in metrics.items())
        page_type = e.get("page_type", "katalog")
        subject = f" (obiekt: {e.get('subject_id')})" if e.get("subject_id") else ""

        lines.append(f"{idx}. [{ts}] Sygnał: {name.upper()}{subject} na stronie [{page_type}]")
        lines.append(f"   Siła sygnału (strength): {strength:.2f} | Metryki: {metrics_str}")
    return "\n".join(lines)


def render_system_prompt() -> str:
    """Render system instructions containing the exact PRD requirements and taxonomy."""
    situations_text = "\n".join(f"- **{k}**:\n  {v}" for k, v in SITUATIONS.items())
    actions_text = "\n".join(f"- **{k}**: {v}" for k, v in PROPOSAL_ACTIONS.items())

    return f"""Jesteś wyspecjalizowanym modułem analityczno-decyzyjnym "Asystent AI — intencje na bieżąco" w sklepie ze sprzętem AGD.
Twoim celem jest analiza zagregowanych sygnałów zachowania użytkownika (zdarzeń MetaEvent) i wygenerowanie DOKŁADNIE JEDNEJ kontekstowej propozycji następnego kroku lub pytania doprecyzowującego.

======================================================================
ZASADY DZIAŁANIA (GUARDRAILS Z PRD I KONTRAKTU DANYCH):
======================================================================
1. ŚCIŚLE JEDNA PROPOZYCJA: Prezentujesz co najwyżej jedną propozycję na raz.
2. BRAK ZGADYWANIA EMOCJI: Rekordy MetaEvent to obiektywne sygnały zachowania (np. rage_click, comparison_oscillation), a nie dowód na emocje użytkownika. Nie używaj w wypowiedziach diagnoz psychologicznych ani oskarżycielskiego tonu.
3. JĘZYK NIEPEWNOŚCI PRZY SŁABYM SYGNALE:
   - Jeśli 'signal_strength' < 0.75, MUSISZ użyć formy pytającej lub języka niepewności (np. "Zauważyłem, że porównujesz te modele. Czy zależy Ci na konkretnym wymiarze?").
   - Jeśli sygnał jest bardzo słaby (< 0.5) lub brak sygnałów (SMOOTH_EXPLORATION), wybierz 'DO_NOTHING' i message_draft = null, aby nie przeszkadzać użytkownikowi.
4. BEZ KOSZYKA I LOGOWANIA: MVP nie zawiera operacji na koszyku ani kont użytkowników (sesja jest w 100% anonimowa). Proponuj wyłącznie pomoc merytoryczną w katalogu (filtry, specyfikacja, porównanie).

======================================================================
DOZWOLONE SYTUACJE (SITUATIONS):
======================================================================
{situations_text}

======================================================================
DOZWOLONE AKCJE PROPOZYCJI (PROPOSAL_ACTIONS):
======================================================================
{actions_text}

======================================================================
FORMAT ODPOWIEDZI:
======================================================================
Zwróć wynik WYŁĄCZNIE jako poprawny obiekt JSON, bez zbędnych wstępów, ściśle według schematu:
{{
  "situation": "DECISION_FATIGUE | PRODUCT_HESITATION | NO_PROGRESS_STALL | UI_FRICTION | SMOOTH_EXPLORATION",
  "primary_meta_event": "<nazwa wiodącego zdarzenia MetaEvent lub 'none'>",
  "signal_strength": 0.0 - 1.0,
  "key_evidence": [
    "np. 5 naprzemiennych przejść między 3 modelami pralek w ciągu 2 minut",
    "brak zawężenia puli produktów w drugiej połowie sesji"
  ],
  "user_context_summary": "krótkie podsumowanie aktualnej sytuacji użytkownika w katalogu",
  "proposal": {{
    "action_type": "NARROW_BY_SPEC | COMPARE_MODELS | RESET_FILTERS | GUIDE_CATEGORY | ASSIST_FRICTION | DO_NOTHING",
    "confidence": 0.0 - 1.0,
    "hedging_required": true | false,
    "message_draft": "krótka, empatyczna treść propozycji w okienku asystenta (lub null dla DO_NOTHING)",
    "action_payload": {{
      "parameter": "np. szerokość / głębokość / głośność",
      "suggested_models": ["p-bosch-serie6", "p-samsung-ecobubble"]
    }},
    "reasoning": "zwięzłe uzasadnienie wyboru akcji na podstawie siły sygnału i kontekstu"
  }}
}}"""


def render_user_prompt(
    session_id: str,
    meta_events: list[dict[str, Any]],
    latest_event: dict[str, Any] | None = None,
) -> str:
    """Render the user context and MetaEvents snapshot for the LLM."""
    anchor = latest_event or (meta_events[-1] if meta_events else {})
    ecom = _parse_json(anchor.get("ecommerce_context"))
    active_filters = ecom.get("activeFilters", [])
    filters_desc = ", ".join(f"{f.get('id')}: {f.get('valueIds')}" for f in active_filters) if active_filters else "brak aktywnych filtrów"

    category = anchor.get("category_id") or "sprzęt AGD"
    product = anchor.get("subject_id") or "brak"
    page_type = anchor.get("page_type") or "katalog"

    primary_name = anchor.get("event_name", "brak")
    strength = float(anchor.get("strength", 0.0))

    return f"""PRZEANALIZUJ PONIŻSZE DANE SESJI I PRZYGOTUJ JEDNĄ PROPOZYCJĘ ASYSTENTA:

----------------------------------------------------------------------
1. KONTEKST BIEŻĄCEJ SESJI:
----------------------------------------------------------------------
- Identyfikator sesji: {session_id}
- Kategoria przeglądana: {category}
- Aktualny typ podstrony: {page_type}
- Ostatnio powiązany produkt: {product}
- Aktywne filtry w katalogu: {filters_desc}
- Liczba wykrytych sygnałów behawioralnych: {len(meta_events)}
- Główny sygnał wyzwalający: {primary_name} (siła sygnału: {strength:.2f})

----------------------------------------------------------------------
2. ZAREJESTROWANE WZORCE ZACHOWANIA (METAEVENTS):
----------------------------------------------------------------------
{format_meta_events_table(meta_events)}

----------------------------------------------------------------------
TWOJE ZADANIE:
----------------------------------------------------------------------
Na podstawie powyższych faktów behawioralnych określ sytuację użytkownika i sformułuj DOKŁADNIE JEDNĄ propozycję asystenta, przestrzegając reguły siły sygnału (hedging language przy strength < 0.75, DO_NOTHING przy braku tarcia lub słabym sygnale).
Zwróć poprawny obiekt JSON."""


# Backwards compatibility aliases
JevEmotionResponse = JevAssistantResponse
USER_STATES = SITUATIONS
ALL_USER_STATES = ALL_SITUATIONS
STATE_DESCRIPTIONS = SITUATIONS
STATE_TO_CATEGORY = {s: "shopping_context" for s in ALL_SITUATIONS}


def build_prompt(
    session_id: str,
    meta_events: list[dict[str, Any]],
    trigger: dict[str, Any] | None = None,
) -> str:
    """Build full prompt text (system + user prompt)."""
    system_prompt = render_system_prompt()
    user_prompt = render_user_prompt(session_id, meta_events, trigger)
    return f"{system_prompt}\n\n======================================================================\n\n{user_prompt}"


build_jev_prompt = build_prompt


def load_ground_truth(path: Path | str = DEFAULT_GROUND_TRUTH) -> dict[str, str]:
    """Load session_id -> persona mapping from ground truth CSV."""
    p = Path(path)
    if not p.exists():
        return {}
    gt_df = pd.read_csv(p)
    return dict(zip(gt_df["session_id"].astype(str), gt_df["persona"].astype(str)))


class JevPromptBuilder:
    """Builds prompt records from MetaEvents DataFrame."""

    def __init__(self, mode: str = "smart") -> None:
        self.mode = mode

    def build_record_for_session(
        self,
        session_id: str,
        events: list[dict[str, Any]],
        persona: str | None = None,
    ) -> JevPromptRecord:
        # Find trigger event: peak strength event or latest
        if events:
            # Sort by strength desc, then detected_at desc
            strongest = max(events, key=lambda e: float(e.get("strength", 0.0)))
            trigger = strongest
        else:
            trigger = {
                "event_id": f"dummy_{session_id}",
                "event_name": "none",
                "detected_at": "",
                "strength": 0.0,
                "page_type": "catalog",
            }

        system_prompt = render_system_prompt()
        user_prompt = render_user_prompt(session_id, events, trigger)
        full_prompt = f"{system_prompt}\n\n======================================================================\n\n{user_prompt}"

        metadata = {
            "session_id": session_id,
            "meta_events_count": len(events),
            "primary_signal": trigger.get("event_name"),
            "primary_strength": float(trigger.get("strength", 0.0)),
            "category_id": trigger.get("category_id"),
            "subject_id": trigger.get("subject_id"),
        }

        return JevPromptRecord(
            session_id=session_id,
            trigger_event_id=str(trigger.get("event_id", "")),
            trigger_action=str(trigger.get("event_name", "NONE")),
            trigger_timestamp=str(trigger.get("detected_at", "")),
            prompt=full_prompt,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            session_metadata=metadata,
            persona=persona,
        )

    def build_from_dataframe(
        self,
        meta_df: pd.DataFrame,
        ground_truth: dict[str, str] | None = None,
    ) -> list[JevPromptRecord]:
        labels = ground_truth or {}
        records: list[JevPromptRecord] = []

        # Group meta events by session
        events_by_session: dict[str, list[dict[str, Any]]] = {}
        if not meta_df.empty:
            for s_id, group in meta_df.groupby("session_id", sort=False):
                events_by_session[str(s_id)] = group.to_dict("records")

        # Ensure all sessions in ground truth are represented (even smooth sessions with 0 meta events)
        all_session_ids = list(labels.keys()) if labels else list(events_by_session.keys())

        for s_id in all_session_ids:
            evs = events_by_session.get(s_id, [])
            persona = labels.get(s_id)
            records.append(self.build_record_for_session(s_id, evs, persona=persona))

        return records


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build LLM prompts from preprocessed MetaEvents")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ground-truth", type=Path, default=DEFAULT_GROUND_TRUTH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    meta_df = pd.read_csv(args.input) if args.input.exists() else pd.DataFrame()

    ground_truth: dict[str, str] = {}
    if args.ground_truth.exists():
        gt_df = pd.read_csv(args.ground_truth)
        ground_truth = dict(zip(gt_df["session_id"].astype(str), gt_df["persona"].astype(str)))

    builder = JevPromptBuilder()
    records = builder.build_from_dataframe(meta_df, ground_truth=ground_truth)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(rec.to_json() + "\n")

    print(f"Generated {len(records)} prompts to {args.output}")


if __name__ == "__main__":
    main()
