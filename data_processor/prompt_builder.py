"""Select trigger windows from preprocessed events and render Jev prompts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "preprocessed_ecommerce_events.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "jev_prompts.jsonl"
DEFAULT_GROUND_TRUTH = PROJECT_ROOT / "data" / "sessions_ground_truth.csv"

WINDOW_SIZE = 8


def is_trigger(row: pd.Series) -> bool:
    return bool(
        row["is_rage_click"]
        or row["is_exit_intent"]
        or row["consecutive_errors_count"] >= 2
        or row["recent_errors_count"] >= 3
        or row["zero_result_searches"] >= 2
        or (row["action_type"] == "POGO_STICK_BOUNCE" and row["compared_products_count"] >= 3)
        or (
            row["interaction_pace"] == "stalled"
            and row["page_type"] in {"search", "category", "cart", "checkout"}
        )
    )


def _clean(value: object, fallback: str = "brak") -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return fallback
    text = str(value)
    if text.lower() in {"nan", "none", "<na>"}:
        return fallback
    return text


def format_history(window: pd.DataFrame) -> str:
    lines = []
    for _, row in window.iterrows():
        ts = str(row["timestamp"])[11:19]
        extra = ""
        if row["interaction_pace"] in {"hesitant", "stalled", "rapid"}:
            extra = f" Tempo: {row['interaction_pace']}."
        if row["friction_detected"]:
            extra += " Tarcie: tak."
        lines.append(f"[{ts}] {row['action_type']}: {row['narrative_summary']}{extra}")
    return "\n".join(lines)


def session_duration_label(session: pd.DataFrame, trigger_ts: pd.Timestamp) -> str:
    start = pd.to_datetime(session["timestamp"].iloc[0], utc=True)
    elapsed = trigger_ts - start
    total_seconds = int(elapsed.total_seconds())
    minutes, seconds = divmod(max(total_seconds, 0), 60)
    return f"{minutes} minuty {seconds} sekund" if minutes else f"{seconds} sekund"


def build_prompt(session: pd.DataFrame, trigger: pd.Series, window: pd.DataFrame) -> str:
    trigger_ts = pd.to_datetime(trigger["timestamp"], utc=True)
    filters = _clean(trigger["active_filters"], "{}")
    cart_value = trigger["cart_value"]
    cart_label = cart_value if pd.notna(cart_value) else 0
    return f"""Jesteś modułem analitycznym "Jev" w systemie e-commerce / porównywarce ofert.
Twoim zadaniem jest ocena bieżącego stanu emocjonalnego użytkownika oraz jego intencji na podstawie ostatnich zdarzeń z sesji.

KONTEKST SESJI:
- Identyfikator sesji: {trigger["session_id"]}
- Czas trwania sesji: {session_duration_label(session, trigger_ts)}
- Typ strony: {trigger["page_type"]}
- Aktywne filtry: {filters}
- Liczba przejrzanych ofert: {int(trigger["compared_products_count"])}
- Wartość koszyka: {cart_label} PLN
- Ostatnia akcja (TRIGGER): {trigger["action_type"]}

STATUS BŁĘDÓW I TARĆ W SESJI:
- Łącznie błędów: {int(trigger["session_error_count"])} (w tym {int(trigger["recent_errors_count"])} w ostatnich 3 minutach)
- Błędy z rzędu: {int(trigger["consecutive_errors_count"])}
- Rage clicks: {int(trigger["rage_clicks_count"])}
- Dead clicks: {int(trigger["dead_clicks_count"])}
- Błędy formularza: {int(trigger["form_errors_count"])}
- Wyszukiwania bez wyników: {int(trigger["zero_result_searches"])}
- Ostatni błąd: {_clean(trigger["last_error_code"])} ({_clean(trigger["last_error_message"], "—")})
- Dominujący typ tarcia: {_clean(trigger["most_frequent_friction"])}

OSTATNIA HISTORIA ZACHOWANIA (chronologicznie):
{format_history(window)}

ZADANIE:
Oceń prawdopodobieństwo wystąpienia następujących stanów (każdy stan osobno, skala 0.0-1.0):
1. frustration (frustracja)
2. decision_fatigue (zmęczenie decyzyjne / paraliż wyboru)
3. boredom (znudzenie / błądzenie)
4. satisfaction (zadowolenie / płynny proces)
5. exit_intent (ryzyko natychmiastowego opuszczenia strony)

Zwróć wynik WYŁĄCZNIE jako obiekt JSON wg schematu:
{{
  "emotions": {{
    "frustration": float,
    "decision_fatigue": float,
    "boredom": float,
    "satisfaction": float,
    "exit_intent": float
  }},
  "primary_driver": "krótkie uzasadnienie głównego problemu",
  "suggested_agent_action": "REDUCE_OPTIONS | OFFER_HELP | CLEAR_FILTERS | DO_NOTHING"
}}
"""


def select_triggers(processed: pd.DataFrame) -> pd.DataFrame:
    processed = processed.copy()
    processed["timestamp"] = pd.to_datetime(processed["timestamp"], utc=True, format="ISO8601")
    hits = processed[processed.apply(is_trigger, axis=1)]
    # one representative trigger per session: the strongest / latest friction peak
    if hits.empty:
        return hits
    return hits.sort_values(["session_id", "event_seq"]).groupby("session_id", as_index=False).tail(1)


def load_ground_truth(path: Path | None) -> dict[str, str]:
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
) -> list[dict[str, str]]:
    processed = processed.copy()
    processed["timestamp"] = pd.to_datetime(processed["timestamp"], utc=True, format="ISO8601")
    labels = ground_truth or {}
    triggers = select_triggers(processed)
    records: list[dict[str, str]] = []
    for _, trigger in triggers.iterrows():
        session = processed[processed["session_id"] == trigger["session_id"]].sort_values("event_seq")
        window = session[session["event_seq"] <= trigger["event_seq"]].tail(WINDOW_SIZE)
        record: dict[str, str] = {
            "session_id": trigger["session_id"],
            "trigger_action": trigger["action_type"],
            "trigger_event_id": trigger["event_id"],
            "prompt": build_prompt(session, trigger, window),
        }
        persona = labels.get(str(trigger["session_id"]))
        if persona:
            record["persona"] = persona
        records.append(record)
    return records


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Jev prompts from preprocessed events")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--ground-truth",
        type=Path,
        default=DEFAULT_GROUND_TRUTH,
        help="Optional session-level persona labels used only for evaluation metadata",
    )
    parser.add_argument("--print-first", action="store_true", help="Print the first prompt to stdout")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    processed = pd.read_csv(args.input)
    labels = load_ground_truth(args.ground_truth)
    records = build_records(processed, labels)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Wrote {len(records)} prompts to {args.output}")
    if records:
        labeled = sum(1 for record in records if record.get("persona"))
        unlabeled = len(records) - labeled
        print(f"Prompts with ground-truth persona: {labeled}")
        if unlabeled:
            print(f"Prompts without persona: {unlabeled}")
        by_persona: dict[str, int] = {}
        for record in records:
            persona = record.get("persona")
            if not persona:
                continue
            by_persona[persona] = by_persona.get(persona, 0) + 1
        if by_persona:
            print(f"Prompts by persona: {by_persona}")
    if args.print_first and records:
        print("\n----- FIRST PROMPT -----\n")
        print(records[0]["prompt"])


if __name__ == "__main__":
    main()
