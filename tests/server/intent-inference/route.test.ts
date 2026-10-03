import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/emotions-timeline/route";
import { SHOPPING_INTENT_KINDS } from "@/domain/shopping-intent";

vi.mock("@/server/intent-inference/read-service", () => ({
  getIntentTimeline: vi.fn(),
}));

import { getIntentTimeline } from "@/server/intent-inference/read-service";

const mockedGetIntentTimeline = vi.mocked(getIntentTimeline);

beforeEach(() => {
  mockedGetIntentTimeline.mockReset();
});

describe("GET /api/emotions-timeline with sessionId", () => {
  it("returns the database timeline for a valid session", async () => {
    mockedGetIntentTimeline.mockResolvedValue(
      {
        schemaVersion: "2.0",
        source: "empty",
        windowSeconds: 30,
        currentSecond: 30,
        windowStartSecond: 0,
        windowEndSecond: 30,
        generatedAt: "2026-10-03T12:00:00.000Z",
        series: SHOPPING_INTENT_KINDS.map((id) => ({
          id,
          label: id,
          polarity: "neutral" as const,
          color: "#000000",
          points: [],
        })),
        annotations: [],
      },
    );
    const request = new NextRequest(
      "http://localhost/api/emotions-timeline?sessionId=session-000001",
    );

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(json.schemaVersion).toBe("2.0");
    expect(json.source).toBe("empty");
    expect(json.series).toHaveLength(8);
    expect(mockedGetIntentTimeline).toHaveBeenCalledWith("session-000001");
  });

  it("rejects a malformed session id", async () => {
    const request = new NextRequest(
      "http://localhost/api/emotions-timeline?sessionId=x",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(mockedGetIntentTimeline).not.toHaveBeenCalled();
  });
});
