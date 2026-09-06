import type { IncomingMessage, ServerResponse } from "node:http";
import { parse as parseCookieHeader, serialize as serializeCookie } from "cookie";
import { ENV } from "./_core/env";

const ACCESS_COOKIE = "lexus_access_token";
const REFRESH_COOKIE = "lexus_refresh_token";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse;

export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseAuthUser;
};

export type SessionUser = {
  authId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
};

export function json(res: ApiResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  let raw = "";
  for await (const chunk of req) {
    raw += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (raw.length > 1_000_000) throw new Error("Corpo da requisição muito grande.");
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function assertConfigured() {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) {
    throw new Error("Supabase Auth não está configurado no Vercel. Verifique SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.");
  }
}

function headers(accessToken?: string) {
  assertConfigured();
  return {
    apikey: ENV.supabasePublishableKey,
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

function isSecure(req: ApiRequest) {
  const proto = req.headers["x-forwarded-proto"];
  return ENV.isProduction || proto === "https";
}

function cookieBase(req: ApiRequest) {
  return {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookies(req: ApiRequest, res: ApiResponse, session: SupabaseSession) {
  if (!session.access_token || !session.refresh_token) return;
  const base = cookieBase(req);
  const accessMaxAge = Math.max(60, session.expires_in ?? 3600);
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, session.access_token, { ...base, maxAge: accessMaxAge }),
    serializeCookie(REFRESH_COOKIE, session.refresh_token, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS }),
  ]);
}

export function clearSessionCookies(req: ApiRequest, res: ApiResponse) {
  const base = cookieBase(req);
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, "", { ...base, maxAge: 0 }),
    serializeCookie(REFRESH_COOKIE, "", { ...base, maxAge: 0 }),
  ]);
}

function getCookies(req: ApiRequest) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return {
    accessToken: cookies[ACCESS_COOKIE] ?? "",
    refreshToken: cookies[REFRESH_COOKIE] ?? "",
  };
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 128;
}

export async function parseSupabaseError(response: Response) {
  try {
    const body = await response.json() as Record<string, unknown>;
    const message = body.msg ?? body.message ?? body.error_description ?? body.error ?? body.code;
    return typeof message === "string" && message.trim() ? message : `Supabase respondeu ${response.status}`;
  } catch {
    return `Supabase respondeu ${response.status}`;
  }
}

export async function supabasePasswordLogin(email: string, password: string) {
  assertConfigured();
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  return response;
}

export async function supabaseSignup(email: string, password: string, name: string) {
  assertConfigured();
  return fetch(`${ENV.supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email,
      password,
      ...(name ? { data: { name } } : {}),
    }),
  });
}

async function getSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (!accessToken || !ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: headers(accessToken),
  });
  if (!response.ok) return null;
  return await response.json() as SupabaseAuthUser;
}

async function refreshSession(refreshToken: string): Promise<SupabaseSession | null> {
  if (!refreshToken || !ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return await response.json() as SupabaseSession;
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toSessionUser(user: SupabaseAuthUser): SessionUser {
  const email = user.email ?? null;
  const name = metadataString(user.user_metadata, ["name", "full_name", "display_name"]) ?? (email ? email.split("@")[0] : "Cliente");
  const loginMethod = metadataString(user.app_metadata, ["provider"]) ?? "email";
  return { authId: user.id, name, email, loginMethod, role: "user" };
}

export async function resolveSession(req: ApiRequest, res: ApiResponse): Promise<SessionUser | null> {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  const { accessToken, refreshToken } = getCookies(req);

  let user = await getSupabaseUser(accessToken);
  if (!user && refreshToken) {
    const refreshed = await refreshSession(refreshToken);
    if (refreshed?.access_token && refreshed.refresh_token) {
      setSessionCookies(req, res, refreshed);
      user = refreshed.user ?? await getSupabaseUser(refreshed.access_token);
    } else {
      clearSessionCookies(req, res);
    }
  }

  return user ? toSessionUser(user) : null;
}

export async function supabaseLogout(req: ApiRequest, res: ApiResponse) {
  const { accessToken } = getCookies(req);
  if (accessToken && ENV.supabaseUrl && ENV.supabasePublishableKey) {
    try {
      await fetch(`${ENV.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: headers(accessToken),
      });
    } catch (error) {
      console.warn("[Auth] Supabase logout failed:", error);
    }
  }
  clearSessionCookies(req, res);
}
