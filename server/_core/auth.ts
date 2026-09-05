import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { ENV } from "./env";
import { getUserByOpenId, upsertUser } from "../db";

const ACCESS_COOKIE = "lexus_access_token";
const REFRESH_COOKIE = "lexus_refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthenticatedUser = {
  id: number | null;
  authId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: SupabaseAuthUser;
};

function assertSupabaseAuthConfigured() {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) {
    throw new Error(
      "Supabase Auth não está configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no Vercel.",
    );
  }
}

function supabaseHeaders(accessToken?: string) {
  assertSupabaseAuthConfigured();
  return {
    apikey: ENV.supabasePublishableKey,
    "content-type": "application/json",
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

function cookieOptions(req: Request) {
  const secure = ENV.isProduction || req.headers["x-forwarded-proto"] === "https" || req.protocol === "https";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

function setSessionCookies(req: Request, res: Response, session: SupabaseSession) {
  if (!session.access_token || !session.refresh_token) return;
  const base = cookieOptions(req);
  const accessMaxAge = Math.max(60, session.expires_in ?? 3600) * 1000;
  res.cookie(ACCESS_COOKIE, session.access_token, { ...base, maxAge: accessMaxAge });
  res.cookie(REFRESH_COOKIE, session.refresh_token, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE_MS });
}

export function clearAuthCookies(req: Request, res: Response) {
  const base = cookieOptions(req);
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

function getAuthCookies(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return {
    accessToken: cookies[ACCESS_COOKIE] ?? "",
    refreshToken: cookies[REFRESH_COOKIE] ?? "",
  };
}

async function parseSupabaseError(response: globalThis.Response) {
  try {
    const body = await response.json() as Record<string, unknown>;
    const message = body.msg ?? body.message ?? body.error_description ?? body.error;
    return typeof message === "string" && message.trim() ? message : `Supabase respondeu ${response.status}`;
  } catch {
    return `Supabase respondeu ${response.status}`;
  }
}

async function getSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  if (!accessToken || !ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: supabaseHeaders(accessToken),
  });
  if (!response.ok) return null;
  return await response.json() as SupabaseAuthUser;
}

async function refreshSupabaseSession(refreshToken: string): Promise<SupabaseSession | null> {
  if (!refreshToken || !ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: supabaseHeaders(),
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

async function toAuthenticatedUser(authUser: SupabaseAuthUser): Promise<AuthenticatedUser> {
  const email = authUser.email ?? null;
  const name =
    metadataString(authUser.user_metadata, ["name", "full_name", "display_name"]) ??
    (email ? email.split("@")[0] : "Cliente");
  const provider = metadataString(authUser.app_metadata, ["provider"]) ?? "supabase";

  try {
    await upsertUser({
      openId: authUser.id,
      name,
      email,
      loginMethod: provider,
      lastSignedIn: new Date(),
    });
    const dbUser = await getUserByOpenId(authUser.id);
    if (dbUser) {
      return {
        id: dbUser.id,
        authId: authUser.id,
        name: dbUser.name,
        email: dbUser.email,
        loginMethod: dbUser.loginMethod,
        role: dbUser.role,
      };
    }
  } catch (error) {
    console.warn("[Auth] Usuário autenticado, mas o perfil no banco não pôde ser sincronizado:", error);
  }

  // Authentication can still work even if the profile tables have not been migrated yet.
  return {
    id: null,
    authId: authUser.id,
    name,
    email,
    loginMethod: provider,
    role: "user",
  };
}

export async function authenticateSupabaseRequest(req: Request, res: Response): Promise<AuthenticatedUser | null> {
  if (!ENV.supabaseUrl || !ENV.supabasePublishableKey) return null;
  let { accessToken, refreshToken } = getAuthCookies(req);

  let authUser = await getSupabaseUser(accessToken);
  if (!authUser && refreshToken) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (refreshed?.access_token && refreshed.refresh_token) {
      setSessionCookies(req, res, refreshed);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      authUser = refreshed.user ?? await getSupabaseUser(accessToken);
    } else {
      clearAuthCookies(req, res);
    }
  }

  if (!authUser) return null;
  return await toAuthenticatedUser(authUser);
}

export async function signOutSupabaseSession(req: Request, res: Response) {
  const { accessToken } = getAuthCookies(req);
  if (accessToken && ENV.supabaseUrl && ENV.supabasePublishableKey) {
    try {
      await fetch(`${ENV.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: supabaseHeaders(accessToken),
      });
    } catch (error) {
      console.warn("[Auth] Falha ao encerrar a sessão no Supabase:", error);
    }
  }
  clearAuthCookies(req, res);
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 6 && value.length <= 128;
}

export function registerSupabaseAuthRoutes(app: import("express").Express) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      assertSupabaseAuthConfigured();
      const { email, password } = req.body ?? {};
      if (!validEmail(email) || !validPassword(password)) {
        res.status(400).json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." });
        return;
      }

      const response = await fetch(`${ENV.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        res.status(response.status === 400 ? 401 : response.status).json({ error: await parseSupabaseError(response) });
        return;
      }

      const session = await response.json() as SupabaseSession;
      if (!session.access_token || !session.refresh_token) {
        res.status(502).json({ error: "O Supabase não retornou uma sessão válida." });
        return;
      }
      setSessionCookies(req, res, session);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Não foi possível entrar." });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      assertSupabaseAuthConfigured();
      const { email, password, name } = req.body ?? {};
      if (!validEmail(email) || !validPassword(password)) {
        res.status(400).json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." });
        return;
      }
      const safeName = typeof name === "string" ? name.trim().slice(0, 120) : "";

      const response = await fetch(`${ENV.supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: supabaseHeaders(),
        body: JSON.stringify({
          email,
          password,
          ...(safeName ? { data: { name: safeName } } : {}),
        }),
      });
      if (!response.ok) {
        res.status(response.status).json({ error: await parseSupabaseError(response) });
        return;
      }

      const result = await response.json() as SupabaseSession & { user?: SupabaseAuthUser };
      if (result.access_token && result.refresh_token) {
        setSessionCookies(req, res, result);
        res.json({ ok: true, requiresEmailConfirmation: false });
        return;
      }

      res.json({
        ok: true,
        requiresEmailConfirmation: true,
        message: "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
      });
    } catch (error) {
      console.error("[Auth] Signup failed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Não foi possível criar a conta." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    await signOutSupabaseSession(req, res);
    res.json({ ok: true });
  });
}
