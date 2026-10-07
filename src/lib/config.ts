/** Prototype spend guard — real Public API creates reserve real wallet credits. */
export const SPEND_GUARD = {
  maxDailyBudgetUsd: 10,
  maxDurationDays: 7,
  maxActiveCampaigns: 5,
  minDailyBudgetUsd: 10,
  minDurationDays: 7,
} as const

export const PUBLIC_API_GENRES = [
  "Alternative/Indie",
  "Ambient/Sleep",
  "Chill/Background",
  "Classical",
  "Country",
  "Electronic/Dance",
  "Hip-Hop/R&B",
  "Latin/Reggaeton",
  "Pop",
  "Rock",
  "Christmas",
] as const

export const SESSION_COOKIE = "groover_partner_user"

export const SEED_USERS = [
  {
    id: "user_maya",
    name: "Maya Rivers",
    handle: "mayarivers",
    genre: "Pop",
    avatarHue: 12,
  },
  {
    id: "user_jules",
    name: "Jules Okoro",
    handle: "julesokoro",
    genre: "Hip-Hop/R&B",
    avatarHue: 200,
  },
  {
    id: "user_sofia",
    name: "Sofia Mendes",
    handle: "sofiamendes",
    genre: "Latin/Reggaeton",
    avatarHue: 320,
  },
] as const
