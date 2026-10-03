import { NextResponse } from "next/server";

import { buildMockEmotionTimeline } from "@/behavior/ui/emotion-timeline";

const MOCK_STARTED_AT = Date.now();

export function GET(): Response {
  return NextResponse.json(buildMockEmotionTimeline(Date.now(), MOCK_STARTED_AT), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}