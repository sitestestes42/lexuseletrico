import type { ApiRequest, ApiResponse } from "../../server/auth-serverless";
import { json, supabaseLogout } from "../../server/auth-serverless";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    await supabaseLogout(req, res);
    json(res, 200, { ok: true });
  } catch (error) {
    console.error("[api/auth/logout]", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Não foi possível encerrar a sessão." });
  }
}
