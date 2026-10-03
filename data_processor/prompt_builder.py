"""Transform preprocessed ecommerce events into rich prompts and inputs for Jev.

Jev is an AI intention & emotion diagnostic engine for an ecommerce / price
comparison platform (Ceneo). Based on session telemetry and behavioral history,
Jev classifies user emotions into a defined taxonomy of 15 states across
negative, positive, and neutral categories.
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

WINDOW_SIZE = 8

# ============================================================================
# USER STATES TAXONOMY
# ============================================================================

USER_STATES: dict[str, list[str]] = {
    "negative": [
        "Frustrated / Annoyed",
        "Confused / Lost",
        "Choice Overloaded / Decision Paralysis",
        "Disappointed",
        "Distracted / Inattentive",
        "Skeptical / Distrustful",
    ],
    "positive": [
        "Determined / High Intent",
        "Reassured / Confident",
        "Urgent / FOMO Driven",
        "Inspired / Delighted",
        "Relaxed / Casual Browsing",
    ],
    "neutral": [
        "Analytical / Focused",
        "Exploratory / Browsing",
        "Hesitant / Evaluating Options",
        "Undecided / Comparing",
    ],
}

ALL_USER_STATES: list[str] = [
    state for group in USER_STATES.values() for state in group
]

STATE_TO_CATEGORY: dict[str, str] = {
    state: category
    for category, states in USER_STATES.items()
    for state in states
}

STATE_DESCRIPTIONS: dict[str, str] = {
    # Negative
    "Frustrated / Annoyed": (
        "Wysoki poziom irytacji wywołany przeszkodami technicznymi lub barierami w procesie. "
        "Sygnały telemetryczne: rage clicki (seria szybkich kliknięć w ten sam element), "
        "powtarzające się błędy formularza, gwałtowne tempo (rapid) połączone z tarciem (friction), "
        "nagłe zablokowanie procesu (np. niedziałający kod rabatowy)."
    ),
    "Confused / Lost": (
        "Zagubienie w strukturze serwisu, brak orientacji lub nierozumienie działania interfejsu. "
        "Sygnały telemetryczne: dead clicki (klikanie w nieinteraktywne elementy), "
        "chaotyczne przełączanie między podstronami bez postępu, wyszukiwania bez wyników, "
        "powrót do punktu wyjścia."
    ),
    "Choice Overloaded / Decision Paralysis": (
        "Przeciążenie poznawcze wynikające ze zbyt wielu zbliżonych opcji lub trudności w podjęciu decyzji. "
        "Sygnały telemetryczne: duża liczba przejrzanych ofert (compared_products_count >= 3), "
        "efekt pogo-stick (naprzemienne wchodzenie w produkt i szybki powrót do listy), "
        "częste nakładanie i usuwanie filtrów, utknięcie (stalled) na liście ofert lub porównywarce."
    ),
    "Disappointed": (
        "Rozczarowanie brakiem oczekiwanych rezultatów, niespełnieniem obietnicy oferty lub nieudaną akcją. "
        "Sygnały telemetryczne: błąd kuponu (np. COUPON_INVALID, COUPON_EXPIRED), "
        "brak wyników wyszukiwania po nałożeniu restrykcyjnych filtrów, "
        "porzucenie koszyka lub kasy (CART_ABANDON_EXIT) bezpośrednio po błędzie."
    ),
    "Distracted / Inattentive": (
        "Rozproszenie uwagi, multitasking lub zanik zaangażowania w proces przeglądania. "
        "Sygnały telemetryczne: bardzo długie czasy bezczynności (idle time), "
        "opuszczanie karty przeglądarki (TAB_HIDDEN), powolne lub zawieszone tempo (stalled), "
        "powrót do karty (TAB_VISIBLE) bez podjęcia konkretnej akcji."
    ),
    "Skeptical / Distrustful": (
        "Niepewność co do wiarygodności sklepu, sprzedawcy, warunków oferty lub ceny. "
        "Sygnały telemetryczne: wielokrotne sprawdzanie ofert różnych sprzedawców dla tego samego produktu, "
        "wielokrotne sprawdzanie rozbicia cen i warunków dostawy, "
        "długie wahanie przed przejściem do płatności lub po wprowadzeniu danych."
    ),
    # Positive
    "Determined / High Intent": (
        "Wysoka determinacja, jasny cel zakupowy i pewność działania. "
        "Sygnały telemetryczne: bezpośrednia, płynna i szybka ścieżka od wyszukiwania, "
        "przez wybór konkretnego produktu, dodanie do koszyka (ADD_TO_CART), "
        "aż po rozpoczęcie kasy (CHECKOUT_START) i finalizację zamówienia (ORDER_COMPLETED) bez zbędnego błądzenia."
    ),
    "Reassured / Confident": (
        "Poczucie pewności, zaufania do platformy i komfortu decyzyjnego. "
        "Sygnały telemetryczne: spokojne, metodyczne tempo (normal), skuteczne doprecyzowanie filtrów, "
        "uważne zapoznanie się ze specyfikacją i bezproblemowe przejście do realizacji zamówienia."
    ),
    "Urgent / FOMO Driven": (
        "Pośpiech zakupowy, silna motywacja wynikająca z ograniczonej dostępności, promocji lub lęku przed przegapieniem okazji. "
        "Sygnały telemetryczne: bardzo szybkie tempo (rapid) akcji zakupowych, "
        "natychmiastowe klikanie 'Kup teraz' / 'Dodaj do koszyka', krótkie czasy namysłu przed finalizacją."
    ),
    "Inspired / Delighted": (
        "Zadowolenie z odkrywania ciekawych propozycji, inspiracja ofertą. "
        "Sygnały telemetryczne: płynne przechodzenie przez rekomendacje i powiązane produkty, "
        "dodawanie kolejnych produktów do koszyka lub listy ulubionych, wysoka aktywność bez oznak znużenia."
    ),
    "Relaxed / Casual Browsing": (
        "Swobodne, rekreacyjne przeglądanie asortymentu bez presji zakupu i bez stresu. "
        "Sygnały telemetryczne: spokojne przewijanie (scroll), naturalne czasy czytania, "
        "brak gwałtownych ruchów kursora, brak błędów i frustracji."
    ),
    # Neutral
    "Analytical / Focused": (
        "Systematyczna, racjonalna analiza parametrów technicznych i cenowych. "
        "Sygnały telemetryczne: precyzyjne korzystanie z filtrów wieloparametrowych (marka, pamięć, cena, oceny), "
        "sprawdzanie szczegółowych specyfikacji, stabilne tempo (normal), logiczny ciąg porównań."
    ),
    "Exploratory / Browsing": (
        "Wstępna eksploracja asortymentu w celu zorientowania się w trendach i cenach. "
        "Sygnały telemetryczne: ogólne zapytania w wyszukiwarce, przeglądanie listingów kategorii, "
        "oglądanie zróżnicowanych modeli bez koncentracji na pojedynczym produkcie."
    ),
    "Hesitant / Evaluating Options": (
        "Wahanie i rozważanie za i przeciw między 2-3 zidentyfikowanymi alternatywami. "
        "Sygnały telemetryczne: wydłużony dwell time (LONG_HESITATION) na karcie wybranego produktu, "
        "powolne scrollowanie sekcji parametrów i opinii, powrót do poprzednio oglądanej oferty w celu ponownego sprawdzenia."
    ),
    "Undecided / Comparing": (
        "Aktywne porównywanie zbliżonych opcji bez przewagi żadnej z nich. "
        "Sygnały telemetryczne: wielokrotne klikanie porównywarki cen (PRICE_COMPARISON_CLICK), "
        "naprzemienne przełączanie między 2-4 produktami, brak akcji dodania do koszyka pomimo intensywnego przeglądania."
    ),
}


# ============================================================================
# PYDANTIC SCHEMAS (Validation for Jev Outputs & Records)
# ============================================================================


class SecondaryState(BaseModel):
    state: str
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("state")
    @classmethod
    def validate_state(cls, value: str) -> str:
        if value not in ALL_USER_STATES:
            raise ValueError(
                f"Niepoprawny stan: '{value}'. Dozwolone stany: {ALL_USER_STATES}"
            )
        return value


class SuggestedAction(BaseModel):
    action: str
    reason: str
    message_draft: str | None = None


class JevEmotionResponse(BaseModel):
    """Structured response schema expected from Jev."""

    category: Literal["negative", "positive", "neutral"]
    primary_state: str
    confidence: float = Field(ge=0.0, le=1.0)
    secondary_states: list[SecondaryState] = Field(default_factory=list)
    key_signals: list[str] = Field(default_factory=list)
    user_intent_summary: str
    reasoning: str
    suggested_action: SuggestedAction

    @field_validator("primary_state")
    @classmethod
    def validate_primary_state(cls, value: str) -> str:
        if value not in ALL_USER_STATES:
            raise ValueError(
                f"Niepoprawny primary_state: '{value}'. Dozwolone stany: {ALL_USER_STATES}"
            )
        return value


@dataclass
class JevPromptRecord:
    """Unified container for a generated Jev input."""

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
        """Convert record to a standard serializable dictionary."""
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
        """Return chat-ready messages for LLM APIs (OpenAI, Anthropic, LiteLLM)."""
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": self.user_prompt},
        ]

    def to_json(self, indent: int | None = None) -> str:
        """Serialize record to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


# ============================================================================
# CONTEXT EXTRACTION & FORMATTING HELPERS
# ============================================================================


def _clean(value: object, fallback: str = "brak") -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return fallback
    text = str(value).strip()
    if text.lower() in {"nan", "none", "<na>", ""}:
        return fallback
    return text


def session_duration_label(session: pd.DataFrame, current_ts: pd.Timestamp) -> str:
    """Compute human-friendly duration from session start to current point."""
    start = pd.to_datetime(session["timestamp"].iloc[0], utc=True)
    elapsed = current_ts - start
    total_seconds = int(elapsed.total_seconds())
    minutes, seconds = divmod(max(total_seconds, 0), 60)
    if minutes > 0:
        return f"{minutes} min {seconds} s ({total_seconds} s)"
    return f"{seconds} s"


def format_history(window: pd.DataFrame) -> str:
    """Format chronological event history for the LLM prompt."""
    lines = []
    for _, row in window.iterrows():
        ts_str = str(row["timestamp"])
        ts = ts_str[11:19] if len(ts_str) >= 19 else ts_str
        page = _clean(row.get("page_type"), "unknown")
        action = _clean(row.get("action_type"), "ACTION")
        summary = _clean(row.get("narrative_summary"), "")

        extras: list[str] = []
        pace = row.get("interaction_pace")
        if pace in {"hesitant", "stalled", "rapid"}:
            extras.append(f"tempo: {pace}")
        if bool(row.get("friction_detected")):
            extras.append("tarcie: TAK")
        if bool(row.get("is_rage_click")):
            extras.append("RAGE CLICK")
        if bool(row.get("is_dead_click")):
            extras.append("DEAD CLICK")
        if bool(row.get("is_exit_intent")):
            extras.append("EXIT INTENT")

        extra_str = f" [{', '.join(extras)}]" if extras else ""
        lines.append(f"[{ts}] [{page}] {action}: {summary}{extra_str}")
    return "\n".join(lines)


def extract_session_metadata(
    session: pd.DataFrame,
    trigger: pd.Series,
    window: pd.DataFrame,
) -> dict[str, Any]:
    """Extract quantitative behavioral indicators for Jev."""
    trigger_ts = pd.to_datetime(trigger["timestamp"], utc=True)
    start_ts = pd.to_datetime(session["timestamp"].iloc[0], utc=True)
    elapsed_seconds = max(int((trigger_ts - start_ts).total_seconds()), 0)

    # Unique page path up to trigger
    sub_session = session[session["event_seq"] <= trigger["event_seq"]]
    page_flow = sub_session["page_type"].dropna().tolist()
    page_flow_compact: list[str] = []
    for p in page_flow:
        if not page_flow_compact or page_flow_compact[-1] != p:
            page_flow_compact.append(str(p))

    # Product context
    current_product = _clean(trigger.get("current_product_name"), "")
    current_price = trigger.get("current_product_price")
    price_val = float(current_price) if pd.notna(current_price) else None

    cart_val = trigger.get("cart_value")
    cart_num = float(cart_val) if pd.notna(cart_val) else None

    filters = _clean(trigger.get("active_filters"), "{}")

    return {
        "session_id": str(trigger["session_id"]),
        "duration_seconds": elapsed_seconds,
        "duration_formatted": session_duration_label(session, trigger_ts),
        "total_events_in_session": int(len(session)),
        "events_prior_to_trigger": int(len(sub_session)),
        "window_size": int(len(window)),
        "current_page": _clean(trigger.get("page_type")),
        "current_page_title": _clean(trigger.get("page_title")),
        "page_flow": page_flow_compact,
        "page_flow_summary": " -> ".join(page_flow_compact),
        "current_product": current_product if current_product else None,
        "current_price": price_val,
        "cart_value": cart_num,
        "compared_products_count": int(trigger.get("compared_products_count", 0)),
        "active_filters": filters,
        "interaction_pace": _clean(trigger.get("interaction_pace"), "normal"),
        "dwell_time_seconds": int(trigger.get("dwell_time_seconds", 0)),
        "idle_time_seconds": float(trigger.get("idle_time_seconds", 0.0) or 0.0),
        "friction": {
            "friction_detected": bool(trigger.get("friction_detected")),
            "total_errors": int(trigger.get("session_error_count", 0)),
            "recent_errors": int(trigger.get("recent_errors_count", 0)),
            "consecutive_errors": int(trigger.get("consecutive_errors_count", 0)),
            "rage_clicks": int(trigger.get("rage_clicks_count", 0)),
            "dead_clicks": int(trigger.get("dead_clicks_count", 0)),
            "form_errors": int(trigger.get("form_errors_count", 0)),
            "zero_result_searches": int(trigger.get("zero_result_searches", 0)),
            "last_error_code": _clean(trigger.get("last_error_code")),
            "last_error_message": _clean(trigger.get("last_error_message")),
            "most_frequent_friction": _clean(trigger.get("most_frequent_friction")),
        },
    }


# ============================================================================
# TRIGGER & EVALUATION POINT DETECTION
# ============================================================================


def is_friction_trigger(row: pd.Series) -> bool:
    """Check if the event represents a friction point or distress trigger."""
    action = str(row.get("action_type", ""))
    return bool(
        row.get("is_rage_click", False)
        or row.get("is_dead_click", False)
        or row.get("is_exit_intent", False)
        or row.get("consecutive_errors_count", 0) >= 2
        or row.get("recent_errors_count", 0) >= 3
        or row.get("zero_result_searches", 0) >= 2
        or action in {"CART_ABANDON_EXIT", "FORM_ERROR"}
        or (action == "POGO_STICK_BOUNCE" and row.get("compared_products_count", 0) >= 3)
        or (action == "LONG_HESITATION" and row.get("dwell_time_seconds", 0) >= 5)
        or (
            row.get("interaction_pace") == "stalled"
            and row.get("page_type") in {"search", "category", "cart", "checkout"}
        )
    )


def is_milestone_trigger(row: pd.Series) -> bool:
    """Check if the event represents an intent or completion milestone."""
    action = str(row.get("action_type", ""))
    return action in {
        "ORDER_COMPLETED",
        "CHECKOUT_START",
        "ADD_TO_CART",
        "CART_VIEW",
    }


def is_trigger(row: pd.Series) -> bool:
    """Backward-compatible general trigger check."""
    return is_friction_trigger(row) or is_milestone_trigger(row)


def select_triggers(
    processed: pd.DataFrame,
    mode: str = "smart",
) -> pd.DataFrame:
    """Select evaluation events from preprocessed telemetry events.

    Modes:
      - 'smart': Exactly 1 representative evaluation point per session.
                 Selects the peak friction trigger if friction occurred;
                 otherwise selects intent milestone (e.g. ORDER_COMPLETED,
                 CHECKOUT_START); otherwise selects the last event of the session.
      - 'friction': Only events where is_friction_trigger is True (1 per session).
      - 'all_triggers': All rows matching friction or milestone triggers.
      - 'latest': The final event of each session.
    """
    df = processed.assign(
        timestamp=pd.to_datetime(processed["timestamp"], utc=True)
    )

    if mode == "latest":
        return (
            df.sort_values(["session_id", "event_seq"])
            .groupby("session_id", as_index=False)
            .tail(1)
        )

    if mode == "all_triggers":
        hits = df[df.apply(is_trigger, axis=1)]
        return hits.sort_values(["session_id", "event_seq"])

    if mode == "friction":
        hits = df[df.apply(is_friction_trigger, axis=1)]
        if hits.empty:
            return hits
        return (
            hits.sort_values(["session_id", "event_seq"])
            .groupby("session_id", as_index=False)
            .tail(1)
        )

    # mode == "smart" (default)
    # Ensure every single session in the dataset gets evaluated!
    selected_indices: list[int] = []
    for _, session_group in df.groupby("session_id", sort=False):
        session_sorted = session_group.sort_values("event_seq")

        # 1. Look for friction triggers first (strongest distress peak)
        friction_hits = session_sorted[session_sorted.apply(is_friction_trigger, axis=1)]
        if not friction_hits.empty:
            selected_indices.append(friction_hits.index[-1])
            continue

        # 2. Look for milestone triggers (high-intent or completed journey)
        milestone_hits = session_sorted[session_sorted.apply(is_milestone_trigger, axis=1)]
        if not milestone_hits.empty:
            selected_indices.append(milestone_hits.index[-1])
            continue

        # 3. Fallback: last event of the session
        selected_indices.append(session_sorted.index[-1])

    return df.loc[selected_indices].sort_values(["session_id", "event_seq"])


# ============================================================================
# PROMPT RENDERING
# ============================================================================


def render_system_prompt(user_states: dict[str, list[str]] = USER_STATES) -> str:
    """Render system instructions containing the exact taxonomy and Jev role."""
    taxonomy_lines = []
    for category, states in user_states.items():
        taxonomy_lines.append(f"\n### KATEGORIA: {category.upper()}")
        for state in states:
            desc = STATE_DESCRIPTIONS.get(state, "")
            taxonomy_lines.append(f"- **{state}**:\n  {desc}")

    taxonomy_block = "\n".join(taxonomy_lines)

    return f"""Jesteś wyspecjalizowanym modułem analitycznym "Jev" w systemie e-commerce / porównywarce ofert (Ceneo).
Twoim celem jest diagnoza bieżącego stanu emocjonalnego oraz intencji użytkownika na podstawie danych telemetrycznych i historii zdarzeń z trwającej sesji.

======================================================================
DOZWOLONA TAKSONOMIA STANÓW UŻYTKOWNIKA (USER_STATES):
======================================================================
Musisz wybrać DOKŁADNIE JEDEN stan z poniższej zamkniętej listy jako 'primary_state' i dopasować jego kategorię (negative, positive lub neutral).
{taxonomy_block}

======================================================================
FORMAT ODPOWIEDZI:
======================================================================
Zwróć wynik WYŁĄCZNIE jako poprawny obiekt JSON, bez zbędnych wstępów i znaczników markdown poza blokiem JSON, ściśle według schematu:
{{
  "category": "negative" | "positive" | "neutral",
  "primary_state": "<dokładna nazwa jednego ze stanów z listy USER_STATES>",
  "confidence": 0.0 - 1.0,
  "secondary_states": [
    {{
      "state": "<inna dopasowana nazwa stanu z USER_STATES>",
      "confidence": 0.0 - 1.0
    }}
  ],
  "key_signals": [
    "opis wykrytego sygnału 1 (np. wielokrotne rage clicki na przycisku 'Zastosuj')",
    "opis wykrytego sygnału 2 (np. błąd COUPON_INVALID i powolne tempo)"
  ],
  "user_intent_summary": "krótkie, jednotransakcyjne podsumowanie aktualnego celu użytkownika",
  "reasoning": "zwięzłe uzasadnienie diagnozy stanu emocjonalnego na podstawie danych",
  "suggested_action": {{
    "action": "REDUCE_OPTIONS | OFFER_HELP | RESOLVE_ERROR | CLARIFY_FILTERS | REASSURE | DO_NOTHING",
    "reason": "dlaczego taka akcja jest odpowiednia w tym momencie",
    "message_draft": "krótka, empatyczna propozycja komunikatu asystenta dla użytkownika (lub null jeśli action to DO_NOTHING)"
  }}
}}"""


def render_user_prompt(
    session: pd.DataFrame,
    trigger: pd.Series,
    window: pd.DataFrame,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Render the user context and telemetry snapshot for Jev."""
    meta = metadata or extract_session_metadata(session, trigger, window)
    friction = meta["friction"]

    product_info = "brak"
    if meta.get("current_product"):
        price_txt = f"{meta['current_price']} PLN" if meta.get("current_price") is not None else "brak ceny"
        product_info = f"{meta['current_product']} (cena: {price_txt})"

    cart_info = f"{meta['cart_value']} PLN" if meta.get("cart_value") is not None else "pusty / 0 PLN"

    return f"""PRZEANALIZUJ PONIŻSZE DANE SESJI TELEMETRYCZNEJ I OKREŚL STAN EMOCJONALNY UŻYTKOWNIKA:

----------------------------------------------------------------------
1. KONTEKST SESJI I UŻYTKOWNIKA:
----------------------------------------------------------------------
- Identyfikator sesji: {meta['session_id']}
- Czas trwania do momentu oceny: {meta['duration_formatted']}
- Łączna liczba zdarzeń w sesji: {meta['total_events_in_session']} (punkt oceny przy zdarzeniu #{int(trigger.get('event_seq', 0))})
- Ostatnia zarejestrowana akcja: {trigger.get('action_type', 'UNKNOWN')}
- Aktualna strona: {meta['current_page']} ({meta['current_page_title']})
- Ścieżka podstron (chronologicznie): {meta['page_flow_summary']}
- Aktywne filtry: {meta['active_filters']}
- Liczba przejrzanych / porównywanych ofert: {meta['compared_products_count']}
- Aktualnie oglądany produkt: {product_info}
- Wartość koszyka: {cart_info}

----------------------------------------------------------------------
2. WSKAŹNIKI BEHAWIORALNE I DYNAMIKA INTERAKCJI:
----------------------------------------------------------------------
- Tempo interakcji (ostatnie zdarzenie): {meta['interaction_pace']}
- Dwell time (czas zatrzymania): {meta['dwell_time_seconds']}s
- Idle time (czas bezczynności): {meta['idle_time_seconds']}s
- Tarcie wykryte: {'TAK' if friction['friction_detected'] else 'NIE'}
- Łączna liczba błędów w sesji: {friction['total_errors']} (w tym w ostatnich 3 minutach: {friction['recent_errors']}, błędy z rzędu: {friction['consecutive_errors']})
- Rage clicks (wściekłe kliknięcia): {friction['rage_clicks']}
- Dead clicks (martwe kliknięcia): {friction['dead_clicks']}
- Błędy formularzy: {friction['form_errors']}
- Wyszukiwania z zerową liczbą wyników: {friction['zero_result_searches']}
- Ostatni kod błędu: {friction['last_error_code']}
- Treść ostatniego błędu: {friction['last_error_message']}
- Dominujący rodzaj tarcia: {friction['most_frequent_friction']}

----------------------------------------------------------------------
3. OSTATNIA HISTORIA ZDARZEŃ (okno ostatnich {meta['window_size']} akcji):
----------------------------------------------------------------------
{format_history(window)}

----------------------------------------------------------------------
TWOJE ZADANIE:
----------------------------------------------------------------------
Na podstawie powyższych danych telemetrycznych przyporządkuj bieżący stan emocjonalny użytkownika do dokładnie jednego stanu z dozwolonej listy USER_STATES.
Zwróć poprawny obiekt JSON wg zadanego schematu."""


def build_prompt(
    session: pd.DataFrame,
    trigger: pd.Series,
    window: pd.DataFrame,
    metadata: dict[str, Any] | None = None,
    user_states: dict[str, list[str]] = USER_STATES,
) -> str:
    """Build a complete unified prompt (system + user context) as a single text."""
    system_text = render_system_prompt(user_states)
    user_text = render_user_prompt(session, trigger, window, metadata)
    return f"{system_text}\n\n======================================================================\n\n{user_text}"


# ============================================================================
# MAIN JEV PROMPT BUILDER CLASS
# ============================================================================


class JevPromptBuilder:
    """High-level builder that ingests telemetry events and renders Jev prompts."""

    def __init__(
        self,
        window_size: int = WINDOW_SIZE,
        mode: str = "smart",
        user_states: dict[str, list[str]] | None = None,
    ) -> None:
        self.window_size = window_size
        self.mode = mode
        self.user_states = user_states or USER_STATES

    def build_record(
        self,
        session: pd.DataFrame,
        trigger: pd.Series,
        window: pd.DataFrame,
        persona: str | None = None,
    ) -> JevPromptRecord:
        """Create a single JevPromptRecord for a given session and trigger."""
        metadata = extract_session_metadata(session, trigger, window)
        system_prompt = render_system_prompt(self.user_states)
        user_prompt = render_user_prompt(session, trigger, window, metadata)
        full_prompt = f"{system_prompt}\n\n======================================================================\n\n{user_prompt}"

        return JevPromptRecord(
            session_id=str(trigger["session_id"]),
            trigger_event_id=str(trigger.get("event_id", "")),
            trigger_action=str(trigger.get("action_type", "")),
            trigger_timestamp=str(trigger.get("timestamp", "")),
            prompt=full_prompt,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            session_metadata=metadata,
            persona=persona,
        )

    def build_for_session(
        self,
        session_df: pd.DataFrame,
        persona: str | None = None,
        mode: str | None = None,
    ) -> list[JevPromptRecord]:
        """Build prompts for an individual session DataFrame."""
        session_df = session_df.assign(
            timestamp=pd.to_datetime(session_df["timestamp"], utc=True)
        ).sort_values("event_seq")

        eval_mode = mode or self.mode
        triggers = select_triggers(session_df, mode=eval_mode)
        records: list[JevPromptRecord] = []

        for _, trigger in triggers.iterrows():
            window = session_df[session_df["event_seq"] <= trigger["event_seq"]].tail(
                self.window_size
            )
            record = self.build_record(session_df, trigger, window, persona=persona)
            records.append(record)

        return records

    def build_from_dataframe(
        self,
        df: pd.DataFrame,
        ground_truth: dict[str, str] | None = None,
        mode: str | None = None,
    ) -> list[JevPromptRecord]:
        """Build prompts for all sessions in a preprocessed events DataFrame."""
        df = df.assign(timestamp=pd.to_datetime(df["timestamp"], utc=True))
        labels = ground_truth or {}
        eval_mode = mode or self.mode
        triggers = select_triggers(df, mode=eval_mode)

        records: list[JevPromptRecord] = []
        for _, trigger in triggers.iterrows():
            session_id = trigger["session_id"]
            session = df[df["session_id"] == session_id].sort_values("event_seq")
            window = session[session["event_seq"] <= trigger["event_seq"]].tail(
                self.window_size
            )
            persona = labels.get(str(session_id))
            records.append(self.build_record(session, trigger, window, persona=persona))

        return records

    def build_from_csv(
        self,
        csv_path: Path | str,
        ground_truth_path: Path | str | None = None,
        mode: str | None = None,
    ) -> list[JevPromptRecord]:
        """Load CSV and build prompts for all sessions."""
        df = pd.read_csv(csv_path)
        gt = load_ground_truth(Path(ground_truth_path)) if ground_truth_path else {}
        return self.build_from_dataframe(df, ground_truth=gt, mode=mode)

    @staticmethod
    def save_to_jsonl(
        records: list[JevPromptRecord],
        output_path: Path | str,
    ) -> int:
        """Save prompt records to JSONL file."""
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as handle:
            for rec in records:
                handle.write(json.dumps(rec.to_dict(), ensure_ascii=False) + "\n")
        return len(records)


# ============================================================================
# STANDALONE CONVENIENCE FUNCTIONS
# ============================================================================


def build_jev_prompt(
    session: pd.DataFrame,
    trigger: pd.Series | None = None,
    window_size: int = WINDOW_SIZE,
) -> JevPromptRecord:
    """Build a prompt record directly from a session DataFrame and optional trigger."""
    builder = JevPromptBuilder(window_size=window_size)
    session_sorted = session.assign(
        timestamp=pd.to_datetime(session["timestamp"], utc=True)
    ).sort_values("event_seq")

    if trigger is None:
        triggers = select_triggers(session_sorted, mode="smart")
        trigger = triggers.iloc[-1] if not triggers.empty else session_sorted.iloc[-1]

    window = session_sorted[session_sorted["event_seq"] <= trigger["event_seq"]].tail(
        window_size
    )
    return builder.build_record(session_sorted, trigger, window)


def load_ground_truth(path: Path | None) -> dict[str, str]:
    """Load session_id -> persona labels if ground-truth file exists."""
    if path is None or not path.exists():
        return {}
    labels = pd.read_csv(path)
    if "session_id" not in labels.columns or "persona" not in labels.columns:
        return {}
    mapping: dict[str, str] = {}
    for _, row in labels.iterrows():
        persona = row["persona"]
        if persona is None or (isinstance(persona, float) and pd.isna(persona)):
            continue
        mapping[str(row["session_id"])] = str(persona)
    return mapping


def build_records(
    processed: pd.DataFrame,
    ground_truth: dict[str, str] | None = None,
    mode: str = "smart",
    window_size: int = WINDOW_SIZE,
) -> list[dict[str, Any]]:
    """Backward-compatible function returning list of prompt dicts."""
    builder = JevPromptBuilder(window_size=window_size, mode=mode)
    prompt_records = builder.build_from_dataframe(processed, ground_truth=ground_truth)
    return [r.to_dict() for r in prompt_records]


# ============================================================================
# CLI INTERFACE
# ============================================================================


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert preprocessed telemetry events into Jev emotion diagnostic prompts"
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--ground-truth",
        type=Path,
        default=DEFAULT_GROUND_TRUTH,
        help="Optional session-level persona labels used for evaluation metadata",
    )
    parser.add_argument(
        "--mode",
        choices=["smart", "friction", "all_triggers", "latest"],
        default="smart",
        help="Event selection strategy (default: 'smart' produces 1 balanced prompt per session)",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=WINDOW_SIZE,
        help="Number of recent events included in prompt history",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        default=None,
        help="Optionally filter to a specific session ID",
    )
    parser.add_argument(
        "--print-first",
        action="store_true",
        help="Print the first prompt to stdout",
    )
    parser.add_argument(
        "--print-chat",
        action="store_true",
        help="Print the first prompt as structured chat messages (JSON)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    processed = pd.read_csv(args.input)
    if args.session_id:
        processed = processed[processed["session_id"] == args.session_id]
        if processed.empty:
            print(f"Brak zdarzeń dla sesji: {args.session_id}")
            return

    labels = load_ground_truth(args.ground_truth)
    builder = JevPromptBuilder(window_size=args.window_size, mode=args.mode)
    records = builder.build_from_dataframe(processed, ground_truth=labels)

    builder.save_to_jsonl(records, args.output)
    print(f"Wrote {len(records)} prompts to {args.output} (mode='{args.mode}')")

    if records:
        labeled = sum(1 for record in records if record.persona)
        unlabeled = len(records) - labeled
        print(f"Prompts with ground-truth persona: {labeled}")
        if unlabeled:
            print(f"Prompts without persona: {unlabeled}")

        by_persona: dict[str, int] = {}
        for record in records:
            if record.persona:
                by_persona[record.persona] = by_persona.get(record.persona, 0) + 1
        if by_persona:
            print(f"Prompts by persona: {by_persona}")

    if args.print_first and records:
        print("\n" + "=" * 30 + " FIRST PROMPT " + "=" * 30 + "\n")
        print(records[0].prompt)

    if args.print_chat and records:
        print("\n" + "=" * 25 + " CHAT MESSAGES FORMAT " + "=" * 25 + "\n")
        print(json.dumps(records[0].to_chat_messages(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
