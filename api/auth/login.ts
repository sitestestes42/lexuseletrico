import type { ApiRequest, ApiResponse, SupabaseSession } from "../../server/auth-serverless";
import { json, parseSupabaseError, readJsonBody, setSessionCookies, supabasePasswordLogin, validEmail, validPassword } from "../../server/auth-serverless";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = typeof body.email === "string" ? body.email.trim() : body.email;
    const password = body.password;
    if (!validEmail(email) || !validPassword(password)) {
      json(res, 400, { error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." });
      return;
    }

    const response = await supabasePasswordLogin(email, password);
    if (!response.ok) {
      json(res, response.status === 400 ? 401 : response.status, { error: await parseSupabaseError(response) });
      return;
    }

    const session = await response.json() as SupabaseSession;
    if (!session.access_token || !session.refresh_token) {
      json(res, 502, { error: "O Supabase não retornou uma sessão válida." });
      return;
    }

    setSessionCookies(req, res, session);
    json(res, 200, { ok: true });
  } catch (error) {
    console.error("[api/auth/login]", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Não foi possível entrar." });
  }
}
