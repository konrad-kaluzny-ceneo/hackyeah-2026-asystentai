/**
 * Jev (Typesafe) API client for assistant proposal classification.
 */

export const DEFAULT_TYPESAFE_URL = "https://api.typesafe.ai/v1/chat/completions";

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  // Strip ```json ... ``` markdown block if wrapped
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  if (match) {
    return match[1].trim();
  }
  return trimmed;
}

export async function requestJev(
  prompt: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TYPESAFE_API_KEY environment variable");
  }

  const apiUrl =
    process.env.TYPESAFE_API_URL ||
    process.env.TYPESAFE_BASE_URL ||
    DEFAULT_TYPESAFE_URL;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Typesafe API returned HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (typeof data === "object" && data !== null) {
    const candidate = data as {
      choices?: Array<{ message?: { content?: unknown } }>;
      proposal?: unknown;
      situation?: unknown;
    };

    // If API returned OpenAI-style choices:
    if (candidate.choices && candidate.choices.length > 0) {
      const content = candidate.choices[0]?.message?.content;
      if (typeof content === "string") {
        return JSON.parse(extractJsonText(content));
      }
      if (typeof content === "object" && content !== null) {
        return content;
      }
    }

    // Direct JSON output:
    if ("situation" in candidate || "proposal" in candidate) {
      return data;
    }
  }

  throw new Error("Invalid response format from Jev API");
}
