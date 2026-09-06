import { nanoid } from "nanoid";
import { calculateServerTotal, PRODUCT_ID, productCatalog, type ProductVariant } from "../../shared/catalog";
import { getOrderByIdempotencyKey, getUserByOpenId, insertOrderWithItems, upsertUser } from "../../server/db";
import type { ApiRequest, ApiResponse } from "../../server/auth-serverless";
import { json, readJsonBody, resolveSession } from "../../server/auth-serverless";

type OrderLine = { productId: string; variant: ProductVariant; quantity: number };

function isLine(value: unknown): value is OrderLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return line.productId === PRODUCT_ID &&
    (line.variant === "Preto" || line.variant === "Caramelo") &&
    typeof line.quantity === "number" && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 10;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Método não permitido." });
    return;
  }

  try {
    const authUser = await resolveSession(req, res);
    if (!authUser) {
      json(res, 401, { error: "Faça login para continuar." });
      return;
    }

    const body = await readJsonBody(req);
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (idempotencyKey.length < 16 || idempotencyKey.length > 96 || lines.length < 1 || lines.length > 2 || !lines.every(isLine)) {
      json(res, 400, { error: "Pedido inválido." });
      return;
    }

    const uniqueVariants = new Set(lines.map((line) => line.variant));
    if (uniqueVariants.size !== lines.length) {
      json(res, 400, { error: "Cada variante deve aparecer apenas uma vez no pedido." });
      return;
    }

    await upsertUser({
      openId: authUser.authId,
      name: authUser.name,
      email: authUser.email,
      loginMethod: authUser.loginMethod,
      lastSignedIn: new Date(),
    });
    const dbUser = await getUserByOpenId(authUser.authId);
    if (!dbUser) {
      json(res, 412, { error: "A sessão está ativa, mas as tabelas do banco ainda não estão prontas. Aplique a migração do projeto no Supabase." });
      return;
    }

    const totalCents = calculateServerTotal(lines);
    if (totalCents <= 0) {
      json(res, 400, { error: "Não foi possível validar o valor do pedido." });
      return;
    }

    const existing = await getOrderByIdempotencyKey(dbUser.id, idempotencyKey);
    if (existing) {
      json(res, 200, {
        orderId: existing.id,
        status: existing.status,
        total: existing.totalCents,
        message: "Este pedido já foi validado. Nenhum pedido duplicado foi criado.",
      });
      return;
    }

    const orderId = nanoid(20);
    await insertOrderWithItems({
      id: orderId,
      userId: dbUser.id,
      totalCents,
      idempotencyKey,
      items: lines.map((line) => ({
        productId: line.productId,
        variant: line.variant,
        quantity: line.quantity,
        unitPriceCents: productCatalog.promotionalPriceCents,
      })),
    });

    json(res, 200, {
      orderId,
      status: "pending",
      total: totalCents,
      message: "Pedido validado e criado como pendente. O pagamento será conectado à PantePay na próxima etapa.",
    });
  } catch (error) {
    console.error("[api/orders/create]", error);
    json(res, 500, { error: error instanceof Error ? error.message : "Não foi possível iniciar o pedido." });
  }
}
