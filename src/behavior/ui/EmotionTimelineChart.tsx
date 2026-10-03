"use client";

import { useEffect, useState } from "react";
import { useSyncExternalStore } from "react";

import {
  INTENT_TIMELINE_WINDOW_SECONDS,
  buildStackedIntentSeries,
  type StackedIntentPoint,
  type IntentSeries,
  type IntentTimelineResponse,
} from "@/lib/intent-timeline";
import { getSessionId } from "../collector/session";
import { getDebugState, subscribeDebug } from "./debug-store";

const CHART_WIDTH = 900;
const CHART_HEIGHT = 240;
const PLOT_LEFT = 56;
const PLOT_RIGHT = CHART_WIDTH - 10;
const PLOT_TOP = 28;
const PLOT_BOTTOM = 204;
const POLL_INTERVAL_MS = 1_000;
const SERVER_DEBUG_SNAPSHOT = getDebugState();

export function chartX(
  second: number,
  windowStartSecond: number,
): number {
  return (
    PLOT_LEFT +
    ((second - windowStartSecond) / INTENT_TIMELINE_WINDOW_SECONDS) *
      (PLOT_RIGHT - PLOT_LEFT)
  );
}

export function chartY(value: number, scaleMax = 1): number {
  const bounded = Math.max(0, Math.min(scaleMax, value));
  return PLOT_BOTTOM - (bounded / scaleMax) * (PLOT_BOTTOM - PLOT_TOP);
}

export function shortenComment(comment: string, maxLength = 34): string {
  if (comment.length <= maxLength) return comment;
  return `${comment.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

export function EmotionTimelineChart() {
  const [timeline, setTimeline] = useState<IntentTimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debugState = useSyncExternalStore(
    subscribeDebug,
    getDebugState,
    () => SERVER_DEBUG_SNAPSHOT,
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadTimeline = async () => {
      try {
        const response = await fetch(
          `/api/emotions-timeline?sessionId=${encodeURIComponent(getSessionId())}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const nextTimeline = (await response.json()) as IntentTimelineResponse;
        if (active) {
          setTimeline(nextTimeline);
          setError(null);
        }
      } catch (nextError) {
        if (active && !(nextError instanceof DOMException && nextError.name === "AbortError")) {
          setError(nextError instanceof Error ? nextError.message : "unknown error");
        }
      }
    };

    void loadTimeline();
    const intervalId = window.setInterval(() => void loadTimeline(), POLL_INTERVAL_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  if (timeline === null) {
    return (
      <div className="flex h-full min-h-[180px] w-full items-center justify-center rounded border border-dashed border-zinc-300 bg-white/70 text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40">
        {error === null ? "ładowanie intencji..." : `błąd timeline: ${error}`}
      </div>
    );
  }

  const visibleDuration = timeline.windowEndSecond - timeline.windowStartSecond;
  const midpointSecond = timeline.windowStartSecond + visibleDuration / 2;
  const stackedSeries = buildStackedIntentSeries(timeline.series);
  const stackedMax = Math.max(
    1,
    ...stackedSeries.flatMap(({ points }) => points.map(({ upper }) => upper)),
  );

  return (
    <div className="flex min-h-[180px] min-w-0 flex-1 items-stretch gap-3">
      <div className="w-32 shrink-0 overflow-hidden pt-1">
        <div className="flex flex-col gap-1">
          {timeline.series.map((intent) => (
            <LegendItem key={intent.id} intent={intent} />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-dashed border-zinc-300 bg-white/70 dark:border-zinc-600 dark:bg-zinc-900/40">
          <svg
            aria-label="Oś czasu intencji zakupowych użytkownika"
            className="block h-full min-h-[180px] min-w-0 w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
          >
          <rect x="0" y={PLOT_TOP} width={CHART_WIDTH} height={PLOT_BOTTOM - PLOT_TOP} fill="transparent" />
          {[0, stackedMax / 2, stackedMax].map((value) => (
            <line
              key={value}
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={chartY(value, stackedMax)}
              y2={chartY(value, stackedMax)}
              stroke="currentColor"
              strokeDasharray="4 8"
              className="text-zinc-200 dark:text-zinc-700"
            />
          ))}
          <line
            x1={chartX(timeline.currentSecond, timeline.windowStartSecond)}
            x2={chartX(timeline.currentSecond, timeline.windowStartSecond)}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke="currentColor"
            strokeDasharray="2 4"
            strokeWidth="2"
            className="text-zinc-700 dark:text-zinc-200"
          />
          <text
            x={Math.min(
              chartX(timeline.currentSecond, timeline.windowStartSecond) + 5,
              CHART_WIDTH - 42,
            )}
            y="18"
            fontSize="11"
            className="fill-zinc-600 dark:fill-zinc-300"
          >
            teraz {timeline.currentSecond}s
          </text>
          {debugState.assistantProposalRequests.map((request, index) => {
            const second = requestSecond(request.requestedAt, timeline);
            if (second === null) return null;
            const x = chartX(second, timeline.windowStartSecond);
            const textAnchor = x > CHART_WIDTH - 65 ? "end" : "start";
            const textX = textAnchor === "end" ? x - 4 : x + 4;
            return (
              <g key={`${request.requestedAt}-${index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke="#f59e0b"
                  strokeDasharray="2 3"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <circle cx={x} cy={PLOT_TOP + 8} r="3" fill="#f59e0b">
                  <title>Request do OpenAI o {formatRequestTime(request.requestedAt)}</title>
                </circle>
                <text
                  x={textX}
                  y={index % 2 === 0 ? 11 : 23}
                  textAnchor={textAnchor}
                  fontSize="10"
                  className="fill-amber-600 dark:fill-amber-400"
                >
                  OpenAI
                </text>
              </g>
            );
          })}
          {stackedSeries.map((intent) => (
            <path
              key={intent.id}
              d={buildAreaPath(intent.points, timeline.windowStartSecond, stackedMax)}
              fill={intent.color}
              fillOpacity="0.55"
              stroke={intent.color}
              strokeWidth="1"
              strokeLinejoin="round"
            >
              <title>{intent.label}</title>
            </path>
          ))}
          {timeline.annotations.map((annotation, index) => {
            const intent = timeline.series.find(
              (candidate) => candidate.id === annotation.intentId,
            );
            if (intent === undefined) return null;
            const x = chartX(annotation.second, timeline.windowStartSecond);
            const textAnchor = x < 70 ? "start" : x > CHART_WIDTH - 70 ? "end" : "middle";
            const textX = textAnchor === "start" ? x + 5 : textAnchor === "end" ? x - 5 : x;
            return (
              <g key={`${annotation.intentId}-${annotation.second}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke={intent.color}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <circle cx={x} cy={chartY(stackedMax / 2, stackedMax)} r="3" fill={intent.color}>
                  <title>{annotation.comment}</title>
                </circle>
                <text
                  x={textX}
                  y={index % 3 * 14 + 11}
                  textAnchor={textAnchor}
                  fontSize="10"
                  fill={intent.color}
                >
                  {shortenComment(annotation.comment)}
                </text>
              </g>
            );
          })}
          <text x={PLOT_LEFT} y="228" fontSize="10" className="fill-zinc-500">
            {formatAxisSecond(timeline.windowStartSecond)}
          </text>
          {visibleDuration > 0 && (
            <>
              <text
                x={chartX(midpointSecond, timeline.windowStartSecond)}
                y="228"
                textAnchor="middle"
                fontSize="10"
                className="fill-zinc-500"
              >
                {formatAxisSecond(midpointSecond)}
              </text>
              <text
                x={PLOT_RIGHT}
                y="228"
                textAnchor="end"
                fontSize="10"
                className="fill-zinc-500"
              >
                {formatAxisSecond(timeline.windowEndSecond)}
              </text>
            </>
          )}
          </svg>
        </div>
        <p className="mt-1 text-[10px] text-zinc-400">
          {timeline.source} · stacked area · okno {timeline.windowStartSecond}–{timeline.windowEndSecond}s · odświeżanie co 1 s · prawdopodobieństwa JEV 0–100%
        </p>
      </div>
    </div>
  );
}

function LegendItem({ intent }: { intent: IntentSeries }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[10px] text-zinc-500" title={intent.label}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: intent.color }} />
      <span className="truncate">{intent.label}</span>
    </span>
  );
}

function formatAxisSecond(second: number): string {
  return `${Number.isInteger(second) ? second : second.toFixed(1)}s`;
}

function buildAreaPath(
  points: readonly StackedIntentPoint[],
  windowStartSecond: number,
  scaleMax: number,
): string {
  if (points.length === 0) return "";

  const upperPath = points
    .map(
      (point) =>
        `${chartX(point.second, windowStartSecond)},${chartY(point.upper, scaleMax)}`,
    )
    .join(" L ");
  const lowerPath = [...points]
    .reverse()
    .map(
      (point) =>
        `${chartX(point.second, windowStartSecond)},${chartY(point.lower, scaleMax)}`,
    )
    .join(" L ");

  return `M ${upperPath} L ${lowerPath} Z`;
}

function requestSecond(
  requestedAt: string,
  timeline: IntentTimelineResponse,
): number | null {
  const requestedMs = Date.parse(requestedAt);
  const generatedMs = Date.parse(timeline.generatedAt);
  if (Number.isNaN(requestedMs) || Number.isNaN(generatedMs)) return null;

  const second =
    timeline.currentSecond - (generatedMs - requestedMs) / 1_000;
  if (second < timeline.windowStartSecond || second > timeline.windowEndSecond) {
    return null;
  }
  return second;
}

function formatRequestTime(requestedAt: string): string {
  const timestamp = Date.parse(requestedAt);
  if (Number.isNaN(timestamp)) return requestedAt;
  return new Date(timestamp).toLocaleTimeString("pl-PL", { hour12: false });
}