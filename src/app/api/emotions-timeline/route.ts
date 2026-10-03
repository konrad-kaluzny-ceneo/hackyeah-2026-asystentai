import { NextRequest, NextResponse } from "next/server";

import { buildMockEmotionTimeline } from "@/behavior/ui/emotion-timeline";
import { getIntentTimeline } from "@/server/intent-inference/read-service";

const MOCK_STARTED_AT = Date.now();

export function GET(): Response;
export function GET(request: NextRequest): Promise<Response>;
export function GET(request?: NextRequest): Response | Promise<Response> {
  if (request === undefined) {
    return mockResponse();
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (sessionId === null) {
    return mockResponse();
  }
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json(
      { error: "invalid_session_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return getIntentTimeline(sessionId)
    .then((timeline) =>
      NextResponse.json(timeline, {
        headers: { "Cache-Control": "no-store" },
      }),
    )
    .catch((error: unknown) => {
      console.error("Failed to read intent timeline", error);
      return NextResponse.json(
        { error: "intent_timeline_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    });
}

function mockResponse(): Response {
  return NextResponse.json(buildMockEmotionTimeline(Date.now(), MOCK_STARTED_AT), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isValidSessionId(value: string): boolean {
  return value.length >= 8 && value.length <= 64;
}