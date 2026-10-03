"""Generate synthetic raw ecommerce telemetry sessions for AGD catalog.

Four behavioural personas aligned with PRD and the 6 behavior detectors:
- decision_fatigue: comparison oscillation and rapid filter churn
- product_hesitation: product revisit and no-progress stalling
- technical_friction: rage clicks and dead click clusters
- smooth_browsing: normal, smooth exploration of products and filters
"""

from __future__ import annotations

import argparse
import json
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "raw_ecommerce_events.csv"
DEFAULT_GROUND_TRUTH_OUTPUT = PROJECT_ROOT / "data" / "sessions_ground_truth.csv"

RAW_COLUMNS = [
    "event_id",
    "session_id",
    "page_view_id",
    "sequence_number",
    "client_timestamp",
    "server_timestamp",
    "event_date",
    "anonymous_id",
    "event_name",
    "event_type",  # alias for backward compatibility
    "page_type",
    "page_url",
    "page_path",
    "page_title",
    "referrer_url",
    "element_id",
    "element_tag",
    "search_query",
    "search_results_count",
    "product_id",
    "product_name",
    "product_category",
    "product_brand",
    "unit_price",
    "filter_id",
    "filter_value",
    "device_type",
    "payload",
]

PRODUCTS = [
    {
        "product_id": "p-bosch-serie6",
        "product_name": "Bosch Serie 6 WAU28T0EPL",
        "product_category": "pralki",
        "product_brand": "Bosch",
        "unit_price": 2399.00,
        "energy_class": "A",
        "capacity": "9kg",
    },
    {
        "product_id": "p-samsung-ecobubble",
        "product_name": "Samsung EcoBubble WW90T534DAE",
        "product_category": "pralki",
        "product_brand": "Samsung",
        "unit_price": 2199.00,
        "energy_class": "A",
        "capacity": "9kg",
    },
    {
        "product_id": "p-whirlpool-freshcare",
        "product_name": "Whirlpool FreshCare+ FFD 9458",
        "product_category": "pralki",
        "product_brand": "Whirlpool",
        "unit_price": 1749.00,
        "energy_class": "B",
        "capacity": "9kg",
    },
    {
        "product_id": "p-electrolux-perfectcare",
        "product_name": "Electrolux PerfectCare 600 EW6F428WP",
        "product_category": "pralki",
        "product_brand": "Electrolux",
        "unit_price": 1999.00,
        "energy_class": "A",
        "capacity": "8kg",
    },
    {
        "product_id": "p-samsung-bespoke-fridge",
        "product_name": "Samsung Bespoke RB38A7B6341",
        "product_category": "lodowki",
        "product_brand": "Samsung",
        "unit_price": 3199.00,
        "energy_class": "C",
        "width": "60cm",
    },
    {
        "product_id": "p-lg-noboundary-fridge",
        "product_name": "LG No Frost GBB72MCDMN",
        "product_category": "lodowki",
        "product_brand": "LG",
        "unit_price": 2899.00,
        "energy_class": "D",
        "width": "60cm",
    },
    {
        "product_id": "p-bosch-serie4-fridge",
        "product_name": "Bosch Serie 4 KGN39VLEB",
        "product_category": "lodowki",
        "product_brand": "Bosch",
        "unit_price": 2549.00,
        "energy_class": "E",
        "width": "60cm",
    },
    {
        "product_id": "p-bosch-smv4-dishwasher",
        "product_name": "Bosch Serie 4 SMV4EVX14E",
        "product_category": "zmywarki",
        "product_brand": "Bosch",
        "unit_price": 2149.00,
        "energy_class": "C",
        "width": "60cm",
    },
    {
        "product_id": "p-siemens-iq300-dishwasher",
        "product_name": "Siemens iQ300 SN63EX14CE",
        "product_category": "zmywarki",
        "product_brand": "Siemens",
        "unit_price": 2499.00,
        "energy_class": "C",
        "width": "60cm",
    },
    {
        "product_id": "p-whirlpool-maxispace-dishwasher",
        "product_name": "Whirlpool MaxiSpace W8I HP42 L",
        "product_category": "zmywarki",
        "product_brand": "Whirlpool",
        "unit_price": 2099.00,
        "energy_class": "C",
        "width": "60cm",
    },
]

SEARCHES = [
    ("pralka 9kg bosch seria 6", 14),
    ("lodówka no frost 60cm", 22),
    ("zmywarka do zabudowy 60", 18),
    ("pralka a cicha", 12),
    ("lodowka samsung bespoke", 8),
    ("zmywarka siemens zeolith", 6),
]

DEVICES = {
    "desktop": {"device_type": "desktop"},
    "mobile": {"device_type": "mobile"},
}

BASE_URL = "https://agd-katalog.local"


def _iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _path_for(page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> tuple[str, str, str]:
    if page_type == "home":
        return f"{BASE_URL}/", "/", "Katalog AGD - Strona główna"
    if page_type == "catalog":
        return f"{BASE_URL}/katalog", "/katalog", "Katalog AGD - Wszystkie produkty"
    if page_type == "search":
        q = query or "pralka"
        path = f"/szukaj?q={q.replace(' ', '+')}"
        return f"{BASE_URL}{path}", path, f"Wyniki wyszukiwania: {q}"
    if page_type == "category":
        cat = product["product_category"] if product else "pralki"
        return f"{BASE_URL}/katalog/{cat}", f"/katalog/{cat}", f"AGD - {cat.capitalize()}"
    if page_type == "product" and product:
        path = f"/produkt/{product['product_id']}"
        return f"{BASE_URL}{path}", path, f"{product['product_name']} - Specyfikacja"
    return f"{BASE_URL}/katalog", "/katalog", "Katalog AGD"


@dataclass
class SessionBuilder:
    persona: str
    session_id: str
    anonymous_id: str
    start_time: datetime
    device: dict[str, Any]
    rng: random.Random
    clock: datetime = field(init=False)
    page_view_id: str = field(init=False)
    seq: int = field(default=0)
    page_type: str = "home"
    page_url: str = f"{BASE_URL}/"
    page_path: str = "/"
    page_title: str = "Katalog AGD"
    referrer_url: str | None = None
    current_product: dict[str, Any] | None = None
    current_query: str | None = None
    active_filters: dict[str, list[str]] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.clock = self.start_time
        self.page_view_id = f"pv_{uuid.uuid4().hex[:10]}"

    def advance(self, lo_ms: int, hi_ms: int) -> None:
        self.clock += timedelta(milliseconds=self.rng.randint(lo_ms, hi_ms))

    def _page(self, page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> None:
        self.referrer_url = self.page_url
        self.page_type = page_type
        self.current_product = product
        self.page_view_id = f"pv_{uuid.uuid4().hex[:10]}"
        if query is not None:
            self.current_query = query
        self.page_url, self.page_path, self.page_title = _path_for(page_type, product, self.current_query)

    def emit(self, event_name: str, **overrides: Any) -> dict[str, Any]:
        self.seq += 1
        product = overrides.pop("product", self.current_product)
        payload = overrides.pop("payload", None)
        client_ts = self.clock
        server_ts = client_ts + timedelta(milliseconds=self.rng.randint(18, 120))
        filter_id = overrides.pop("filter_id", None)
        filter_value = overrides.pop("filter_value", None)

        event = {
            "event_id": f"evt_{uuid.uuid4().hex}",
            "session_id": self.session_id,
            "page_view_id": self.page_view_id,
            "sequence_number": self.seq,
            "client_timestamp": _iso(client_ts),
            "server_timestamp": _iso(server_ts),
            "event_date": client_ts.date().isoformat(),
            "anonymous_id": self.anonymous_id,
            "event_name": event_name,
            "event_type": event_name,  # backward compatibility alias
            "page_type": overrides.pop("page_type", self.page_type),
            "page_url": overrides.pop("page_url", self.page_url),
            "page_path": overrides.pop("page_path", self.page_path),
            "page_title": overrides.pop("page_title", self.page_title),
            "referrer_url": overrides.pop("referrer_url", self.referrer_url),
            "element_id": overrides.pop("element_id", None),
            "element_tag": overrides.pop("element_tag", None),
            "search_query": overrides.pop("search_query", self.current_query),
            "search_results_count": overrides.pop("search_results_count", None),
            "product_id": product["product_id"] if product else None,
            "product_name": product["product_name"] if product else None,
            "product_category": product["product_category"] if product else None,
            "product_brand": product["product_brand"] if product else None,
            "unit_price": product["unit_price"] if product else None,
            "filter_id": filter_id,
            "filter_value": filter_value,
            "device_type": self.device["device_type"],
            "payload": json.dumps(payload, ensure_ascii=False) if payload is not None else None,
        }
        event.update(overrides)
        self.events.append(event)
        return event

    def page_enter(self, page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> None:
        self._page(page_type, product, query)
        self.emit("page_enter")

    def click(
        self,
        element_id: str,
        *,
        tag: str = "BUTTON",
        payload: dict[str, Any] | None = None,
        product: dict[str, Any] | None = None,
    ) -> None:
        self.emit(
            "element_click",
            element_id=element_id,
            element_tag=tag,
            payload=payload,
            product=product,
        )

    def scroll(self, depth_pct: int = 50) -> None:
        self.emit("scroll_summary", payload={"scrollDepthPercent": depth_pct})

    def search(self, query: str, results_count: int) -> None:
        self.current_query = query
        self._page("search", query=query)
        self.emit("search_submitted", search_query=query, search_results_count=results_count)
        self.emit("page_enter", search_query=query, search_results_count=results_count)

    def apply_filter(self, filter_id: str, value: str) -> None:
        values = self.active_filters.get(filter_id, [])
        if value not in values:
            values.append(value)
        self.active_filters[filter_id] = values
        self.emit(
            "filter_added",
            filter_id=filter_id,
            filter_value=value,
            element_id=f"filter_{filter_id}_{value}",
            element_tag="INPUT",
            payload={"filterId": filter_id, "value": value},
        )

    def remove_filter(self, filter_id: str, value: str | None = None) -> None:
        if filter_id in self.active_filters:
            if value and value in self.active_filters[filter_id]:
                self.active_filters[filter_id].remove(value)
                if not self.active_filters[filter_id]:
                    del self.active_filters[filter_id]
            else:
                del self.active_filters[filter_id]
        self.emit(
            "filter_removed",
            filter_id=filter_id,
            filter_value=value,
            element_id=f"filter_clear_{filter_id}",
            element_tag="BUTTON",
            payload={"filterId": filter_id, "value": value},
        )

    def view_product(self, product: dict[str, Any], dwell_ms: int = 3000) -> None:
        self._page("product", product=product)
        self.emit("page_enter", product=product)
        self.emit("product_viewed", product=product)
        self.advance(int(dwell_ms * 0.4), int(dwell_ms * 0.7))
        self.scroll(40)
        self.advance(int(dwell_ms * 0.3), int(dwell_ms * 0.6))

    def ui_state_changed(self, component: str, state: str) -> None:
        self.emit("ui_state_changed", payload={"component": component, "state": state})


def _pick_products(rng: random.Random, category: str, n: int) -> list[dict[str, Any]]:
    matching = [p for p in PRODUCTS if p["product_category"] == category]
    return rng.sample(matching, k=min(n, len(matching)))


def build_decision_fatigue_session(builder: SessionBuilder) -> None:
    """Decision fatigue scenario:

    1. Rapid filter churn (adding and undoing multiple filters without progress).
    2. Comparison oscillation (switching back and forth between 3 washing machines without narrowing).
    """
    builder.advance(300, 800)
    builder.page_enter("catalog")
    builder.advance(800, 1600)
    builder.search("pralka 9kg bosch seria 6", 14)

    # 1. Rapid filter churn within ~20 seconds (< 30s window), >= 6 changes, >= 2 undone
    builder.advance(1000, 2000)
    builder.apply_filter("width", "60cm")
    builder.advance(1200, 2200)
    builder.apply_filter("energy_class", "A")
    builder.advance(1000, 1800)
    builder.remove_filter("width", "60cm")  # undone 1
    builder.advance(1100, 2100)
    builder.apply_filter("brand", "Bosch")
    builder.advance(1200, 2000)
    builder.remove_filter("energy_class", "A")  # undone 2
    builder.advance(900, 1700)
    builder.apply_filter("price", "2000-2500")

    # 2. Comparison oscillation: 3 washing machines, 5 transitions back and forth
    prods = _pick_products(builder.rng, "pralki", 3)
    p1, p2, p3 = prods[0], prods[1], prods[2]

    # Transition sequence: P1 -> P2 -> P1 -> P3 -> P2 -> P1 (5 transitions, candidates=3)
    sequence = [p1, p2, p1, p3, p2, p1]
    for p in sequence:
        builder.advance(800, 1800)
        builder.click(f"card_{p['product_id']}", tag="DIV", product=p)
        builder.advance(200, 500)
        builder.view_product(p, dwell_ms=builder.rng.randint(2500, 4500))
        builder.advance(400, 900)
        builder.click("btn_back_to_catalog", tag="A")
        builder.advance(200, 400)
        builder.page_enter("catalog")


def build_product_hesitation_session(builder: SessionBuilder) -> None:
    """Hesitation & Revisit scenario:

    1. Viewing P1, then intermediate products, then returning to P1 (product_revisit).
    2. Stalling in catalog/category for >60s with activity but no progress (no_progress_window).
    """
    builder.advance(200, 600)
    builder.page_enter("catalog")
    builder.advance(600, 1400)

    # Revisit dishwasher P1 after viewing P2
    dishwashers = _pick_products(builder.rng, "zmywarki", 2)
    p1, p2 = dishwashers[0], dishwashers[1]

    # View P1
    builder.advance(1000, 2000)
    builder.click(f"card_{p1['product_id']}", tag="DIV", product=p1)
    builder.advance(200, 400)
    builder.view_product(p1, dwell_ms=4000)

    # View intermediate P2
    builder.advance(500, 1000)
    builder.click("btn_back_to_catalog", tag="A")
    builder.advance(200, 400)
    builder.page_enter("catalog")
    builder.advance(1200, 2500)
    builder.click(f"card_{p2['product_id']}", tag="DIV", product=p2)
    builder.advance(200, 400)
    builder.view_product(p2, dwell_ms=3500)

    # Revisit P1 (meaningful dwell > 2000ms)
    builder.advance(600, 1200)
    builder.click("btn_back_to_catalog", tag="A")
    builder.advance(200, 400)
    builder.page_enter("catalog")
    builder.advance(1000, 2000)
    builder.click(f"card_{p1['product_id']}", tag="DIV", product=p1)
    builder.advance(200, 400)
    builder.view_product(p1, dwell_ms=4500)

    # Back to catalog - now stall with active clicks and scrolls for >60s without viewing products
    builder.advance(400, 800)
    builder.click("btn_back_to_catalog", tag="A")
    builder.advance(200, 400)
    builder.page_enter("category", product=p1)

    for _ in range(6):
        builder.advance(8000, 14000)
        builder.scroll(builder.rng.randint(20, 80))
        builder.advance(2000, 5000)
        builder.click("btn_spec_filter_toggle", tag="BUTTON")


def build_technical_friction_session(builder: SessionBuilder) -> None:
    """Friction scenario:

    1. Rage clicks on an unresponsive filter/button (3+ clicks within 2.5s with no UI reaction).
    2. Dead click cluster on a non-interactive element (2+ clicks followed by >= 1.5s silence).
    """
    builder.advance(300, 700)
    builder.page_enter("catalog")
    builder.advance(1000, 2000)

    # 1. Rage click on a filter button (4 clicks in ~400ms, no ui_state_changed)
    target_btn = "btn_filter_apply_price"
    for _ in range(4):
        builder.advance(80, 160)
        builder.click(target_btn, tag="BUTTON")

    builder.advance(1500, 2500)

    # 2. Dead clicks on a static badge / banner (2 clicks in ~300ms, followed by 2s silence)
    dead_target = "static_badge_eco_guarantee"
    for _ in range(2):
        builder.advance(100, 200)
        builder.click(dead_target, tag="DIV")

    # Complete silence for 2.2 seconds (exceeds silenceMs = 1500)
    builder.advance(2200, 3000)

    # User scrolls and navigates away
    builder.scroll(60)
    builder.advance(1500, 3000)
    builder.page_enter("catalog")


def build_smooth_browsing_session(builder: SessionBuilder) -> None:
    """Smooth and successful browsing session:

    Normal search, systematic filter use, thorough review of two products without friction.
    """
    builder.advance(200, 600)
    builder.page_enter("home")
    builder.advance(800, 1800)
    builder.search("lodówka no frost 60cm", 22)
    builder.advance(1500, 3000)
    builder.apply_filter("brand", "Samsung")
    builder.ui_state_changed("catalog_grid", "filtered")
    builder.advance(2000, 4000)
    builder.scroll(30)

    fridges = _pick_products(builder.rng, "lodowki", 2)
    p1 = fridges[0]

    builder.advance(1500, 3000)
    builder.click(f"card_{p1['product_id']}", tag="DIV", product=p1)
    builder.advance(300, 600)
    builder.view_product(p1, dwell_ms=12000)

    builder.advance(1000, 2000)
    builder.click("btn_back_to_catalog", tag="A")
    builder.advance(300, 500)
    builder.page_enter("catalog")
    builder.advance(2000, 4000)

    p2 = fridges[1]
    builder.click(f"card_{p2['product_id']}", tag="DIV", product=p2)
    builder.advance(300, 600)
    builder.view_product(p2, dwell_ms=10000)


PERSONA_BUILDERS = {
    "decision_fatigue": build_decision_fatigue_session,
    "product_hesitation": build_product_hesitation_session,
    "technical_friction": build_technical_friction_session,
    "smooth_browsing": build_smooth_browsing_session,
}

EXPECTED_SIGNALS = {
    "decision_fatigue": "comparison_oscillation, rapid_filter_churn",
    "product_hesitation": "product_revisit, no_progress_window",
    "technical_friction": "rage_click, dead_click_cluster",
    "smooth_browsing": "none",
}

GROUND_TRUTH_COLUMNS = [
    "session_id",
    "persona",
    "start_time",
    "anonymous_id",
    "device_type",
    "expected_signals",
]


def generate_sessions(
    *,
    sessions_per_persona: int,
    seed: int,
    start: datetime,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rng = random.Random(seed)
    rows: list[dict[str, Any]] = []
    labels: list[dict[str, Any]] = []
    clock = start
    session_index = 0

    for persona, build in PERSONA_BUILDERS.items():
        for _ in range(sessions_per_persona):
            clock += timedelta(minutes=rng.randint(4, 18), seconds=rng.randint(0, 50))
            device_name = "mobile" if rng.random() < 0.3 else "desktop"
            session_id = f"sess_{session_index:04d}_{uuid.UUID(int=rng.getrandbits(128)).hex[:8]}"
            anonymous_id = f"anon_{uuid.UUID(int=rng.getrandbits(128)).hex[:12]}"
            session_index += 1
            builder = SessionBuilder(
                persona=persona,
                session_id=session_id,
                anonymous_id=anonymous_id,
                start_time=clock,
                device=DEVICES[device_name],
                rng=rng,
            )
            build(builder)
            rows.extend(builder.events)
            labels.append(
                {
                    "session_id": builder.session_id,
                    "persona": persona,
                    "start_time": _iso(builder.start_time),
                    "anonymous_id": builder.anonymous_id,
                    "device_type": builder.device["device_type"],
                    "expected_signals": EXPECTED_SIGNALS[persona],
                }
            )
    return rows, labels


def write_raw_csv(rows: list[dict[str, Any]], output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows, columns=RAW_COLUMNS)
    frame.to_csv(output, index=False)
    return output


def write_ground_truth_csv(labels: list[dict[str, Any]], output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(labels, columns=GROUND_TRUTH_COLUMNS)
    frame.to_csv(output, index=False)
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate synthetic raw AGD ecommerce telemetry CSV")
    parser.add_argument("--sessions-per-persona", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ground-truth-output", type=Path, default=DEFAULT_GROUND_TRUTH_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    start = datetime(2026, 10, 3, 9, 15, tzinfo=timezone.utc)
    rows, labels = generate_sessions(
        sessions_per_persona=args.sessions_per_persona,
        seed=args.seed,
        start=start,
    )
    path = write_raw_csv(rows, args.output)
    truth_path = write_ground_truth_csv(labels, args.ground_truth_output)
    personas = pd.DataFrame(labels).groupby("persona")["session_id"].nunique().to_dict()
    print(f"Wrote {len(rows)} raw events to {path}")
    print(f"Wrote {len(labels)} session labels to {truth_path}")
    print(f"Sessions by persona: {personas}")


if __name__ == "__main__":
    main()
