import type { CrmWinbackOutcome } from "@/types/crm-winback";

/**
 * Win-back visual language — shade-card semantic mapping.
 * CSS tokens live on `.crm-winback` as `--wb-{family}-{50…900}`.
 * Primary base: #009BFF (`primary-500`). CTAs use `primary-600` for WCAG contrast with white text.
 */
export type WbSemantic = "primary" | "neutral" | "success" | "warning" | "error";

/** Map outcomes onto semantic families (not arbitrary hex). */
export function outcomeSemantic(outcome: CrmWinbackOutcome | "all"): WbSemantic {
  if (outcome === "all" || outcome === "none") return "primary";
  if (outcome === "interested") return "success";
  if (outcome === "callback" || outcome === "wrong_number") return "warning";
  if (outcome === "do_not_contact") return "error";
  return "neutral";
}

export function campaignSemantic(status: string): WbSemantic {
  if (status === "done" || status === "sent") return "success";
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "paused") return "warning";
  if (status === "running" || status === "scheduled") return "primary";
  return "neutral";
}
