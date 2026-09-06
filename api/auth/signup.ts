import type { ApiRequest, ApiResponse, SupabaseSession } from "../../server/auth-serverless";
import { json, parseSupabaseError, readJsonBody, setSessionCookies, supabaseSignup, validEmail, validPassword } from "../../server/auth-serverless";

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
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

    if (!validEmail(email) || !validPassword(password)) {
      json(res, 400, { error: "Informe um e-mail válido e uma senha com pelo menos 6 caracteres." });
      return;
    }

    const response = await supabaseSignup(email, password, name);
    if (!response.ok) {
      json(res, response.status, { error: await parseSupabaseError(response) });
      return;
    }

    const result = await response.json() as SupabaseSession;
    if (result.access_token && result.refresh_token) {
      setSessionCookies(req, res, result);
      json(res, 200, { ok: true, requiresEmailConfirmation: false });
      return;
    }

    json(res, 200, {
      ok: true,
      requiresEmailConfirmation: true,
      message: "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
    });
  } catch (error) {
    console.error("[api/auth/signup]", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Não foi possível criar a conta." });
  }
}
