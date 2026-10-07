import "server-only";

import { createClient as createNodeClient, type Client } from "@libsql/client";
import { createClient as createWebClient } from "@libsql/client/web";
import { mkdirSync } from "fs";
import { SEED_USERS } from "@/lib/config";

let client: Client | null = null;
let migrated = false;

function tursoUrl() {
  // Prefer APP_TURSO_* so the Vercel Turso integration can keep injecting
  // per-deploy branch URLs into TURSO_DATABASE_URL without wiping data.
  return (
    process.env.APP_TURSO_DATABASE_URL?.trim() ||
    process.env.TURSO_DATABASE_URL?.trim() ||
    process.env.TURSO_URL?.trim() ||
    process.env.STORAGE_URL?.trim() ||
    ""
  );
}

function tursoAuthToken() {
  return (
    process.env.APP_TURSO_AUTH_TOKEN?.trim() ||
    process.env.TURSO_AUTH_TOKEN?.trim() ||
    process.env.TURSO_TOKEN?.trim() ||
    process.env.STORAGE_AUTH_TOKEN?.trim() ||
    process.env.STORAGE_TOKEN?.trim() ||
    ""
  );
}

function getClient(): Client {
  if (client) return client;

  const url = tursoUrl();
  const authToken = tursoAuthToken() || undefined;
  const onVercel = Boolean(process.env.VERCEL);

  if (url) {
    client =
      onVercel || url.startsWith("libsql://") || url.startsWith("https://")
        ? createWebClient({ url, authToken })
        : createNodeClient({ url, authToken });
  } else if (onVercel) {
    throw new Error(
      "No Turso URL in env (expected TURSO_DATABASE_URL or TURSO_URL). Check Vercel env for this environment, then Redeploy.",
    );
  } else {
    mkdirSync("data", { recursive: true });
    client = createNodeClient({ url: "file:data/prototype.db" });
  }

  return client;
}

export async function ensureDb(): Promise<Client> {
  const db = getClient();
  if (migrated) return db;

  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS partner_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        handle TEXT NOT NULL,
        genre TEXT NOT NULL,
        avatar_hue INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS campaign_map (
        campaign_id TEXT PRIMARY KEY,
        partner_user_id TEXT NOT NULL,
        campaign_name TEXT NOT NULL,
        spotify_url TEXT NOT NULL,
        daily_budget REAL NOT NULL,
        duration_days INTEGER NOT NULL,
        genre TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        creative_mode TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'creating',
        campaign_url TEXT,
        soundlink_spend REAL NOT NULL DEFAULT 0,
        partner_fee REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (partner_user_id) REFERENCES partner_users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        video_id TEXT,
        title TEXT NOT NULL,
        source_url TEXT NOT NULL,
        thumbnail_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        session_id TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS api_call_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        request_body TEXT,
        response_body TEXT,
        created_at TEXT NOT NULL
      )`,
    ],
    "write",
  );

  const existing = await db.execute("SELECT COUNT(*) AS c FROM partner_users");
  const count = Number(existing.rows[0]?.c ?? 0);
  if (count === 0) {
    const now = new Date().toISOString();
    for (const user of SEED_USERS) {
      await db.execute({
        sql: `INSERT INTO partner_users (id, name, handle, genre, avatar_hue, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          user.id,
          user.name,
          user.handle,
          user.genre,
          user.avatarHue,
          now,
        ],
      });
    }
  }

  await ensureCampaignMapColumns(db);

  migrated = true;
  return db;
}

async function ensureCampaignMapColumns(db: Client): Promise<void> {
  const info = await db.execute("PRAGMA table_info(campaign_map)");
  const cols = new Set(info.rows.map((row) => String(row.name)));
  if (!cols.has("campaign_url")) {
    await db.execute("ALTER TABLE campaign_map ADD COLUMN campaign_url TEXT");
  }
  if (!cols.has("soundlink_spend")) {
    await db.execute(
      "ALTER TABLE campaign_map ADD COLUMN soundlink_spend REAL NOT NULL DEFAULT 0",
    );
    // Backfill cycle cost for rows created before this column existed.
    await db.execute(
      "UPDATE campaign_map SET soundlink_spend = ROUND(daily_budget * duration_days, 2)",
    );
  }
  if (!cols.has("partner_fee")) {
    await db.execute(
      "ALTER TABLE campaign_map ADD COLUMN partner_fee REAL NOT NULL DEFAULT 0",
    );
  }
}

export type PartnerUser = {
  id: string;
  name: string;
  handle: string;
  genre: string;
  avatarHue: number;
};

export type CampaignMapRow = {
  campaignId: string;
  partnerUserId: string;
  campaignName: string;
  spotifyUrl: string;
  dailyBudget: number;
  durationDays: number;
  genre: string;
  strategyType: string;
  creativeMode: string;
  idempotencyKey: string;
  status: string;
  campaignUrl: string | null;
  soundlinkSpend: number;
  partnerFee: number;
  createdAt: string;
};

export type VideoRow = {
  id: string;
  videoId: string | null;
  title: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  status: string;
  sessionId: string | null;
  createdAt: string;
};

export async function listUsers(): Promise<PartnerUser[]> {
  const db = await ensureDb();
  const result = await db.execute(
    "SELECT id, name, handle, genre, avatar_hue FROM partner_users ORDER BY name",
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    handle: String(row.handle),
    genre: String(row.genre),
    avatarHue: Number(row.avatar_hue),
  }));
}

export async function getUser(id: string): Promise<PartnerUser | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: "SELECT id, name, handle, genre, avatar_hue FROM partner_users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    handle: String(row.handle),
    genre: String(row.genre),
    avatarHue: Number(row.avatar_hue),
  };
}

export async function listCampaignsForUser(
  partnerUserId: string,
): Promise<CampaignMapRow[]> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT campaign_id, partner_user_id, campaign_name, spotify_url,
                 daily_budget, duration_days, genre, strategy_type, creative_mode,
                 idempotency_key, status, campaign_url, soundlink_spend, partner_fee,
                 created_at
          FROM campaign_map
          WHERE partner_user_id = ?
          ORDER BY created_at DESC`,
    args: [partnerUserId],
  });
  return result.rows.map(mapCampaignRow);
}

export type CampaignMapAdminRow = CampaignMapRow & {
  partnerUserName: string;
  partnerUserHandle: string;
};

export async function listAllCampaignMaps(): Promise<CampaignMapAdminRow[]> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT c.campaign_id, c.partner_user_id, c.campaign_name, c.spotify_url,
            c.daily_budget, c.duration_days, c.genre, c.strategy_type, c.creative_mode,
            c.idempotency_key, c.status, c.campaign_url, c.soundlink_spend, c.partner_fee,
            c.created_at,
            u.name AS partner_user_name, u.handle AS partner_user_handle
     FROM campaign_map c
     JOIN partner_users u ON u.id = c.partner_user_id
     ORDER BY c.created_at DESC`,
  );
  return result.rows.map((row) => ({
    ...mapCampaignRow(row),
    partnerUserName: String(row.partner_user_name),
    partnerUserHandle: String(row.partner_user_handle),
  }));
}

export async function countActiveCampaigns(): Promise<number> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT COUNT(*) AS c FROM campaign_map
     WHERE status NOT IN ('stopped', 'completed', 'failed', 'ended')`,
  );
  return Number(result.rows[0]?.c ?? 0);
}

export async function insertCampaignMap(
  row: Omit<CampaignMapRow, "createdAt"> & { createdAt?: string },
): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: `INSERT INTO campaign_map (
            campaign_id, partner_user_id, campaign_name, spotify_url,
            daily_budget, duration_days, genre, strategy_type, creative_mode,
            idempotency_key, status, campaign_url, soundlink_spend, partner_fee,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.campaignId,
      row.partnerUserId,
      row.campaignName,
      row.spotifyUrl,
      row.dailyBudget,
      row.durationDays,
      row.genre,
      row.strategyType,
      row.creativeMode,
      row.idempotencyKey,
      row.status,
      row.campaignUrl,
      row.soundlinkSpend,
      row.partnerFee,
      row.createdAt ?? new Date().toISOString(),
    ],
  });
}

export async function updateCampaignStatus(
  campaignId: string,
  status: string,
): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: "UPDATE campaign_map SET status = ? WHERE campaign_id = ?",
    args: [status, campaignId],
  });
}

export async function updateCampaignMapFields(
  campaignId: string,
  patch: { status?: string; campaignUrl?: string | null },
): Promise<void> {
  const db = await ensureDb();
  const current = await getCampaignMap(campaignId);
  if (!current) return;
  await db.execute({
    sql: `UPDATE campaign_map SET status = ?, campaign_url = ? WHERE campaign_id = ?`,
    args: [
      patch.status ?? current.status,
      patch.campaignUrl !== undefined ? patch.campaignUrl : current.campaignUrl,
      campaignId,
    ],
  });
}

export async function getCampaignMap(
  campaignId: string,
): Promise<CampaignMapRow | null> {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT campaign_id, partner_user_id, campaign_name, spotify_url,
                 daily_budget, duration_days, genre, strategy_type, creative_mode,
                 idempotency_key, status, campaign_url, soundlink_spend, partner_fee,
                 created_at
          FROM campaign_map WHERE campaign_id = ?`,
    args: [campaignId],
  });
  const row = result.rows[0];
  return row ? mapCampaignRow(row) : null;
}

export async function listVideos(): Promise<VideoRow[]> {
  const db = await ensureDb();
  const result = await db.execute(
    `SELECT id, video_id, title, source_url, thumbnail_url, status, session_id, created_at
     FROM videos ORDER BY created_at DESC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    videoId: row.video_id ? String(row.video_id) : null,
    title: String(row.title),
    sourceUrl: String(row.source_url),
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    status: String(row.status),
    sessionId: row.session_id ? String(row.session_id) : null,
    createdAt: String(row.created_at),
  }));
}

export async function insertVideo(input: {
  id: string;
  title: string;
  sourceUrl: string;
  status: string;
  sessionId?: string | null;
  videoId?: string | null;
}): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: `INSERT INTO videos (id, video_id, title, source_url, thumbnail_url, status, session_id, created_at)
          VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
    args: [
      input.id,
      input.videoId ?? null,
      input.title,
      input.sourceUrl,
      input.status,
      input.sessionId ?? null,
      new Date().toISOString(),
    ],
  });
}

export async function updateVideo(
  id: string,
  patch: {
    status?: string;
    videoId?: string | null;
    sessionId?: string | null;
  },
): Promise<void> {
  const db = await ensureDb();
  const current = await db.execute({
    sql: "SELECT status, video_id, session_id FROM videos WHERE id = ?",
    args: [id],
  });
  const row = current.rows[0];
  if (!row) return;
  await db.execute({
    sql: `UPDATE videos SET status = ?, video_id = ?, session_id = ? WHERE id = ?`,
    args: [
      patch.status ?? String(row.status),
      patch.videoId !== undefined ? patch.videoId : row.video_id,
      patch.sessionId !== undefined ? patch.sessionId : row.session_id,
      id,
    ],
  });
}

export async function logApiCall(call: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
}): Promise<void> {
  const db = await ensureDb();
  await db.execute({
    sql: `INSERT INTO api_call_log (method, path, status, duration_ms, request_body, response_body, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      call.method,
      call.path,
      call.status,
      call.durationMs,
      call.requestBody === undefined ? null : JSON.stringify(call.requestBody),
      call.responseBody === undefined
        ? null
        : JSON.stringify(call.responseBody),
      new Date().toISOString(),
    ],
  });
}

export async function listRecentApiCalls(limit = 30) {
  const db = await ensureDb();
  const result = await db.execute({
    sql: `SELECT id, method, path, status, duration_ms, request_body, response_body, created_at
          FROM api_call_log ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((row) => ({
    id: Number(row.id),
    method: String(row.method),
    path: String(row.path),
    status: Number(row.status),
    durationMs: Number(row.duration_ms),
    requestBody: row.request_body ? JSON.parse(String(row.request_body)) : null,
    responseBody: row.response_body
      ? JSON.parse(String(row.response_body))
      : null,
    createdAt: String(row.created_at),
  }));
}

function mapCampaignRow(row: Record<string, unknown>): CampaignMapRow {
  return {
    campaignId: String(row.campaign_id),
    partnerUserId: String(row.partner_user_id),
    campaignName: String(row.campaign_name),
    spotifyUrl: String(row.spotify_url),
    dailyBudget: Number(row.daily_budget),
    durationDays: Number(row.duration_days),
    genre: String(row.genre),
    strategyType: String(row.strategy_type),
    creativeMode: String(row.creative_mode),
    idempotencyKey: String(row.idempotency_key),
    status: String(row.status),
    campaignUrl: row.campaign_url ? String(row.campaign_url) : null,
    soundlinkSpend: Number(row.soundlink_spend ?? 0),
    partnerFee: Number(row.partner_fee ?? 0),
    createdAt: String(row.created_at),
  };
}
