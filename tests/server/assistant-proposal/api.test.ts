import { describe, expect, it } from "vitest";

import {
  AssistantProposalRequestSchema,
  AssistantProposalResponseSchema,
  parseAssistantProposalResponse,
} from "@/lib/assistant-proposal-api";
import { requestBody } from "./fixtures";

describe("assistant proposal HTTP contract", () => {
  it("accepts the catalog session request shape", () => {
    expect(AssistantProposalRequestSchema.safeParse(requestBody).success).toBe(true);
  });

  it("rejects raw behavior meta events and unknown request fields", () => {
    expect(
      AssistantProposalRequestSchema.safeParse({
        ...requestBody,
        events: [{ type: "rage_click", name: "rage_click" }],
      }).success,
    ).toBe(false);
    expect(
      AssistantProposalRequestSchema.safeParse({ ...requestBody, sessionId: "not-allowed" }).success,
    ).toBe(false);
  });

  it("parses both response variants and trims visible copy", () => {
    const show = parseAssistantProposalResponse({
      status: "show",
      kind: "decision_fatigue",
      title: "  Pomóc zawęzić wybór? ",
      message: "  Zawęź wybór według pojemności. ",
      action: "narrow-choice",
      actionLabel: " Przejdź do filtrów ",
    });
    expect(show).toMatchObject({ status: "show", title: "Pomóc zawęzić wybór?", message: "Zawęź wybór według pojemności." });
    expect(AssistantProposalResponseSchema.parse({ status: "hide" })).toEqual({ status: "hide" });
  });

  it("rejects empty visible copy and unexpected response fields", () => {
    expect(
      AssistantProposalResponseSchema.safeParse({
        status: "show",
        kind: "decision_fatigue",
        title: "Title",
        message: "   ",
        action: "narrow-choice",
        actionLabel: "Filters",
      }).success,
    ).toBe(false);
    expect(AssistantProposalResponseSchema.safeParse({ status: "hide", message: "debug" }).success).toBe(false);
  });
});
