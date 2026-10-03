"""Generate synthetic raw ecommerce telemetry sessions.

Four behavioural personas:
- frustration: coupon / form failures and clustered clicks
- decision_fatigue: pogo-sticking and filter thrashing
- boredom: idle time, hidden tabs, mindless scrolling
- satisfaction: a smooth search-to-purchase path
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
    "client_timestamp",
    "server_timestamp",
    "event_date",
    "user_id",
    "anonymous_id",
    "event_type",
    "page_type",
    "page_url",
    "page_path",
    "page_title",
    "referrer_url",
    "element_tag",
    "element_id",
    "element_text",
    "element_selector",
    "pointer_x",
    "pointer_y",
    "scroll_y",
    "viewport_width",
    "viewport_height",
    "document_height",
    "search_query",
    "search_results_count",
    "product_id",
    "product_name",
    "product_category",
    "product_brand",
    "merchant_id",
    "unit_price",
    "cart_id",
    "error_type",
    "error_code",
    "error_message",
    "device_type",
    "user_agent",
    "payload",
]

PRODUCTS = [
    {
        "product_id": "p-redmi-note-13-pro",
        "product_name": "Xiaomi Redmi Note 13 Pro 256GB",
        "product_category": "Smartfony",
        "product_brand": "Xiaomi",
        "merchant_id": "mediaexpert",
        "unit_price": 1299.00,
    },
    {
        "product_id": "p-poco-x6-pro",
        "product_name": "Poco X6 Pro 512GB",
        "product_category": "Smartfony",
        "product_brand": "Xiaomi",
        "merchant_id": "xkom",
        "unit_price": 1599.00,
    },
    {
        "product_id": "p-galaxy-a55",
        "product_name": "Samsung Galaxy A55 5G 256GB",
        "product_category": "Smartfony",
        "product_brand": "Samsung",
        "merchant_id": "morele",
        "unit_price": 1799.00,
    },
    {
        "product_id": "p-iphone-15",
        "product_name": "Apple iPhone 15 128GB",
        "product_category": "Smartfony",
        "product_brand": "Apple",
        "merchant_id": "ispot",
        "unit_price": 3499.00,
    },
    {
        "product_id": "p-nothing-2a",
        "product_name": "Nothing Phone (2a) 256GB",
        "product_category": "Smartfony",
        "product_brand": "Nothing",
        "merchant_id": "xkom",
        "unit_price": 1449.00,
    },
    {
        "product_id": "p-pixel-8a",
        "product_name": "Google Pixel 8a 128GB",
        "product_category": "Smartfony",
        "product_brand": "Google",
        "merchant_id": "mediaexpert",
        "unit_price": 1899.00,
    },
]

SEARCHES = [
    ("smartfon 256gb do 2000", 42),
    ("smartfon samsung 5g", 28),
    ("tani ajfon", 0),
    ("xiaomi 256gb", 19),
    ("nothing phone 2a", 6),
    ("smartfon do fotografii", 31),
]

DEVICES = {
    "desktop": {
        "device_type": "desktop",
        "viewport_width": 1440,
        "viewport_height": 900,
        "document_height": 4200,
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        ),
    },
    "mobile": {
        "device_type": "mobile",
        "viewport_width": 390,
        "viewport_height": 844,
        "document_height": 6100,
        "user_agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"
        ),
    },
}

BASE_URL = "https://www.ceneo.pl"


def _iso(ts: datetime) -> str:
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _path_for(page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> tuple[str, str, str]:
    if page_type == "home":
        return f"{BASE_URL}/", "/", "Ceneo - porównywarka cen"
    if page_type == "search":
        q = query or "smartfon"
        path = f"/szukaj-{q.replace(' ', '+')}.htm"
        return f"{BASE_URL}{path}", path, f"Szukaj: {q} - Ceneo"
    if page_type == "category":
        return f"{BASE_URL}/Smartfony;szukaj-smartfon", "/Smartfony", "Smartfony - Ceneo"
    if page_type == "product_details" and product:
        path = f"/{product['product_id']}"
        return f"{BASE_URL}{path}", path, f"{product['product_name']} - Ceneo"
    if page_type == "cart":
        return f"{BASE_URL}/koszyk", "/koszyk", "Koszyk - Ceneo"
    if page_type == "checkout":
        return f"{BASE_URL}/zamowienie", "/zamowienie", "Zamówienie - Ceneo"
    return f"{BASE_URL}/", "/", "Ceneo"


@dataclass
class SessionBuilder:
    persona: str
    session_id: str
    anonymous_id: str
    user_id: str | None
    start_time: datetime
    device: dict[str, Any]
    rng: random.Random
    cart_id: str = field(default_factory=lambda: f"cart_{uuid.uuid4().hex[:10]}")
    clock: datetime = field(init=False)
    page_type: str = "home"
    page_url: str = f"{BASE_URL}/"
    page_path: str = "/"
    page_title: str = "Ceneo - porównywarka cen"
    referrer_url: str | None = None
    scroll_y: int = 0
    current_product: dict[str, Any] | None = None
    current_query: str | None = None
    events: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.clock = self.start_time

    def advance(self, lo_ms: int, hi_ms: int) -> None:
        self.clock += timedelta(milliseconds=self.rng.randint(lo_ms, hi_ms))

    def _page(self, page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> None:
        self.referrer_url = self.page_url
        self.page_type = page_type
        self.current_product = product
        if query is not None:
            self.current_query = query
        self.page_url, self.page_path, self.page_title = _path_for(page_type, product, self.current_query)
        self.scroll_y = 0

    def emit(self, event_type: str, **overrides: Any) -> dict[str, Any]:
        product = overrides.pop("product", self.current_product)
        payload = overrides.pop("payload", None)
        client_ts = self.clock
        server_ts = client_ts + timedelta(milliseconds=self.rng.randint(18, 220))
        event = {
            "event_id": f"evt_{uuid.uuid4().hex}",
            "session_id": self.session_id,
            "client_timestamp": _iso(client_ts),
            "server_timestamp": _iso(server_ts),
            "event_date": client_ts.date().isoformat(),
            "user_id": self.user_id,
            "anonymous_id": self.anonymous_id,
            "event_type": event_type,
            "page_type": overrides.pop("page_type", self.page_type),
            "page_url": overrides.pop("page_url", self.page_url),
            "page_path": overrides.pop("page_path", self.page_path),
            "page_title": overrides.pop("page_title", self.page_title),
            "referrer_url": overrides.pop("referrer_url", self.referrer_url),
            "element_tag": None,
            "element_id": None,
            "element_text": None,
            "element_selector": None,
            "pointer_x": None,
            "pointer_y": None,
            "scroll_y": self.scroll_y,
            "viewport_width": self.device["viewport_width"],
            "viewport_height": self.device["viewport_height"],
            "document_height": self.device["document_height"],
            "search_query": self.current_query,
            "search_results_count": None,
            "product_id": product["product_id"] if product else None,
            "product_name": product["product_name"] if product else None,
            "product_category": product["product_category"] if product else None,
            "product_brand": product["product_brand"] if product else None,
            "merchant_id": product["merchant_id"] if product else None,
            "unit_price": product["unit_price"] if product else None,
            "cart_id": self.cart_id if self.page_type in {"cart", "checkout"} or event_type in {
                "add_to_cart",
                "remove_from_cart",
                "order_completed",
            } else None,
            "error_type": None,
            "error_code": None,
            "error_message": None,
            "device_type": self.device["device_type"],
            "user_agent": self.device["user_agent"],
            "payload": json.dumps(payload, ensure_ascii=False) if payload is not None else None,
        }
        event.update(overrides)
        self.events.append(event)
        return event

    def page_view(self, page_type: str, product: dict[str, Any] | None = None, query: str | None = None) -> None:
        self._page(page_type, product, query)
        self.emit("page_view")

    def click(
        self,
        element_id: str,
        element_text: str,
        *,
        tag: str = "BUTTON",
        selector: str | None = None,
        x: int | None = None,
        y: int | None = None,
        payload: dict[str, Any] | None = None,
        product: dict[str, Any] | None = None,
    ) -> None:
        vw, vh = self.device["viewport_width"], self.device["viewport_height"]
        self.emit(
            "click",
            element_tag=tag,
            element_id=element_id,
            element_text=element_text,
            element_selector=selector or f"#{element_id}",
            pointer_x=x if x is not None else self.rng.randint(40, vw - 40),
            pointer_y=y if y is not None else self.rng.randint(80, vh - 80),
            payload=payload,
            product=product,
        )

    def scroll_to(self, y: int) -> None:
        self.scroll_y = max(0, min(y, self.device["document_height"]))
        depth = round(100 * self.scroll_y / max(self.device["document_height"], 1))
        self.emit("scroll_checkpoint", payload={"scroll_depth_percent": depth})

    def search(self, query: str, results_count: int) -> None:
        self.current_query = query
        self._page("search", query=query)
        self.emit("search", search_query=query, search_results_count=results_count)
        self.emit("page_view", search_query=query, search_results_count=results_count)

    def apply_filter(self, category: str, value: str) -> None:
        self.emit(
            "filter_apply",
            element_tag="INPUT",
            element_id=f"filter_{category}",
            element_text=value,
            element_selector=f"input[name='{category}']",
            payload={"filter_category": category, "filter_action": "applied", "value": value},
        )

    def remove_filter(self, category: str, value: str | None = None) -> None:
        self.emit(
            "filter_remove",
            element_tag="BUTTON",
            element_id=f"filter_{category}_clear",
            element_text="Wyczyść",
            element_selector=f"#filter_{category}_clear",
            payload={"filter_category": category, "filter_action": "removed", "value": value},
        )

    def error(self, error_type: str, code: str, message: str, *, element_id: str | None = None) -> None:
        self.emit(
            "ui_error" if error_type == "form_validation" else "api_error",
            error_type=error_type,
            error_code=code,
            error_message=message,
            element_id=element_id,
            element_tag="FORM" if error_type == "form_validation" else None,
        )


def _pick_products(rng: random.Random, n: int) -> list[dict[str, Any]]:
    return rng.sample(PRODUCTS, k=min(n, len(PRODUCTS)))


def build_frustration_session(builder: SessionBuilder) -> None:
    """Failed coupons, clustered clicks, then an exit-intent mouse leave."""
    variant = builder.rng.choice(["coupon", "empty_search", "dead_ui"])
    builder.advance(200, 800)
    builder.page_view("home")
    builder.advance(1200, 2800)
    builder.scroll_to(builder.rng.randint(180, 420))

    if variant == "empty_search":
        builder.advance(900, 1600)
        builder.search("tani ajfon", 0)
        builder.advance(1400, 2600)
        builder.search("tani iphone 12", 0)
        builder.advance(1800, 3200)
        builder.click("btn_search", "Szukaj", tag="BUTTON", x=1180, y=64)
        builder.advance(400, 700)
        builder.search("ajfon 15 tanio", 0)
        builder.advance(2200, 4000)
        builder.emit("mouse_leave_viewport", pointer_x=builder.rng.randint(200, 900), pointer_y=2)
        return

    query, results = builder.rng.choice([s for s in SEARCHES if s[1] > 0])
    builder.advance(800, 1800)
    builder.search(query, results)
    product = builder.rng.choice(PRODUCTS)
    builder.advance(2500, 5000)
    builder.click("offer_tile", product["product_name"], tag="A", product=product)
    builder.advance(300, 700)
    builder.page_view("product_details", product)
    builder.advance(4000, 8000)
    builder.click("btn_add_to_cart", "Dodaj do koszyka", x=1100, y=520, product=product)
    builder.advance(200, 500)
    builder.emit("add_to_cart", product=product, payload={"quantity": 1})
    builder.advance(600, 1200)
    builder.page_view("cart", product)
    builder.advance(1500, 2800)
    builder.click("link_checkout", "Przejdź do kasy", tag="A", x=1120, y=610)
    builder.advance(400, 800)
    builder.page_view("checkout", product)

    coupons = [
        ("LATO2026", "COUPON_INVALID", "Kod rabatowy jest nieprawidłowy"),
        ("LATO2025", "COUPON_EXPIRED", "Kod wygasł 30 dni temu"),
        ("WIOSNA2026", "COUPON_INVALID", "Kod rabatowy jest nieprawidłowy"),
    ]
    btn_x, btn_y = 1048, 388
    for i, (code, err_code, err_msg) in enumerate(coupons):
        builder.advance(1800, 3500)
        builder.emit(
            "input",
            element_tag="INPUT",
            element_id="coupon_code",
            element_text=code,
            element_selector="#coupon_code",
            payload={"field": "coupon_code", "value": code},
        )
        builder.advance(400, 900)
        builder.click("btn_apply_coupon", "Zastosuj kod", x=btn_x, y=btn_y)
        builder.advance(180, 420)
        builder.error("form_validation", err_code, err_msg, element_id="coupon_code")
        if i == 1 or variant == "dead_ui":
            for _ in range(4):
                builder.advance(90, 180)
                builder.click(
                    "btn_apply_coupon",
                    "Zastosuj kod",
                    x=btn_x + builder.rng.randint(-4, 4),
                    y=btn_y + builder.rng.randint(-4, 4),
                )
        if variant == "dead_ui" and i == 0:
            builder.advance(700, 1200)
            builder.click(
                "banner_promo_static",
                "",
                tag="DIV",
                selector=".promo-banner",
                x=720,
                y=140,
            )

    builder.advance(1600, 3200)
    builder.emit("mouse_leave_viewport", pointer_x=builder.rng.randint(180, 860), pointer_y=1)


def build_decision_fatigue_session(builder: SessionBuilder) -> None:
    """Pogo-sticking between offers and repeated filter changes."""
    builder.advance(250, 700)
    builder.page_view("home")
    builder.advance(1000, 2200)
    query, results = "smartfon 256gb do 2000", 42
    builder.search(query, results)
    products = _pick_products(builder.rng, 4)

    builder.advance(1800, 3200)
    builder.apply_filter("brand", "Xiaomi")
    builder.advance(900, 1800)
    builder.apply_filter("memory", "256GB")

    for product in products[:3]:
        builder.advance(1400, 2800)
        builder.click("offer_tile", product["product_name"], tag="A", product=product)
        builder.advance(250, 600)
        builder.page_view("product_details", product)
        builder.advance(2200, 4800)
        builder.scroll_to(builder.rng.randint(300, 900))
        builder.advance(400, 900)
        builder.click("btn_back_results", "Wróć do wyników", tag="A")
        builder.advance(200, 450)
        builder.page_view("search")

    builder.advance(8000, 16000)
    builder.remove_filter("brand", "Xiaomi")
    builder.advance(1200, 2400)
    builder.apply_filter("price", "1000-1800")
    builder.advance(1500, 3000)
    builder.apply_filter("sort", "price_asc")
    builder.advance(12000, 19000)

    last = products[-1]
    builder.click("offer_tile", last["product_name"], tag="A", product=last)
    builder.advance(300, 700)
    builder.page_view("product_details", last)
    builder.advance(2800, 4500)
    builder.click("btn_back_results", "Wróć do wyników", tag="A")
    builder.advance(200, 500)
    builder.page_view("search")
    builder.advance(14000, 22000)
    builder.remove_filter("price", "1000-1800")
    builder.advance(900, 1600)
    builder.remove_filter("memory", "256GB")


def build_boredom_session(builder: SessionBuilder) -> None:
    """Long idle gaps, hidden tab, and scrolling without product interaction."""
    builder.advance(300, 900)
    builder.page_view("home")
    builder.advance(2000, 4000)
    builder.scroll_to(800)
    builder.advance(2500, 4500)
    builder.scroll_to(1600)
    builder.advance(1800, 3200)
    query, results = builder.rng.choice([s for s in SEARCHES if s[1] > 0])
    builder.search(query, results)
    builder.advance(4000, 7000)
    builder.scroll_to(1200)
    builder.advance(5000, 8000)
    builder.scroll_to(2400)
    builder.advance(6000, 9000)
    builder.scroll_to(3600)
    builder.advance(32000, 42000)
    builder.emit("tab_hidden", payload={"visibility_state": "hidden"})
    builder.advance(28000, 48000)
    builder.emit("tab_visible", payload={"visibility_state": "visible"})
    builder.advance(8000, 15000)
    builder.scroll_to(builder.device["document_height"] - 200)
    builder.advance(22000, 35000)
    builder.page_view("category")
    builder.advance(10000, 18000)
    builder.scroll_to(2000)
    builder.advance(30000, 40000)
    builder.emit("mouse_leave_viewport", pointer_x=builder.rng.randint(100, 700), pointer_y=4)


def build_satisfaction_session(builder: SessionBuilder) -> None:
    """Smooth search, inspect, cart, coupon success, purchase."""
    product = builder.rng.choice(
        [p for p in PRODUCTS if p["unit_price"] <= 2000 and p["product_brand"] != "Apple"]
    )
    builder.advance(200, 600)
    builder.page_view("home")
    builder.advance(900, 1600)
    builder.search("smartfon 256gb do 2000", 42)
    builder.advance(1400, 2400)
    builder.apply_filter("brand", product["product_brand"])
    builder.advance(1000, 1800)
    builder.apply_filter("memory", "256GB")
    builder.advance(1600, 2600)
    builder.click("offer_tile", product["product_name"], tag="A", product=product)
    builder.advance(350, 650)
    builder.page_view("product_details", product)
    builder.advance(8000, 14000)
    builder.scroll_to(900)
    builder.advance(4000, 7000)
    builder.click("btn_add_to_cart", "Dodaj do koszyka", x=1110, y=510, product=product)
    builder.advance(250, 500)
    builder.emit("add_to_cart", product=product, payload={"quantity": 1})
    builder.advance(700, 1300)
    builder.page_view("cart", product)
    builder.advance(2000, 3500)
    builder.click("link_checkout", "Przejdź do kasy", tag="A")
    builder.advance(400, 700)
    builder.page_view("checkout", product)
    builder.advance(1800, 2800)
    builder.emit(
        "input",
        element_tag="INPUT",
        element_id="coupon_code",
        element_text="CENEOSAVE10",
        element_selector="#coupon_code",
        payload={"field": "coupon_code", "value": "CENEOSAVE10"},
    )
    builder.advance(500, 900)
    builder.click("btn_apply_coupon", "Zastosuj kod", x=1048, y=388)
    builder.advance(300, 600)
    builder.emit(
        "click",
        element_tag="BUTTON",
        element_id="btn_pay",
        element_text="Zamawiam i płacę",
        element_selector="#btn_pay",
        pointer_x=1100,
        pointer_y=720,
        payload={"payment_method": "blik"},
    )
    builder.advance(800, 1400)
    builder.emit(
        "order_completed",
        product=product,
        payload={
            "order_id": f"ord_{uuid.uuid4().hex[:8]}",
            "currency": "PLN",
            "total_amount": round(product["unit_price"] * 0.9, 2),
            "discount_amount": round(product["unit_price"] * 0.1, 2),
            "payment_method": "blik",
        },
    )


PERSONA_BUILDERS = {
    "frustration": build_frustration_session,
    "decision_fatigue": build_decision_fatigue_session,
    "boredom": build_boredom_session,
    "satisfaction": build_satisfaction_session,
}


GROUND_TRUTH_COLUMNS = [
    "session_id",
    "persona",
    "start_time",
    "user_id",
    "anonymous_id",
    "device_type",
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
            device_name = "mobile" if rng.random() < 0.28 else "desktop"
            logged_in = rng.random() < 0.45
            session_id = f"sess_{session_index:04d}_{uuid.UUID(int=rng.getrandbits(128)).hex[:8]}"
            session_index += 1
            builder = SessionBuilder(
                persona=persona,
                session_id=session_id,
                anonymous_id=f"anon_{uuid.UUID(int=rng.getrandbits(128)).hex[:12]}",
                user_id=f"usr_{rng.randint(10000, 99999)}" if logged_in else None,
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
                    "user_id": builder.user_id,
                    "anonymous_id": builder.anonymous_id,
                    "device_type": builder.device["device_type"],
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
    parser = argparse.ArgumentParser(description="Generate raw ecommerce telemetry CSV")
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
