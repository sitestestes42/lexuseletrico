const ACCESS_COOKIE = "lexus_access_token";
const REFRESH_COOKIE = "lexus_refresh_token";
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function env() {
  return {
    url: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    key: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

function authHeaders(key: string) {
  return { apikey: key, "content-type": "application/json" };
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as any;
    return body?.msg || body?.message || body?.error_description || body?.error || body?.code || `Supabase respondeu ${response.status}`;
  } catch { return `Supabase respondeu ${response.status}`; }
}

export async function POST(request: Request) {
  try {
    const { url, key } = env();
    if (!url || !key) return Response.json({ error: "SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY ausente no Vercel." }, { status: 500 });

    const body = await request.json().catch(() => ({})) as any;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken.trim() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 128) {
      return Response.json({ error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." }, { status: 400 });
    }
    if (!captchaToken) {
      return Response.json({ error: "Conclua a verificação hCaptcha antes de entrar." }, { status: 400 });
    }

    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({
        email,
        password,
        gotrue_meta_security: { captcha_token: captchaToken },
      }),
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: await errorMessage(response) }, { status: response.status === 400 ? 401 : response.status });

    const session = await response.json() as any;
    if (!session.access_token || !session.refresh_token) return Response.json({ error: "O Supabase não retornou uma sessão válida." }, { status: 502 });

    const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    headers.append("set-cookie", cookie(ACCESS_COOKIE, session.access_token, Math.max(60, Number(session.expires_in) || 3600)));
    headers.append("set-cookie", cookie(REFRESH_COOKIE, session.refresh_token, REFRESH_MAX_AGE));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (error) {
    console.error("[api/auth/login]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível entrar." }, { status: 500 });
  }
}
