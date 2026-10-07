# Groover × Soundlink — white-label prototype

Partner-style UI that creates and manages **paid wallet campaigns** using only the [Soundlink Public API](https://api.getsoundlink.com).

## What this demonstrates

1. One Soundlink org + API key (your test account)
2. Fake Groover artists (partner-side user mapping in local DB / Turso)
3. Campaign create / stop via Public API
4. Creative import via `POST /v1/videos/import` (public HTTPS URL only)
5. Live **API call log** so Groover can see the exact integration surface

## Spend guard

Creates are capped at **$10/day × 7 days** and **5 active campaigns** to protect your test wallet. Real Meta ads still go live — stop campaigns after demos.

## Local setup

```bash
cp .env.example .env
# set SOUNDLINK_API_KEY=sk_...
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Turso env vars, SQLite lives at `data/prototype.db`.

## Vercel

- Set `SOUNDLINK_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- Enable **Deployment Protection** (password / Vercel Auth)
- Spend guard remains enforced server-side

## Routes

| Path              | Purpose                              |
| ----------------- | ------------------------------------ |
| `/`               | Pick fake Groover artist             |
| `/campaigns`      | Artist campaign list                 |
| `/campaigns/new`  | Launch flow                          |
| `/campaigns/[id]` | Detail + stop                        |
| `/creatives`      | Import videos into Soundlink library |
