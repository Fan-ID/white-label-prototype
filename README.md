# Groover × Soundlink — white-label prototype

Partner-style Next.js app that creates and manages **Soundlink paid wallet campaigns** using **only the [Soundlink Public API](https://docs.getsoundlink.com)** (no internal Fan-ID APIs).

It simulates a white-label partner (Groover): fake artists on the partner side, a local mapping DB, and a UI that looks like the partner’s product while every create / stop / metrics / video import call goes to Soundlink.

> **Warning:** Creates debit a **real org wallet** and can launch **real Meta ads**. Use a test API key, keep the spend guard on, and stop campaigns after demos.

---

## What it demonstrates

| Concept                  | How                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- |
| One Soundlink org        | Single `SOUNDLINK_API_KEY` for the test organization                                  |
| Partner user mapping     | Seed Groover artists in SQLite/Turso; campaigns tagged with `partner_user_id`         |
| Campaign lifecycle       | `POST /v1/campaigns` → poll status → insights → `POST .../stop`                       |
| Full control creatives   | Local catalog (`public/creatives`) + add-by-HTTPS-URL → import → `videoId`s on create |
| Integration transparency | `api_call_log` + API Calls panel showing method, path, bodies, latency                |
| Spend safety             | Server-side cap: **$10/day × 7 days**, max **5** non-terminal campaigns               |

---

## Architecture

```
┌─────────────────────┐     cookie session      ┌──────────────────────┐
│  Groover-style UI   │ ───────────────────────▶│  Next.js BFF (/api)  │
│  (artists, create,  │                         │  spend guard + map   │
│   admin, creatives) │ ◀───────────────────────│  SQLite / Turso      │
└─────────────────────┘                         └──────────┬───────────┘
                                                           │ Bearer API key
                                                           ▼
                                                ┌──────────────────────┐
                                                │ Soundlink Public API │
                                                │ api.getsoundlink.com │
                                                └──────────────────────┘
```

- **UI** — Groover branding; pick a fake artist; launch / list / detail / admin.
- **BFF** — Thin routes under `src/app/api/**`. Never expose the API key to the browser.
- **Partner DB** — Ownership map + video import rows + API call log (not Soundlink’s DB).
- **Soundlink** — Source of truth for campaigns, wallet, metrics, video library.

### App routes

| Path              | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `/`               | Pick a seed Groover artist (sets session cookie)                       |
| `/campaigns`      | Campaigns for the current artist                                       |
| `/campaigns/new`  | Create flow (Track → Creative → Genre → Budget → Review)               |
| `/campaigns/[id]` | Detail, Insights charts, API payload, stop, Soundlink dashboard link   |
| `/creatives`      | Import videos by public HTTPS URL into the Soundlink org library       |
| `/admin`          | Full `campaign_map` table (all artists) + filters + dashboard shortcut |

### Key API routes (BFF)

| Method           | Path                          | Soundlink call                                          |
| ---------------- | ----------------------------- | ------------------------------------------------------- |
| `POST`           | `/api/session`                | — (sets partner cookie)                                 |
| `GET/POST`       | `/api/campaigns`              | `GET/POST /v1/campaigns`                                |
| `GET`            | `/api/campaigns/[id]`         | `GET /v1/campaigns/:id` (+ sync status / `campaignUrl`) |
| `POST`           | `/api/campaigns/[id]/stop`    | `POST /v1/campaigns/:id/stop`                           |
| `GET`            | `/api/campaigns/[id]/metrics` | overview + breakdown metrics                            |
| `GET/POST/PATCH` | `/api/videos`                 | `POST /v1/videos/import` + poll session                 |
| `GET`            | `/api/creatives/demo`         | — (lists `public/creatives/*`)                          |
| `GET`            | `/api/calls`                  | — (recent `api_call_log`)                               |

---

## Database model

Local LibSQL / Turso. Schema is created on first request (`ensureDb` in `src/lib/db.ts`).

### `partner_users`

Seeded fake Groover artists (see `SEED_USERS` in `src/lib/config.ts`).

| Column       | Type     | Notes                                        |
| ------------ | -------- | -------------------------------------------- |
| `id`         | TEXT PK  | e.g. `user_maya`                             |
| `name`       | TEXT     | Display name                                 |
| `handle`     | TEXT     | Used to prefix campaign names (`{handle}_…`) |
| `genre`      | TEXT     | Default genre in the create form             |
| `avatar_hue` | INTEGER  | Avatar color                                 |
| `created_at` | TEXT ISO |                                              |

### `campaign_map`

Partner-side ownership of Soundlink campaigns.

| Column            | Type      | Notes                                                   |
| ----------------- | --------- | ------------------------------------------------------- |
| `campaign_id`     | TEXT PK   | Soundlink campaign id from Public API                   |
| `partner_user_id` | TEXT FK   | → `partner_users.id`                                    |
| `campaign_name`   | TEXT      | Usually `{handle}_…`                                    |
| `spotify_url`     | TEXT      | Track/playlist URL sent to API                          |
| `daily_budget`    | REAL      | USD                                                     |
| `duration_days`   | INTEGER   |                                                         |
| `genre`           | TEXT      | Required for both creative modes                        |
| `strategy_type`   | TEXT      | e.g. `maximum_growth`                                   |
| `creative_mode`   | TEXT      | `do_it_for_me` \| `full_control`                        |
| `idempotency_key` | TEXT      | Sent as `Idempotency-Key` on create                     |
| `status`          | TEXT      | Mirrored from API (`creating`, `active`, `inactive`, …) |
| `campaign_url`    | TEXT NULL | Soundlink dashboard insights URL                        |
| `created_at`      | TEXT ISO  |                                                         |

### `videos`

Tracks Public API imports (org library), used for full_control selection.

| Column          | Type      | Notes                                 |
| --------------- | --------- | ------------------------------------- |
| `id`            | TEXT PK   | Local row id                          |
| `video_id`      | TEXT NULL | Soundlink `videoId` when `ready`      |
| `title`         | TEXT      |                                       |
| `source_url`    | TEXT      | Public HTTPS URL imported             |
| `thumbnail_url` | TEXT NULL | Reserved                              |
| `status`        | TEXT      | `processing` / `ready` / `failed` / … |
| `session_id`    | TEXT NULL | Import session for polling            |
| `created_at`    | TEXT ISO  |                                       |

### `api_call_log`

Every Public API request from the BFF (for the API Calls panel).

| Column                                    | Type       |
| ----------------------------------------- | ---------- |
| `id`                                      | INTEGER PK |
| `method`, `path`, `status`, `duration_ms` |            |
| `request_body`, `response_body`           | TEXT JSON  |
| `created_at`                              | TEXT ISO   |

### ER sketch

```
partner_users 1 ─── * campaign_map
                 (partner_user_id)

videos          (org-wide; not per artist in this prototype)
api_call_log    (org-wide debug log)
```

---

## Main product flows

### 1. Session (fake partner auth)

1. Open `/` → pick Maya / Jules / Sofia.
2. `POST /api/session` sets cookie `groover_partner_user`.
3. Campaign list/detail are scoped to that artist. **Admin** sees all rows.

There is no real auth — protect the Vercel deployment (see below).

### 2. Create campaign (`do_it_for_me`)

Wizard mirrors Paid Growth order: Track → Creative → Genre → Budget → Review.

1. Spotify track/playlist URL (+ optional name; auto-prefixed with handle).
2. Creative mode `do_it_for_me`.
3. Genre (always required).
4. Strategy + budget (clamped by spend guard).
5. BFF validates guard → `POST /v1/campaigns` with `Idempotency-Key` → insert `campaign_map`.

### 3. Create campaign (`full_control`)

1. Same wizard; choose **Full control**.
2. **Catalog** — MP4/MOV files in `public/creatives/` (preview in UI).
3. **Imported library** — videos already imported via URL.
4. **Add more** — paste a public **HTTPS** MP4/MOV URL (import + select).
5. Select 1–10 creatives.
6. On Launch: unresolved catalog items are imported (`POST /v1/videos/import` + poll), then create with:

```json
{
  "creativeDirection": {
    "type": "full_control",
    "selectedCreatives": [{ "videoId": "…" }]
  }
}
```

**Localhost caveat:** Soundlink cannot download `http://localhost/...`. Demo clips import only after a **public HTTPS** deploy (Vercel preview), or use Add URL with a CDN link.

### 4. Status polling & insights

- While status is `creating`, list/detail poll `GET /v1/campaigns/:id` and update the map.
- Detail **Insights** loads metrics overview + breakdown via the BFF.
- **Open in Soundlink** uses stored `campaignUrl` (`/orgs/{orgId}/insights/{smartlinkId}`).

### 5. Stop

`POST /v1/campaigns/:id/stop` — unspent budget returns to the org wallet (Soundlink behavior). Local status updates only when the API succeeds.

---

## Spend guard

Enforced in `src/lib/spend-guard.ts` on create:

| Rule             | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Daily budget     | Exactly **$10** (min = max in this prototype)                                   |
| Duration         | Exactly **7** days                                                              |
| Cycle reserve    | **$70** per create                                                              |
| Active campaigns | Max **5** rows whose status is not in `stopped`, `completed`, `failed`, `ended` |

Tune constants in `src/lib/config.ts` (`SPEND_GUARD`).

---

## Environment variables

Copy `.env.example` → `.env` for local:

| Variable                    | Required  | Description                                                        |
| --------------------------- | --------- | ------------------------------------------------------------------ |
| `SOUNDLINK_API_KEY`         | Yes       | Public API key (`sk_…`) with campaign + video scopes               |
| `SOUNDLINK_API_BASE_URL`    | No        | Default `https://api.getsoundlink.com`                             |
| `TURSO_DATABASE_URL`        | On Vercel | libSQL URL (`libsql://…`)                                          |
| `TURSO_AUTH_TOKEN`          | On Vercel | Turso auth token                                                   |
| `TURSO_URL` / `TURSO_TOKEN` | Alt       | Accepted if the Vercel Turso Connect UI used Custom Prefix `TURSO` |
| `STORAGE_URL` / `STORAGE_*` | Alt       | Accepted if prefix was left as `STORAGE` (avoid; prefer `TURSO`)   |

**Local without Turso:** file DB at `data/prototype.db` (gitignored).  
**Vercel:** file DB does **not** work — Turso is required.

---

## Local development

```bash
cp .env.example .env
# Set SOUNDLINK_API_KEY=sk_...

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional: set Turso vars to share the same DB as preview.

```bash
npm run build && npm start   # production build locally
```

---

## Deploy to Vercel (complete)

### 1. Push the repo

Connect the GitHub repo (or CLI):

```bash
# from this directory
npx vercel
```

Or: Vercel Dashboard → Add Project → import this repository.

### 2. Add Turso (required)

On the deploy / integrations step (or **Storage** / marketplace):

1. **Add** Turso Cloud.
2. Connect project **white-label-prototype**.
3. Environments: **Production** and **Preview**.
4. Optionally create a database branch for Preview.
5. **Custom Prefix:** set to **`TURSO`** (not `STORAGE`).  
   You want env vars named like `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` or `TURSO_URL` / `TURSO_TOKEN`.
6. Mark secrets as **Sensitive**.
7. After connecting, open **Settings → Environment Variables** and confirm the names for **Preview** and **Production**.

This app’s `src/lib/db.ts` reads (in order):

- URL: `TURSO_DATABASE_URL` → `TURSO_URL` → `STORAGE_URL`
- Token: `TURSO_AUTH_TOKEN` → `TURSO_TOKEN` → `STORAGE_AUTH_TOKEN` → `STORAGE_TOKEN`

On Vercel it uses `@libsql/client/web` (fetch) for remote libSQL URLs.

### 3. Add Soundlink env vars

In **Settings → Environment Variables** (Preview + Production):

| Name                     | Value                                     |
| ------------------------ | ----------------------------------------- |
| `SOUNDLINK_API_KEY`      | your `sk_…` test key                      |
| `SOUNDLINK_API_BASE_URL` | `https://api.getsoundlink.com` (optional) |

### 4. Redeploy

Env vars added after a deploy are **not** live until **Redeploy**.

If you see `Unable to open connection to local database data/prototype.db`, Turso URL was missing in that environment — fix names/scope and redeploy.

### 5. Deployment Protection (strongly recommended)

**Settings → Deployment Protection** → enable **Vercel Authentication** or a password.

Anyone who can hit `/api/campaigns` with a session cookie can spend real wallet credit. Seed artist ids are predictable.

### 6. Smoke test on the preview URL

1. Open the preview → pick an artist.
2. `/creatives` or create flow → confirm catalog videos play.
3. Create a small `do_it_for_me` campaign ($70 reserve).
4. Open detail → wait until status leaves `creating` → check Insights / Admin.
5. **Stop** the campaign when the demo is done.
6. For full_control: select catalog clips on the **HTTPS** preview URL so Soundlink can import them.

### 7. Demo creatives on preview

Files under `public/creatives/*.mp4` are served as:

`https://<deployment>.vercel.app/creatives/<filename>.mp4`

Keep clips small (a few MB each) so git/deploy stay manageable. Max import size on the Public API is **70 MB** per file.

---

## Project layout

```
src/
  app/
    api/           # BFF → Public API + DB
    admin/         # campaign_map admin UI
    campaigns/     # list, new, [id]
    creatives/     # import UI
  components/      # UI (create form, insights, picker, shell, …)
  lib/
    db.ts          # schema + queries
    soundlink-api.ts
    spend-guard.ts
    demo-creatives.ts
    session.ts
    config.ts
public/
  creatives/       # demo MP4/MOV for full_control catalog
  images/logo.png
```

---

## Operational tips

- Prefer **Stop** from the app or Soundlink dashboard after demos.
- Use **Admin** to verify `campaign_id` ↔ `partner_user_id` mapping and open the Soundlink dashboard (target icon).
- If create succeeds on Soundlink but local insert fails, the API returns `campaignId` in the error payload for recovery.
- Detail GET returns **200 with local `mapped`** even if Soundlink is briefly down, so `creating` polling continues.
- Duplicate video imports (same content hash) return an existing `videoId` (Soundlink behavior).

---

## References

- [Soundlink Public API docs](https://docs.getsoundlink.com)
- [Importing videos](https://docs.getsoundlink.com/importing-videos) — HTTPS MP4/MOV only
- [Creating campaigns](https://docs.getsoundlink.com/creating-campaigns) — `creativeDirection`, wallet funding
- [Turso on Vercel](https://docs.turso.tech/integrations/vercel)

---

## License / status

Internal prototype for Soundlink × Groover white-label exploration. Not a production partner SDK.
