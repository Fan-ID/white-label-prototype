export function cycleCostUsd(dailyBudget: number, durationDays: number) {
  return Math.round(dailyBudget * durationDays * 100) / 100
}
