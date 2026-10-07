import "server-only";

import { logApiCall } from "@/lib/db";

const DEFAULT_BASE_URL = "https://api.getsoundlink.com";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiCallRecord {
  method: HttpMethod;
  path: string;
  requestBody?: unknown;
  idempotencyKey?: string;
  status: number;
  responseBody: unknown;
  durationMs: number;
  at: string;
}

export interface SoundlinkApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
  call: ApiCallRecord;
}

function getApiKey(): string {
  const key = process.env.SOUNDLINK_API_KEY;
  if (!key) {
    throw new Error("SOUNDLINK_API_KEY is not set");
  }
  return key;
}

export async function soundlinkRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<SoundlinkApiResult<T>> {
  const baseUrl = process.env.SOUNDLINK_API_BASE_URL || DEFAULT_BASE_URL;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }

  const call: ApiCallRecord = {
    method,
    path,
    requestBody: body,
    idempotencyKey,
    status: response.status,
    responseBody: data,
    durationMs: Date.now() - startedAt,
    at: new Date(startedAt).toISOString(),
  };

  try {
    await logApiCall(call);
  } catch {
    // Never fail the API call because of local logging.
  }

  return {
    ok: response.ok,
    status: response.status,
    data: data as T,
    call,
  };
}
