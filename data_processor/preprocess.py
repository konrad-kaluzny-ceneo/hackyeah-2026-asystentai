"""Turn raw telemetry into semantically labelled events with friction summaries."""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from datetime import timedelta
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "raw_ecommerce_events.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "preprocessed_ecommerce_events.csv"

RAGE_WINDOW = timedelta(milliseconds=1500)
RAGE_DISTANCE_PX = 30
RAGE_MIN_CLICKS = 3
POGO_MAX_SECONDS = 5
RECENT_ERROR_WINDOW = timedelta(minutes=3)
DEAD_CLICK_TAGS = {"DIV", "SPAN", "P", "IMG", "SECTION"}
ERROR_EVENT_TYPES = {"ui_error", "api_error"}

PREPROCESSED_COLUMNS = [
    "event_id",
    "session_id",
    "event_seq",
    "timestamp",
    "user_id",
    "anonymous_id",
    "page_type",
    "page_title",
    "action_type",
    "dwell_time_seconds",
    "idle_time_seconds",
    "interaction_pace",
    "is_rage_click",
    "is_dead_click",
    "is_exit_intent",
    "friction_detected",
    "session_error_count",
    "recent_errors_count",
    "consecutive_errors_count",
    "rage_clicks_count",
    "dead_clicks_count",
    "form_errors_count",
    "zero_result_searches",
    "last_error_code",
    "last_error_message",
    "most_frequent_friction",
    "active_filters",
    "compared_products_count",
    "current_product_name",
    "current_product_price",
    "cart_value",
    "narrative_summary",
]


def _parse_ts(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, utc=True, format="ISO8601")


def _payload(raw: Any) -> dict[str, Any]:
    if raw is None or (isinstance(raw, float) and math.isnan(raw)) or raw == "":
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _distance(a: pd.Series, b: pd.Series) -> float:
    if pd.isna(a["pointer_x"]) or pd.isna(b["pointer_x"]):
        return float("inf")
    return math.hypot(float(a["pointer_x"]) - float(b["pointer_x"]), float(a["pointer_y"]) - float(b["pointer_y"]))


def mark_rage_clicks(session: pd.DataFrame) -> pd.Series:
    flags = pd.Series(False, index=session.index)
    clicks = session[session["event_type"] == "click"]
    indexes = list(clicks.index)
    for i, idx in enumerate(indexes):
        start = session.loc[idx, "timestamp"]
        cluster = [idx]
        for later_idx in indexes[i + 1 :]:
            if session.loc[later_idx, "timestamp"] - start > RAGE_WINDOW:
                break
            if _distance(session.loc[idx], session.loc[later_idx]) <= RAGE_DISTANCE_PX:
                cluster.append(later_idx)
        if len(cluster) >= RAGE_MIN_CLICKS:
            flags.loc[cluster] = True
    return flags


def mark_dead_clicks(session: pd.DataFrame) -> pd.Series:
    tags = session["element_tag"].fillna("").str.upper()
    return (session["event_type"] == "click") & tags.isin(DEAD_CLICK_TAGS)


def classify_action(row: pd.Series, prev_page_type: str | None, idle_s: float | None) -> str:
    event_type = row["event_type"]
    if row["is_rage_click"]:
        return "RAGE_CLICK"
    if row["is_dead_click"]:
        return "DEAD_CLICK"
    if event_type == "mouse_leave_viewport":
        return "CART_ABANDON_EXIT" if row["page_type"] in {"cart", "checkout"} else "EXIT_INTENT"
    if event_type in ERROR_EVENT_TYPES:
        return "FORM_ERROR" if row.get("error_type") == "form_validation" else "API_ERROR"
    if event_type == "search":
        return "SEARCH_NO_RESULTS" if row.get("search_results_count") == 0 else "SEARCH_QUERY"
    if event_type == "filter_apply":
        return "FILTER_APPLIED"
    if event_type == "filter_remove":
        return "FILTER_REMOVED"
    if event_type == "add_to_cart":
        return "ADD_TO_CART"
    if event_type == "remove_from_cart":
        return "REMOVE_FROM_CART"
    if event_type == "order_completed":
        return "ORDER_COMPLETED"
    if event_type == "tab_hidden":
        return "TAB_HIDDEN"
    if event_type == "tab_visible":
        return "TAB_VISIBLE"
    if event_type == "scroll_checkpoint":
        return "SCROLL"
    if event_type == "input":
        return "FORM_INPUT"
    if event_type == "page_view":
        if row["page_type"] == "product_details":
            return "PRODUCT_INSPECT"
        if row["page_type"] in {"search", "category"} and prev_page_type == "product_details":
            if idle_s is not None and idle_s <= POGO_MAX_SECONDS:
                return "POGO_STICK_BOUNCE"
            return "RETURN_TO_RESULTS"
        if row["page_type"] == "cart":
            return "CART_VIEW"
        if row["page_type"] == "checkout":
            return "CHECKOUT_START"
        return "PAGE_VIEW"
    if event_type == "click":
        element_id = str(row.get("element_id") or "")
        if "offer" in element_id:
            return "PRICE_COMPARISON_CLICK"
        return "CLICK"
    if idle_s is not None and idle_s >= 15:
        return "LONG_HESITATION"
    return event_type.upper()


def interaction_pace(idle_s: float | None) -> str:
    if idle_s is None:
        return "normal"
    if idle_s < 0.5:
        return "rapid"
    if idle_s < 10:
        return "normal"
    if idle_s < 30:
        return "hesitant"
    return "stalled"


def friction_kind(row: pd.Series) -> str | None:
    if row["is_rage_click"]:
        return "rage_click"
    if row["is_dead_click"]:
        return "dead_click"
    if row["action_type"] == "SEARCH_NO_RESULTS":
        return "no_search_results"
    if row["action_type"] == "POGO_STICK_BOUNCE":
        return "rapid_backtrack"
    if row["event_type"] in ERROR_EVENT_TYPES:
        return str(row.get("error_code") or row.get("error_type") or "error")
    if row["is_exit_intent"]:
        return "exit_intent"
    return None


def is_error_like(row: pd.Series) -> bool:
    return bool(
        row["is_rage_click"]
        or row["is_dead_click"]
        or row["event_type"] in ERROR_EVENT_TYPES
        or row["action_type"] == "SEARCH_NO_RESULTS"
    )


def narrative_summary(row: pd.Series) -> str:
    action = row["action_type"]
    page = row["page_title"] or row["page_type"]
    product = row["current_product_name"]
    idle = row["idle_time_seconds"]

    if action == "SEARCH_QUERY":
        return f'Wyszukano "{row.get("_search_query")}" ({int(row.get("_search_results_count") or 0)} wyników).'
    if action == "SEARCH_NO_RESULTS":
        return f'Wyszukiwanie "{row.get("_search_query")}" nie zwróciło wyników.'
    if action == "PRODUCT_INSPECT":
        return f"Wejście w produkt {product}."
    if action == "POGO_STICK_BOUNCE":
        inspect_s = row.get("_inspect_seconds")
        seconds = inspect_s if inspect_s not in (None, "") else idle
        return f"Szybki powrót do listy po {seconds}s na karcie produktu."
    if action == "FILTER_APPLIED":
        payload = _payload(row.get("_payload"))
        return f"Włączono filtr {payload.get('filter_category')} = {payload.get('value')}."
    if action == "FILTER_REMOVED":
        payload = _payload(row.get("_payload"))
        return f"Usunięto filtr {payload.get('filter_category')}."
    if action == "RAGE_CLICK":
        return f"Seria szybkich kliknięć w '{row.get('_element_text') or row.get('_element_id')}'."
    if action == "DEAD_CLICK":
        return f"Kliknięcie w nieaktywny element {row.get('_element_id')}."
    if action == "FORM_ERROR":
        return f"Błąd formularza {row['last_error_code']}: {row['last_error_message']}."
    if action == "API_ERROR":
        return f"Błąd API {row['last_error_code']}: {row['last_error_message']}."
    if action == "ADD_TO_CART":
        return f"Dodano do koszyka: {product}."
    if action == "ORDER_COMPLETED":
        return f"Zakończono zamówienie na kwotę {row['cart_value']} PLN."
    if action == "TAB_HIDDEN":
        return "Karta przeglądarki została ukryta."
    if action == "TAB_VISIBLE":
        return "Użytkownik wrócił do karty."
    if action == "SCROLL":
        return f"Przewinięto stronę '{page}' do {int(row.get('_scroll_y') or 0)}px."
    if action == "EXIT_INTENT":
        return "Kursor opuścił viewport u góry okna (sygnał wyjścia)."
    if action == "CART_ABANDON_EXIT":
        return "Próba opuszczenia koszyka / kasy."
    if action == "LONG_HESITATION":
        return f"Długa pauza {idle}s przed kolejną akcją na '{page}'."
    if action == "PRICE_COMPARISON_CLICK":
        return f"Kliknięto ofertę {product}."
    if action == "CLICK":
        label = row.get("_element_text") or row.get("_element_id") or "element"
        return f"Kliknięto '{label}' na stronie {page}."
    if action == "PAGE_VIEW":
        return f"Otwarto stronę {page}."
    if action == "FORM_INPUT":
        payload = _payload(row.get("_payload"))
        return f"Wpisano wartość w pole {payload.get('field', 'input')}."
    if action in {"CART_VIEW", "CHECKOUT_START", "RETURN_TO_RESULTS"}:
        return f"{action} na stronie {page}."
    return f"{action} na stronie {page}."


def preprocess_session(session: pd.DataFrame) -> pd.DataFrame:
    session = session.sort_values("timestamp").copy()
    session["is_rage_click"] = mark_rage_clicks(session)
    session["is_dead_click"] = mark_dead_clicks(session)
    session["is_exit_intent"] = session["event_type"].eq("mouse_leave_viewport")

    timestamps = session["timestamp"]
    idle = timestamps.diff().dt.total_seconds()
    session["idle_time_seconds"] = idle.round().astype("Int64")

    page_started = timestamps.where(session["event_type"].eq("page_view"))
    page_started = page_started.ffill()
    dwell = (timestamps - page_started).dt.total_seconds()
    session["dwell_time_seconds"] = dwell.fillna(0).round().astype(int)
    session["interaction_pace"] = [interaction_pace(None if pd.isna(v) else float(v)) for v in idle]

    prev_page = session["page_type"].where(session["event_type"].eq("page_view")).ffill().shift(1)
    actions = []
    for idx, row in session.iterrows():
        idle_s = None if pd.isna(row["idle_time_seconds"]) else float(row["idle_time_seconds"])
        actions.append(classify_action(row, prev_page.loc[idx] if idx in prev_page.index else None, idle_s))
    hesitation_eligible = {"SCROLL", "PAGE_VIEW", "CLICK", "FORM_INPUT"}
    session["action_type"] = [
        "LONG_HESITATION"
        if (not pd.isna(idle_s) and float(idle_s) >= 15 and action in hesitation_eligible)
        else action
        for action, idle_s in zip(actions, idle)
    ]

    active_filters: dict[str, Any] = {}
    inspected: list[str] = []
    cart_value = 0.0
    last_error_code = None
    last_error_message = None
    last_inspect_ts = None
    friction_history: list[str] = []
    consecutive = 0
    rows_out: list[dict[str, Any]] = []

    for seq, (_, row) in enumerate(session.iterrows(), start=1):
        payload = _payload(row.get("payload"))
        if row["event_type"] == "filter_apply" and payload.get("filter_category"):
            active_filters[payload["filter_category"]] = payload.get("value")
        elif row["event_type"] == "filter_remove" and payload.get("filter_category"):
            active_filters.pop(payload["filter_category"], None)
        inspect_seconds = None
        if row["action_type"] == "PRODUCT_INSPECT" and row.get("product_id"):
            last_inspect_ts = row["timestamp"]
            if row["product_id"] not in inspected:
                inspected.append(str(row["product_id"]))
        elif row["action_type"] == "POGO_STICK_BOUNCE" and last_inspect_ts is not None:
            inspect_seconds = max(int((row["timestamp"] - last_inspect_ts).total_seconds()), 1)
        if row["event_type"] == "add_to_cart" and pd.notna(row.get("unit_price")):
            cart_value += float(row["unit_price"])
        elif row["event_type"] == "remove_from_cart" and pd.notna(row.get("unit_price")):
            cart_value = max(0.0, cart_value - float(row["unit_price"]))
        elif row["event_type"] == "order_completed":
            cart_value = float(payload.get("total_amount") or cart_value)

        if pd.notna(row.get("error_code")):
            last_error_code = row["error_code"]
            last_error_message = row.get("error_message")

        kind = friction_kind(row)
        if kind:
            friction_history.append(kind)
        consecutive = consecutive + 1 if is_error_like(row) else 0

        window_start = row["timestamp"] - RECENT_ERROR_WINDOW
        recent_mask = (session["timestamp"] <= row["timestamp"]) & (session["timestamp"] >= window_start)
        recent = session.loc[recent_mask]
        recent_errors = int(
            recent["is_rage_click"].sum()
            + recent["is_dead_click"].sum()
            + recent["event_type"].isin(ERROR_EVENT_TYPES).sum()
            + ((recent["event_type"] == "search") & (recent["search_results_count"].fillna(-1) == 0)).sum()
        )
        history = session.loc[session["timestamp"] <= row["timestamp"]]
        session_errors = int(
            history["is_rage_click"].sum()
            + history["is_dead_click"].sum()
            + history["event_type"].isin(ERROR_EVENT_TYPES).sum()
            + ((history["event_type"] == "search") & (history["search_results_count"].fillna(-1) == 0)).sum()
        )

        out = {
            "event_id": row["event_id"],
            "session_id": row["session_id"],
            "event_seq": seq,
            "timestamp": row["timestamp"].isoformat().replace("+00:00", "Z"),
            "user_id": row.get("user_id"),
            "anonymous_id": row.get("anonymous_id"),
            "page_type": row.get("page_type"),
            "page_title": row.get("page_title"),
            "action_type": row["action_type"],
            "dwell_time_seconds": int(row["dwell_time_seconds"]),
            "idle_time_seconds": None if pd.isna(row["idle_time_seconds"]) else int(row["idle_time_seconds"]),
            "interaction_pace": row["interaction_pace"],
            "is_rage_click": bool(row["is_rage_click"]),
            "is_dead_click": bool(row["is_dead_click"]),
            "is_exit_intent": bool(row["is_exit_intent"]),
            "friction_detected": bool(kind),
            "session_error_count": session_errors,
            "recent_errors_count": recent_errors,
            "consecutive_errors_count": consecutive,
            "rage_clicks_count": int(history["is_rage_click"].sum()),
            "dead_clicks_count": int(history["is_dead_click"].sum()),
            "form_errors_count": int(history["event_type"].eq("ui_error").sum()),
            "zero_result_searches": int(
                ((history["event_type"] == "search") & (history["search_results_count"].fillna(-1) == 0)).sum()
            ),
            "last_error_code": last_error_code,
            "last_error_message": last_error_message,
            "most_frequent_friction": Counter(friction_history).most_common(1)[0][0] if friction_history else None,
            "active_filters": json.dumps(active_filters, ensure_ascii=False) if active_filters else None,
            "compared_products_count": len(inspected),
            "current_product_name": row.get("product_name"),
            "current_product_price": row.get("unit_price"),
            "cart_value": round(cart_value, 2) if cart_value else None,
            "_search_query": row.get("search_query"),
            "_search_results_count": row.get("search_results_count"),
            "_element_text": row.get("element_text"),
            "_element_id": row.get("element_id"),
            "_payload": row.get("payload"),
            "_scroll_y": row.get("scroll_y"),
            "_inspect_seconds": inspect_seconds,
        }
        out["narrative_summary"] = narrative_summary(pd.Series(out))
        rows_out.append(out)

    result = pd.DataFrame(rows_out)
    return result[PREPROCESSED_COLUMNS]


def preprocess(raw: pd.DataFrame) -> pd.DataFrame:
    raw = raw.copy()
    raw["timestamp"] = _parse_ts(raw["client_timestamp"])
    frames = [preprocess_session(group) for _, group in raw.groupby("session_id", sort=False)]
    return pd.concat(frames, ignore_index=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocess raw ecommerce telemetry")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw = pd.read_csv(args.input)
    processed = preprocess(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    processed.to_csv(args.output, index=False)
    triggers = processed[
        processed["friction_detected"]
        | processed["is_rage_click"]
        | processed["is_exit_intent"]
        | (processed["recent_errors_count"] >= 2)
    ]
    print(f"Wrote {len(processed)} preprocessed events to {args.output}")
    print(f"Sessions: {processed['session_id'].nunique()}")
    print(f"Friction / trigger-like rows: {len(triggers)}")
    print(processed["action_type"].value_counts().head(12).to_string())


if __name__ == "__main__":
    main()
