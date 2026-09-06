const ACCESS_COOKIE = "lexus_access_token";
const REFRESH_COOKIE = "lexus_refresh_token";

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

function clearCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function POST(request: Request) {
  try {
    const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
    const cookies = parseCookies(request.headers.get("cookie"));
    const access = cookies[ACCESS_COOKIE] ?? "";

    if (url && key && access) {
      try {
        await fetch(`${url}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: key, authorization: `Bearer ${access}`, "content-type": "application/json" },
          cache: "no-store",
        });
      } catch (error) {
        console.warn("[api/auth/logout] Supabase logout failed", error);
      }
    }

    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    headers.append("set-cookie", clearCookie(ACCESS_COOKIE));
    headers.append("set-cookie", clearCookie(REFRESH_COOKIE));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error) {
    console.error("[api/auth/logout]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível sair." }, { status: 500 });
  }
}
