"""Turn raw telemetry events into validated MetaEvents adhering to the meta_events contract.

Implements the 6 core behavior detectors in Python mirroring src/behavior/detectors:
- rage_click
- dead_click_cluster
- rapid_filter_churn
- no_progress_window
- product_revisit
- comparison_oscillation
"""

from __future__ import annotations

import argparse
import json
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "raw_ecommerce_events.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "preprocessed_ecommerce_events.csv"

SCHEMA_VERSION = "1.0"
ALGORITHM_VERSION = "1.0"

PREPROCESSED_COLUMNS = [
    "event_id",
    "batch_id",
    "schema_version",
    "event_name",
    "detected_at",
    "server_received_at",
    "window_started_at",
    "window_ended_at",
    "window_duration_ms",
    "session_id",
    "page_view_id",
    "journey_id",
    "page_type",
    "previous_page_type",
    "route_template",
    "subject_type",
    "subject_id",
    "category_id",
    "brand_id",
    "ecommerce_context",
    "metrics",
    "strength",
    "evidence_count",
    "algorithm_version",
    "partial_data",
    "consent_version",
    "created_at",
]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _bucket_count(count: int | float | None) -> str | None:
    if count is None or pd.isna(count):
        return None
    val = int(count)
    if val == 0:
        return "0"
    if val <= 5:
        return "1-5"
    if val <= 20:
        return "6-20"
    return "21+"


def _route_template(page_type: str, product_id: str | None = None) -> str:
    if page_type == "product":
        return "/produkt/[id]"
    if page_type == "category":
        return "/katalog/[category]"
    if page_type == "search":
        return "/szukaj"
    if page_type == "catalog":
        return "/katalog"
    if page_type == "home":
        return "/"
    return f"/{page_type}"


class SessionAnalyzer:
    """Analyzes a chronological series of RawEvents for a single session."""

    def __init__(self, session_id: str, events: list[dict[str, Any]]) -> None:
        self.session_id = session_id
        self.events = sorted(events, key=lambda e: e["timestamp_dt"])
        self.meta_events: list[dict[str, Any]] = []
        self.last_detection_time: dict[str, datetime] = {}
        self.cooldown = timedelta(seconds=20)

    def _can_emit(self, event_name: str, at: datetime) -> bool:
        last = self.last_detection_time.get(event_name)
        if last is None or (at - last) >= self.cooldown:
            self.last_detection_time[event_name] = at
            return True
        return False

    def build_ecommerce_context(self, event: dict[str, Any], active_filters: dict[str, list[str]]) -> dict[str, Any]:
        filters_list = [{"id": fid, "valueIds": vals} for fid, vals in active_filters.items() if vals]
        return {
            "activeFilters": filters_list,
            "activeFiltersCount": len(filters_list),
            "sortingType": "popular",
            "resultsCountBucket": _bucket_count(event.get("search_results_count")),
            "priceVisible": True,
            "deliveryVisible": True,
            "availabilityVisible": True,
        }

    def detect_rage_clicks(self) -> None:
        """Min 3 clicks on same elementId in 2.5s window without UI reaction in 800ms."""
        clicks = [e for e in self.events if e.get("event_name") == "element_click" and e.get("element_id")]
        window_ms = 2500
        grace_ms = 800

        by_element: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for c in clicks:
            by_element[c["element_id"]].append(c)

        for element_id, el_clicks in by_element.items():
            if len(el_clicks) < 3:
                continue

            for i in range(len(el_clicks) - 2):
                c_first = el_clicks[i]
                sub_clicks = [c for c in el_clicks[i:] if (c["timestamp_dt"] - c_first["timestamp_dt"]).total_seconds() * 1000 <= window_ms]
                if len(sub_clicks) >= 3:
                    detected_at = sub_clicks[-1]["timestamp_dt"]
                    if not self._can_emit("rage_click", detected_at):
                        continue

                    # Check for UI change after first click
                    grace_end = c_first["timestamp_dt"] + timedelta(milliseconds=grace_ms)
                    has_ui_change = any(
                        e["event_name"] in {"ui_state_changed", "page_enter", "url_changed"}
                        and c_first["timestamp_dt"] < e["timestamp_dt"] <= grace_end
                        for e in self.events
                    )
                    if has_ui_change:
                        continue

                    duration_ms = int((detected_at - c_first["timestamp_dt"]).total_seconds() * 1000)
                    trigger_event = sub_clicks[-1]
                    strength = min(1.0, round(len(sub_clicks) / 6.0, 2))

                    self.meta_events.append({
                        "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                        "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                        "schema_version": SCHEMA_VERSION,
                        "event_name": "rage_click",
                        "detected_at": _iso(detected_at),
                        "server_received_at": _iso(detected_at + timedelta(milliseconds=45)),
                        "window_started_at": _iso(c_first["timestamp_dt"]),
                        "window_ended_at": _iso(detected_at),
                        "window_duration_ms": max(duration_ms, 50),
                        "session_id": self.session_id,
                        "page_view_id": trigger_event["page_view_id"],
                        "journey_id": None,
                        "page_type": trigger_event["page_type"],
                        "previous_page_type": None,
                        "route_template": _route_template(trigger_event["page_type"]),
                        "subject_type": "form" if "filter" in element_id else "product",
                        "subject_id": trigger_event.get("product_id"),
                        "category_id": trigger_event.get("product_category"),
                        "brand_id": trigger_event.get("product_brand"),
                        "ecommerce_context": self.build_ecommerce_context(trigger_event, {}),
                        "metrics": {
                            "clickCount": len(sub_clicks),
                            "windowMs": duration_ms,
                            "elementId": str(element_id),
                        },
                        "strength": max(0.5, strength),
                        "evidence_count": len(sub_clicks),
                        "algorithm_version": ALGORITHM_VERSION,
                        "partial_data": False,
                        "consent_version": None,
                        "created_at": _iso(detected_at),
                    })
                    break

    def detect_dead_click_clusters(self) -> None:
        """Min 2 clicks on same elementId in 2.0s window followed by 1.5s silence."""
        clicks = [e for e in self.events if e.get("event_name") == "element_click" and e.get("element_id")]
        window_ms = 2000
        silence_ms = 1500

        by_element: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for c in clicks:
            by_element[c["element_id"]].append(c)

        for element_id, el_clicks in by_element.items():
            if len(el_clicks) < 2:
                continue

            for i in range(len(el_clicks) - 1):
                c_first = el_clicks[i]
                c_last = el_clicks[i + 1]
                delta_ms = (c_last["timestamp_dt"] - c_first["timestamp_dt"]).total_seconds() * 1000
                if delta_ms <= window_ms:
                    silence_end = c_last["timestamp_dt"] + timedelta(milliseconds=silence_ms)
                    # Check for effect events during silence window
                    had_effect = any(
                        e["event_name"] in {"ui_state_changed", "page_enter", "url_changed"}
                        and c_last["timestamp_dt"] < e["timestamp_dt"] <= silence_end
                        for e in self.events
                    )
                    if had_effect:
                        continue

                    detected_at = silence_end
                    if not self._can_emit("dead_click_cluster", detected_at):
                        continue

                    duration_ms = int(delta_ms + silence_ms)
                    trigger_event = c_last

                    self.meta_events.append({
                        "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                        "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                        "schema_version": SCHEMA_VERSION,
                        "event_name": "dead_click_cluster",
                        "detected_at": _iso(detected_at),
                        "server_received_at": _iso(detected_at + timedelta(milliseconds=45)),
                        "window_started_at": _iso(c_first["timestamp_dt"]),
                        "window_ended_at": _iso(detected_at),
                        "window_duration_ms": duration_ms,
                        "session_id": self.session_id,
                        "page_view_id": trigger_event["page_view_id"],
                        "journey_id": None,
                        "page_type": trigger_event["page_type"],
                        "previous_page_type": None,
                        "route_template": _route_template(trigger_event["page_type"]),
                        "subject_type": "offer",
                        "subject_id": None,
                        "category_id": trigger_event.get("product_category"),
                        "brand_id": None,
                        "ecommerce_context": self.build_ecommerce_context(trigger_event, {}),
                        "metrics": {
                            "clickCount": 2,
                            "windowMs": duration_ms,
                            "elementId": str(element_id),
                        },
                        "strength": 0.75,
                        "evidence_count": 2,
                        "algorithm_version": ALGORITHM_VERSION,
                        "partial_data": False,
                        "consent_version": None,
                        "created_at": _iso(detected_at),
                    })
                    break

    def detect_rapid_filter_churn(self) -> None:
        """Min 6 filter changes in 30s window with >= 2 undone filters and no progress."""
        filter_events = [e for e in self.events if e.get("event_name") in {"filter_added", "filter_removed"}]
        if len(filter_events) < 6:
            return

        window_ms = 30000
        for i in range(len(filter_events) - 5):
            first = filter_events[i]
            in_window = [e for e in filter_events[i:] if (e["timestamp_dt"] - first["timestamp_dt"]).total_seconds() * 1000 <= window_ms]
            if len(in_window) < 6:
                continue

            last = in_window[-1]
            detected_at = last["timestamp_dt"]

            # Count undos (filter added then removed or removed then added)
            added_by_filter: dict[str, int] = defaultdict(int)
            removed_by_filter: dict[str, int] = defaultdict(int)
            for fe in in_window:
                fid = fe.get("filter_id")
                if not fid:
                    continue
                if fe["event_name"] == "filter_added":
                    added_by_filter[fid] += 1
                else:
                    removed_by_filter[fid] += 1

            undone_count = sum(min(added_by_filter[fid], removed_by_filter[fid]) for fid in added_by_filter)
            if undone_count < 2:
                continue

            # Check no progress (no product_viewed / search_submitted inside the window)
            has_progress = any(
                e["event_name"] in {"product_viewed", "search_submitted"}
                and first["timestamp_dt"] <= e["timestamp_dt"] <= detected_at
                for e in self.events
            )
            if has_progress:
                continue

            if not self._can_emit("rapid_filter_churn", detected_at):
                continue

            duration_ms = int((detected_at - first["timestamp_dt"]).total_seconds() * 1000)
            strength = min(1.0, round((len(in_window) / 10.0) * 0.5 + (undone_count / 4.0) * 0.5, 2))

            self.meta_events.append({
                "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                "schema_version": SCHEMA_VERSION,
                "event_name": "rapid_filter_churn",
                "detected_at": _iso(detected_at),
                "server_received_at": _iso(detected_at + timedelta(milliseconds=50)),
                "window_started_at": _iso(first["timestamp_dt"]),
                "window_ended_at": _iso(detected_at),
                "window_duration_ms": duration_ms,
                "session_id": self.session_id,
                "page_view_id": last["page_view_id"],
                "journey_id": None,
                "page_type": last["page_type"],
                "previous_page_type": None,
                "route_template": _route_template(last["page_type"]),
                "subject_type": "category",
                "subject_id": None,
                "category_id": last.get("product_category") or "pralki",
                "brand_id": None,
                "ecommerce_context": self.build_ecommerce_context(last, {}),
                "metrics": {
                    "filterChanges": len(in_window),
                    "windowMs": duration_ms,
                    "undoneCount": undone_count,
                },
                "strength": max(0.6, strength),
                "evidence_count": len(in_window),
                "algorithm_version": ALGORITHM_VERSION,
                "partial_data": False,
                "consent_version": None,
                "created_at": _iso(detected_at),
            })
            break

    def detect_no_progress_window(self) -> None:
        """Active spanning >= 45s of 90s lookback without progress."""
        window_ms = 90000
        activity_names = {"element_click", "scroll_summary", "filter_added", "filter_removed", "page_enter"}

        for i, curr in enumerate(self.events):
            curr_ts = curr["timestamp_dt"]
            window_start = curr_ts - timedelta(milliseconds=window_ms)
            in_window = [e for e in self.events if window_start <= e["timestamp_dt"] <= curr_ts]

            # Zero progress events
            has_progress = any(e["event_name"] == "product_viewed" for e in in_window)
            if has_progress:
                continue

            activities = [e for e in in_window if e["event_name"] in activity_names]
            if len(activities) < 4:
                continue

            span_ms = (activities[-1]["timestamp_dt"] - activities[0]["timestamp_dt"]).total_seconds() * 1000
            if span_ms >= (window_ms * 0.5):
                if not self._can_emit("no_progress_window", curr_ts):
                    continue

                clicks = sum(1 for e in activities if e["event_name"] == "element_click")
                scrolls = sum(1 for e in activities if e["event_name"] == "scroll_summary")
                filters = sum(1 for e in activities if e["event_name"] in {"filter_added", "filter_removed"})
                strength = min(1.0, round(span_ms / window_ms, 2))

                self.meta_events.append({
                    "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                    "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                    "schema_version": SCHEMA_VERSION,
                    "event_name": "no_progress_window",
                    "detected_at": _iso(curr_ts),
                    "server_received_at": _iso(curr_ts + timedelta(milliseconds=50)),
                    "window_started_at": _iso(window_start),
                    "window_ended_at": _iso(curr_ts),
                    "window_duration_ms": window_ms,
                    "session_id": self.session_id,
                    "page_view_id": curr["page_view_id"],
                    "journey_id": None,
                    "page_type": curr["page_type"],
                    "previous_page_type": None,
                    "route_template": _route_template(curr["page_type"]),
                    "subject_type": "category",
                    "subject_id": None,
                    "category_id": curr.get("product_category"),
                    "brand_id": None,
                    "ecommerce_context": self.build_ecommerce_context(curr, {}),
                    "metrics": {
                        "activeMs": int(span_ms),
                        "clickCount": clicks,
                        "scrollCount": scrolls,
                        "filterChanges": filters,
                    },
                    "strength": max(0.5, strength),
                    "evidence_count": len(activities),
                    "algorithm_version": ALGORITHM_VERSION,
                    "partial_data": False,
                    "consent_version": None,
                    "created_at": _iso(curr_ts),
                })
                break

    def detect_product_revisit(self) -> None:
        """Same product viewed again with >= 1 distinct other product viewed between."""
        views = [e for e in self.events if e.get("event_name") == "product_viewed" and e.get("product_id")]
        if len(views) < 3:
            return

        for i in range(len(views)):
            for j in range(i + 1, len(views)):
                v1, v2 = views[i], views[j]
                if v1["product_id"] == v2["product_id"]:
                    pid = v1["product_id"]
                    intermediates = {v["product_id"] for v in views[i + 1:j] if v["product_id"] != pid}
                    if len(intermediates) >= 1:
                        detected_at = v2["timestamp_dt"]
                        if not self._can_emit("product_revisit", detected_at):
                            continue

                        duration_ms = int((detected_at - v1["timestamp_dt"]).total_seconds() * 1000)
                        strength = min(1.0, round(0.7 + len(intermediates) * 0.1, 2))

                        self.meta_events.append({
                            "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                            "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                            "schema_version": SCHEMA_VERSION,
                            "event_name": "product_revisit",
                            "detected_at": _iso(detected_at),
                            "server_received_at": _iso(detected_at + timedelta(milliseconds=45)),
                            "window_started_at": _iso(v1["timestamp_dt"]),
                            "window_ended_at": _iso(detected_at),
                            "window_duration_ms": duration_ms,
                            "session_id": self.session_id,
                            "page_view_id": v2["page_view_id"],
                            "journey_id": None,
                            "page_type": "product",
                            "previous_page_type": "catalog",
                            "route_template": "/produkt/[id]",
                            "subject_type": "product",
                            "subject_id": pid,
                            "category_id": v2.get("product_category"),
                            "brand_id": v2.get("product_brand"),
                            "ecommerce_context": self.build_ecommerce_context(v2, {}),
                            "metrics": {
                                "revisitCount": 2,
                                "distinctIntermediates": len(intermediates),
                                "productId": str(pid),
                            },
                            "strength": strength,
                            "evidence_count": j - i + 1,
                            "algorithm_version": ALGORITHM_VERSION,
                            "partial_data": False,
                            "consent_version": None,
                            "created_at": _iso(detected_at),
                        })
                        return

    def detect_comparison_oscillation(self) -> None:
        """Transitions between 2-4 products without narrowing candidate set."""
        views = [e for e in self.events if e.get("event_name") == "product_viewed" and e.get("product_id")]
        window_ms = 180000  # 3 min

        if len(views) < 5:
            return

        for i in range(len(views) - 4):
            first = views[i]
            in_window = [v for v in views[i:] if (v["timestamp_dt"] - first["timestamp_dt"]).total_seconds() * 1000 <= window_ms]
            # Deduplicate consecutive views of same product
            seq = []
            for v in in_window:
                pid = v["product_id"]
                if not seq or seq[-1] != pid:
                    seq.append(pid)

            transitions = len(seq) - 1
            candidates = set(seq)
            if transitions >= 4 and 2 <= len(candidates) <= 4:
                # Check set narrowing
                mid = len(seq) // 2
                first_half = set(seq[:mid])
                second_half = set(seq[mid:])
                if len(second_half) < len(first_half):
                    continue  # narrowed

                last = in_window[-1]
                detected_at = last["timestamp_dt"]
                if not self._can_emit("comparison_oscillation", detected_at):
                    continue

                duration_ms = int((detected_at - first["timestamp_dt"]).total_seconds() * 1000)
                strength = min(1.0, round(transitions / 8.0 + (len(candidates) - 1) / 6.0, 2))

                self.meta_events.append({
                    "event_id": f"meta_{uuid.uuid4().hex[:12]}",
                    "batch_id": f"batch_{uuid.uuid4().hex[:10]}",
                    "schema_version": SCHEMA_VERSION,
                    "event_name": "comparison_oscillation",
                    "detected_at": _iso(detected_at),
                    "server_received_at": _iso(detected_at + timedelta(milliseconds=45)),
                    "window_started_at": _iso(first["timestamp_dt"]),
                    "window_ended_at": _iso(detected_at),
                    "window_duration_ms": duration_ms,
                    "session_id": self.session_id,
                    "page_view_id": last["page_view_id"],
                    "journey_id": None,
                    "page_type": "product",
                    "previous_page_type": "catalog",
                    "route_template": "/produkt/[id]",
                    "subject_type": "product",
                    "subject_id": last.get("product_id"),
                    "category_id": last.get("product_category"),
                    "brand_id": last.get("product_brand"),
                    "ecommerce_context": self.build_ecommerce_context(last, {}),
                    "metrics": {
                        "candidateCount": len(candidates),
                        "transitionCount": transitions,
                    },
                    "strength": max(0.65, strength),
                    "evidence_count": len(in_window),
                    "algorithm_version": ALGORITHM_VERSION,
                    "partial_data": False,
                    "consent_version": None,
                    "created_at": _iso(detected_at),
                })
                break

    def run_all(self) -> list[dict[str, Any]]:
        self.detect_rage_clicks()
        self.detect_dead_click_clusters()
        self.detect_rapid_filter_churn()
        self.detect_no_progress_window()
        self.detect_product_revisit()
        self.detect_comparison_oscillation()
        return self.meta_events


def preprocess(raw: pd.DataFrame) -> pd.DataFrame:
    raw = raw.assign(timestamp_dt=pd.to_datetime(raw["client_timestamp"], utc=True))

    all_meta_events: list[dict[str, Any]] = []

    for session_id, group in raw.groupby("session_id", sort=False):
        events = group.to_dict("records")
        analyzer = SessionAnalyzer(str(session_id), events)
        session_meta = analyzer.run_all()
        all_meta_events.extend(session_meta)

    if not all_meta_events:
        return pd.DataFrame(columns=PREPROCESSED_COLUMNS)

    df_out = pd.DataFrame(all_meta_events).copy()
    # Serialize JSON fields
    df_out = df_out.assign(
        ecommerce_context=[json.dumps(v, ensure_ascii=False) for v in df_out["ecommerce_context"]],
        metrics=[json.dumps(v, ensure_ascii=False) for v in df_out["metrics"]],
    )
    return df_out[PREPROCESSED_COLUMNS]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preprocess raw telemetry into MetaEvents")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw = pd.read_csv(args.input)
    meta = preprocess(raw)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    meta.to_csv(args.output, index=False)
    print(f"Wrote {len(meta)} meta events to {args.output}")
    print(f"Sessions represented: {meta['session_id'].nunique()}")
    print("Meta events by name:")
    print(meta["event_name"].value_counts().to_string())


if __name__ == "__main__":
    main()
