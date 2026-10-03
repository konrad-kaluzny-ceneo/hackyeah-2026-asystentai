"use client";

import { useEffect, useState } from "react";

import {
  EMOTION_VISIBILITY_THRESHOLD,
  EMOTION_WINDOW_SECONDS,
  buildStackedEmotionSeries,
  type StackedEmotionPoint,
  type EmotionSeries,
  type EmotionTimelineResponse,
} from "./emotion-timeline";

const CHART_WIDTH = 900;
const CHART_HEIGHT = 240;
const PLOT_TOP = 28;
const PLOT_BOTTOM = 204;
const POLL_INTERVAL_MS = 1_000;

export function chartX(
  second: number,
  windowStartSecond: number,
): number {
  return ((second - windowStartSecond) / EMOTION_WINDOW_SECONDS) * CHART_WIDTH;
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
  const [timeline, setTimeline] = useState<EmotionTimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadTimeline = async () => {
      try {
        const response = await fetch("/api/emotions-timeline", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const nextTimeline = (await response.json()) as EmotionTimelineResponse;
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
      <div className="flex h-[200px] min-h-[200px] items-center justify-center rounded border border-dashed border-zinc-300 bg-white/70 text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/40">
        {error === null ? "ładowanie danych mock..." : `błąd timeline: ${error}`}
      </div>
    );
  }

  const visibleDuration = timeline.windowEndSecond - timeline.windowStartSecond;
  const midpointSecond = timeline.windowStartSecond + visibleDuration / 2;
  const stackedSeries = buildStackedEmotionSeries(timeline.series);
  const stackedMax = Math.max(
    1,
    ...stackedSeries.flatMap(({ points }) => points.map(({ upper }) => upper)),
  );

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto rounded border border-dashed border-zinc-300 bg-white/70 dark:border-zinc-600 dark:bg-zinc-900/40">
        <svg
          aria-label="Mockowa oś czasu emocji użytkownika"
          className="h-[200px] min-w-[720px] w-full"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
        >
          <rect x="0" y={PLOT_TOP} width={CHART_WIDTH} height={PLOT_BOTTOM - PLOT_TOP} fill="transparent" />
          {[0, stackedMax / 2, stackedMax].map((value) => (
            <line
              key={value}
              x1="0"
              x2={CHART_WIDTH}
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
          {stackedSeries.map((emotion) => (
            <path
              key={emotion.id}
              d={buildAreaPath(emotion.points, timeline.windowStartSecond, stackedMax)}
              fill={emotion.color}
              fillOpacity="0.55"
              stroke={emotion.color}
              strokeWidth="1"
              strokeLinejoin="round"
            >
              <title>{emotion.label}</title>
            </path>
          ))}
          {timeline.annotations.map((annotation, index) => {
            const emotion = timeline.series.find(
              (candidate) => candidate.id === annotation.emotionId,
            );
            if (emotion === undefined) return null;
            const x = chartX(annotation.second, timeline.windowStartSecond);
            const textAnchor = x < 70 ? "start" : x > CHART_WIDTH - 70 ? "end" : "middle";
            const textX = textAnchor === "start" ? x + 5 : textAnchor === "end" ? x - 5 : x;
            return (
              <g key={`${annotation.emotionId}-${annotation.second}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke={emotion.color}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <circle cx={x} cy={chartY(stackedMax / 2, stackedMax)} r="3" fill={emotion.color}>
                  <title>{annotation.comment}</title>
                </circle>
                <text
                  x={textX}
                  y={index % 3 * 14 + 11}
                  textAnchor={textAnchor}
                  fontSize="10"
                  fill={emotion.color}
                >
                  {shortenComment(annotation.comment)}
                </text>
              </g>
            );
          })}
          <text x="0" y="228" fontSize="10" className="fill-zinc-500">
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
                x={chartX(timeline.windowEndSecond, timeline.windowStartSecond)}
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
      <div className="mt-2 max-h-14 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {timeline.series.map((emotion) => (
            <LegendItem key={emotion.id} emotion={emotion} />
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">
        mock · stacked area · okno {timeline.windowStartSecond}–{timeline.windowEndSecond}s · odświeżanie co 1 s · wartości poniżej {EMOTION_VISIBILITY_THRESHOLD * 100}% pominięte
      </p>
    </div>
  );
}

function LegendItem({ emotion }: { emotion: EmotionSeries }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[10px] text-zinc-500" title={emotion.label}>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: emotion.color }} />
      <span className="truncate">{emotion.label}</span>
    </span>
  );
}

function formatAxisSecond(second: number): string {
  return `${Number.isInteger(second) ? second : second.toFixed(1)}s`;
}

function buildAreaPath(
  points: readonly StackedEmotionPoint[],
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