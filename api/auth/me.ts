import type { ApiRequest, ApiResponse } from "../../server/auth-serverless";
import { json, resolveSession } from "../../server/auth-serverless";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    json(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    const user = await resolveSession(req, res);
    json(res, 200, { user });
  } catch (error) {
    console.error("[api/auth/me]", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Não foi possível validar a sessão." });
  }
}
