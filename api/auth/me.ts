const ACCESS_COOKIE = "lexus_access_token";
const REFRESH_COOKIE = "lexus_refresh_token";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function env() {
  return {
    url: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    key: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

function parseCookies(header: string | null) {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function authHeaders(key: string, accessToken?: string) {
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function getUser(url: string, key: string, accessToken: string) {
  if (!accessToken) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: authHeaders(key, accessToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as any;
}

function normalizedUser(user: any) {
  const email = typeof user?.email === "string" ? user.email : null;
  const metadata = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const appMetadata = user?.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {};
  const name = [metadata.name, metadata.full_name, metadata.display_name]
    .find((v) => typeof v === "string" && v.trim())?.trim() ?? (email ? email.split("@")[0] : "Cliente");
  return {
    authId: String(user.id),
    name,
    email,
    loginMethod: typeof appMetadata.provider === "string" ? appMetadata.provider : "email",
    role: "user" as const,
  };
}

export async function GET(request: Request) {
  try {
    const { url, key } = env();
    if (!url || !key) {
      return Response.json({ user: null, configured: false, error: "Supabase não está configurado no Vercel." });
    }

    const cookies = parseCookies(request.headers.get("cookie"));
    let accessToken = cookies[ACCESS_COOKIE] ?? "";
    const refreshToken = cookies[REFRESH_COOKIE] ?? "";
    let user = await getUser(url, key, accessToken);
    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });

    if (!user && refreshToken) {
      const refresh = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: authHeaders(key),
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });

      if (refresh.ok) {
        const session = await refresh.json() as any;
        accessToken = typeof session.access_token === "string" ? session.access_token : "";
        const newRefresh = typeof session.refresh_token === "string" ? session.refresh_token : "";
        if (accessToken && newRefresh) {
          headers.append("set-cookie", cookie(ACCESS_COOKIE, accessToken, Math.max(60, Number(session.expires_in) || 3600)));
          headers.append("set-cookie", cookie(REFRESH_COOKIE, newRefresh, REFRESH_MAX_AGE));
          user = session.user ?? await getUser(url, key, accessToken);
        }
      } else {
        headers.append("set-cookie", clearCookie(ACCESS_COOKIE));
        headers.append("set-cookie", clearCookie(REFRESH_COOKIE));
      }
    }

    return new Response(JSON.stringify({ user: user ? normalizedUser(user) : null }), { status: 200, headers });
  } catch (error) {
    console.error("[api/auth/me]", error);
    return Response.json({ user: null, error: error instanceof Error ? error.message : "Falha ao validar sessão." }, { status: 500 });
  }
}
