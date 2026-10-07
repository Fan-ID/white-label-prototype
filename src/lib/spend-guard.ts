import { SPEND_GUARD } from "@/lib/config"
import { countActiveCampaigns } from "@/lib/db"
import { cycleCostUsd } from "@/lib/money"

export { cycleCostUsd }

export type SpendGuardResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateCreateBudget(input: {
  dailyBudget: number
  durationDays: number
}): SpendGuardResult {
  if (
    !Number.isFinite(input.dailyBudget) ||
    input.dailyBudget < SPEND_GUARD.minDailyBudgetUsd
  ) {
    return {
      ok: false,
      reason: `Daily budget must be at least $${SPEND_GUARD.minDailyBudgetUsd} (Public API floor).`,
    }
  }
  if (input.dailyBudget > SPEND_GUARD.maxDailyBudgetUsd) {
    return {
      ok: false,
      reason: `Prototype spend guard: daily budget capped at $${SPEND_GUARD.maxDailyBudgetUsd}.`,
    }
  }
  if (
    !Number.isInteger(input.durationDays) ||
    input.durationDays < SPEND_GUARD.minDurationDays
  ) {
    return {
      ok: false,
      reason: `Duration must be at least ${SPEND_GUARD.minDurationDays} days.`,
    }
  }
  if (input.durationDays > SPEND_GUARD.maxDurationDays) {
    return {
      ok: false,
      reason: `Prototype spend guard: duration capped at ${SPEND_GUARD.maxDurationDays} days.`,
    }
  }
  return { ok: true }
}

export async function assertCanCreateCampaign(input: {
  dailyBudget: number
  durationDays: number
}): Promise<SpendGuardResult> {
  const budgetCheck = validateCreateBudget(input)
  if (!budgetCheck.ok) return budgetCheck

  const active = await countActiveCampaigns()
  if (active >= SPEND_GUARD.maxActiveCampaigns) {
    return {
      ok: false,
      reason: `Prototype spend guard: max ${SPEND_GUARD.maxActiveCampaigns} active campaigns. Stop one before creating another.`,
    }
  }
  return { ok: true }
}
