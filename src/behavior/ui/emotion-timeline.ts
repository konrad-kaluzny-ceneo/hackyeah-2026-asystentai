export const EMOTION_WINDOW_SECONDS = 30;
export const EMOTION_VISIBILITY_THRESHOLD = 0.4;

export type EmotionPolarity = "negative" | "positive" | "neutral";

export type EmotionDefinition = Readonly<{
  id: string;
  label: string;
  polarity: EmotionPolarity;
  color: string;
}>;

export type EmotionPoint = Readonly<{
  second: number;
  value: number;
}>;

export type EmotionSeries = EmotionDefinition &
  Readonly<{
    points: readonly EmotionPoint[];
  }>;

export type StackedEmotionPoint = Readonly<{
  second: number;
  lower: number;
  upper: number;
}>;

export type StackedEmotionSeries = EmotionDefinition &
  Readonly<{
    points: readonly StackedEmotionPoint[];
  }>;

export type EmotionAnnotation = Readonly<{
  second: number;
  emotionId: string;
  comment: string;
}>;

export type EmotionTimelineResponse = Readonly<{
  schemaVersion: "1.0";
  windowSeconds: typeof EMOTION_WINDOW_SECONDS;
  currentSecond: number;
  windowStartSecond: number;
  windowEndSecond: number;
  generatedAt: string;
  series: readonly EmotionSeries[];
  annotations: readonly EmotionAnnotation[];
}>;

export const EMOTION_DEFINITIONS: readonly EmotionDefinition[] = [
  { id: "frustrated-annoyed", label: "Frustrated / Annoyed", polarity: "negative", color: "#dc2626" },
  { id: "choice-overloaded", label: "Choice Overloaded / Decision Paralysis", polarity: "negative", color: "#ca8a04" },
  { id: "skeptical-distrustful", label: "Skeptical / Distrustful", polarity: "negative", color: "#7c3aed" },
  { id: "determined-high-intent", label: "Determined / High Intent", polarity: "positive", color: "#16a34a" },
  { id: "reassured-confident", label: "Reassured / Confident", polarity: "positive", color: "#0891b2" },
  { id: "relaxed-casual-browsing", label: "Relaxed / Casual Browsing", polarity: "positive", color: "#65a30d" },
  { id: "analytical-focused", label: "Analytical / Focused", polarity: "neutral", color: "#2563eb" },
  { id: "exploratory-browsing", label: "Exploratory / Browsing", polarity: "neutral", color: "#4f46e5" },
  { id: "undecided-comparing", label: "Undecided / Comparing", polarity: "neutral", color: "#475569" },
] as const;

const MOCK_ANNOTATIONS: readonly EmotionAnnotation[] = [
  { second: 4, emotionId: "exploratory-browsing", comment: "Użytkownik zaczyna porównywać dostępne kategorie." },
  { second: 9, emotionId: "choice-overloaded", comment: "Wiele podobnych opcji zwiększa obciążenie decyzją." },
  { second: 14, emotionId: "frustrated-annoyed", comment: "Wykryto serię nieskutecznych interakcji." },
  { second: 21, emotionId: "skeptical-distrustful", comment: "Użytkownik wraca do parametrów i sprawdza szczegóły." },
  { second: 27, emotionId: "determined-high-intent", comment: "Zachowanie wskazuje na zawężanie wyboru." },
];

export function buildMockEmotionTimeline(
  now = Date.now(),
  startedAt = now,
): EmotionTimelineResponse {
  const currentSecond = Math.max(0, Math.floor((now - startedAt) / 1000));
  const windowStartSecond = Math.max(
    0,
    currentSecond - EMOTION_WINDOW_SECONDS,
  );
  const windowEndSecond = currentSecond;
  return {
    schemaVersion: "1.0",
    windowSeconds: EMOTION_WINDOW_SECONDS,
    currentSecond,
    windowStartSecond,
    windowEndSecond,
    generatedAt: new Date(now).toISOString(),
    series: EMOTION_DEFINITIONS.map((emotion, emotionIndex) => ({
      ...emotion,
      points: Array.from(
        { length: windowEndSecond - windowStartSecond + 1 },
        (_, index) => {
          const second = windowStartSecond + index;
          return { second, value: mockValue(second, emotionIndex) };
        },
      ),
    })),
    annotations: MOCK_ANNOTATIONS.filter(
      ({ second }) =>
        second >= windowStartSecond && second <= windowEndSecond,
    ),
  };
}

export function buildStackedEmotionSeries(
  series: readonly EmotionSeries[],
): readonly StackedEmotionSeries[] {
  const totalsBySecond = new Map<number, number>();

  return series.map((emotion) => ({
    ...emotion,
    points: emotion.points.map((point) => {
      const lower = totalsBySecond.get(point.second) ?? 0;
      const value = point.value >= EMOTION_VISIBILITY_THRESHOLD ? point.value : 0;
      const upper = lower + value;
      totalsBySecond.set(point.second, upper);
      return { second: point.second, lower, upper };
    }),
  }));
}

function mockValue(second: number, emotionIndex: number): number {
  const scores = EMOTION_DEFINITIONS.map((_, index) => emotionScore(second, index));
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const activeCount = 2 + Math.round((Math.sin(second * 0.035 + 0.4) + 1) * 1.5);
  const rank = ranked.findIndex(({ index }) => index === emotionIndex);

  if (rank >= activeCount) {
    return Number((0.08 + scores[emotionIndex] * 0.18).toFixed(3));
  }

  const cutoff = ranked[activeCount - 1].score;
  const strongest = ranked[0].score;
  const relativeStrength = (scores[emotionIndex] - cutoff) / Math.max(strongest - cutoff, 0.001);
  return Number((0.42 + relativeStrength * 0.42).toFixed(3));
}

function emotionScore(second: number, emotionIndex: number): number {
  const slowCycle = (Math.sin(second * 0.12 + emotionIndex * 1.1) + 1) / 2;
  const slowerDrift = (Math.sin(second * 0.045 + emotionIndex * 0.7 + 1.2) + 1) / 2;
  return slowCycle * 0.65 + slowerDrift * 0.35;
}