const ACCESS_COOKIE = "lexus_access_token";

const PRODUCT_ID = "inow-1000w";
const UNIT_PRICE_CENTS = 359990;
const MAX_QUANTITY = 10;
const ALLOWED_VARIANTS = new Set(["Preto", "Caramelo"]);

type OrderLine = {
  productId: string;
  variant: "Preto" | "Caramelo";
  quantity: number;
};

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function env() {
  return {
    url: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    secretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  };
}

function parseCookies(header: string | null) {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(raw);
    } catch {
      result[key] = raw;
    }
  }
  return result;
}

function authHeaders(publishableKey: string, accessToken: string) {
  return {
    apikey: publishableKey,
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

function adminHeaders(secretKey: string, prefer?: string) {
  const headers: Record<string, string> = {
    apikey: secretKey,
    "content-type": "application/json",
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

async function responseDetails(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return `Supabase respondeu ${response.status}`;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const message = body.message ?? body.msg ?? body.error_description ?? body.error ?? body.code ?? body.hint;
    if (typeof message === "string" && message.trim()) return message;
  } catch {
    // Keep plain-text response below.
  }
  return text.slice(0, 500);
}

function isMissingDatabaseObject(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache") ||
    normalized.includes("relation") && normalized.includes("not") && normalized.includes("exist");
}

function validLine(value: unknown): value is OrderLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return line.productId === PRODUCT_ID &&
    typeof line.variant === "string" && ALLOWED_VARIANTS.has(line.variant) &&
    typeof line.quantity === "number" && Number.isInteger(line.quantity) &&
    line.quantity >= 1 && line.quantity <= MAX_QUANTITY;
}

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function getAuthenticatedUser(url: string, publishableKey: string, accessToken: string): Promise<AuthUser | null> {
  if (!accessToken) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: authHeaders(publishableKey, accessToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as AuthUser;
}

async function adminFetch(url: string, secretKey: string, path: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...adminHeaders(secretKey),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

function newOrderId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

export async function POST(request: Request) {
  try {
    const { url, publishableKey, secretKey } = env();
    if (!url || !publishableKey) {
      return Response.json({ error: "SUPABASE_URL ou SUPABASE_PUBLISHABLE_KEY ausente no Vercel." }, { status: 500 });
    }
    if (!secretKey) {
      return Response.json({ error: "SUPABASE_SECRET_KEY ausente no Vercel. Ela é necessária para gravar pedidos com segurança no servidor." }, { status: 500 });
    }

    const cookies = parseCookies(request.headers.get("cookie"));
    const accessToken = cookies[ACCESS_COOKIE] ?? "";
    const authUser = await getAuthenticatedUser(url, publishableKey, accessToken);
    if (!authUser?.id) {
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const rawLines = Array.isArray(body.lines) ? body.lines : [];

    if (idempotencyKey.length < 16 || idempotencyKey.length > 96 || rawLines.length < 1 || rawLines.length > 2 || !rawLines.every(validLine)) {
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const lines = rawLines as OrderLine[];
    const uniqueVariants = new Set(lines.map((line) => line.variant));
    if (uniqueVariants.size !== lines.length) {
      return Response.json({ error: "Cada variante deve aparecer apenas uma vez no pedido." }, { status: 400 });
    }

    // Price is always recalculated on the server; browser values are ignored.
    const totalCents = lines.reduce((total, line) => total + UNIT_PRICE_CENTS * line.quantity, 0);

    const email = typeof authUser.email === "string" ? authUser.email : null;
    const name = metadataString(authUser.user_metadata, ["name", "full_name", "display_name"]) ?? (email ? email.split("@")[0] : "Cliente");
    const loginMethod = metadataString(authUser.app_metadata, ["provider"]) ?? "email";
    const now = new Date().toISOString();

    // Sync the authenticated Supabase user into the application's users table.
    const upsertUserResponse = await fetch(`${url}/rest/v1/users?on_conflict=openId`, {
      method: "POST",
      headers: adminHeaders(secretKey, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({
        openId: authUser.id,
        name,
        email,
        loginMethod,
        lastSignedIn: now,
        updatedAt: now,
      }),
      cache: "no-store",
    });

    if (!upsertUserResponse.ok) {
      const detail = await responseDetails(upsertUserResponse);
      const status = isMissingDatabaseObject(detail) ? 412 : 500;
      return Response.json({
        error: status === 412
          ? "As tabelas do checkout ainda não foram criadas no Supabase. Execute o SQL de configuração do checkout no SQL Editor."
          : `Não foi possível sincronizar o usuário no banco: ${detail}`,
      }, { status });
    }

    const upsertedUsers = await upsertUserResponse.json().catch(() => []) as Array<{ id?: number }>;
    let userId = Number(upsertedUsers?.[0]?.id ?? 0);

    if (!Number.isInteger(userId) || userId <= 0) {
      const userLookup = await adminFetch(
        url,
        secretKey,
        `users?select=id&openId=eq.${encodeURIComponent(authUser.id)}&limit=1`,
      );
      if (!userLookup.ok) {
        const detail = await responseDetails(userLookup);
        return Response.json({ error: `Não foi possível localizar o usuário no banco: ${detail}` }, { status: 500 });
      }
      const rows = await userLookup.json().catch(() => []) as Array<{ id?: number }>;
      userId = Number(rows?.[0]?.id ?? 0);
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json({ error: "Usuário autenticado, mas não foi possível criar seu registro de cliente." }, { status: 500 });
    }

    // Idempotency prevents double-clicks / repeated requests from creating duplicate orders.
    const existingResponse = await adminFetch(
      url,
      secretKey,
      `orders?select=id,status,totalCents,userId&idempotencyKey=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
    );
    if (!existingResponse.ok) {
      const detail = await responseDetails(existingResponse);
      const status = isMissingDatabaseObject(detail) ? 412 : 500;
      return Response.json({
        error: status === 412
          ? "As tabelas do checkout ainda não foram criadas no Supabase. Execute o SQL de configuração do checkout no SQL Editor."
          : `Não foi possível consultar pedidos: ${detail}`,
      }, { status });
    }

    const existingRows = await existingResponse.json().catch(() => []) as Array<{ id: string; status: string; totalCents: number; userId: number }>;
    const existing = existingRows[0];
    if (existing) {
      if (Number(existing.userId) !== userId) {
        return Response.json({ error: "Chave de pedido inválida." }, { status: 409 });
      }
      return Response.json({
        orderId: existing.id,
        status: existing.status,
        total: existing.totalCents,
        message: "Este pedido já foi validado. Nenhum pedido duplicado foi criado.",
      });
    }

    const orderId = newOrderId();
    const createOrderResponse = await fetch(`${url}/rest/v1/orders`, {
      method: "POST",
      headers: adminHeaders(secretKey, "return=representation"),
      body: JSON.stringify({
        id: orderId,
        userId,
        totalCents,
        status: "pending",
        idempotencyKey,
      }),
      cache: "no-store",
    });

    if (!createOrderResponse.ok) {
      const detail = await responseDetails(createOrderResponse);
      const status = isMissingDatabaseObject(detail) ? 412 : 500;
      return Response.json({
        error: status === 412
          ? "As tabelas do checkout ainda não foram criadas no Supabase. Execute o SQL de configuração do checkout no SQL Editor."
          : `Não foi possível criar o pedido: ${detail}`,
      }, { status });
    }

    const createItemsResponse = await fetch(`${url}/rest/v1/order_items`, {
      method: "POST",
      headers: adminHeaders(secretKey, "return=minimal"),
      body: JSON.stringify(lines.map((line) => ({
        orderId,
        productId: line.productId,
        variant: line.variant,
        quantity: line.quantity,
        unitPriceCents: UNIT_PRICE_CENTS,
      }))),
      cache: "no-store",
    });

    if (!createItemsResponse.ok) {
      const detail = await responseDetails(createItemsResponse);
      // Best-effort rollback so a failed item insert doesn't leave a misleading pending order.
      await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: "DELETE",
        headers: adminHeaders(secretKey, "return=minimal"),
        cache: "no-store",
      }).catch(() => undefined);

      const status = isMissingDatabaseObject(detail) ? 412 : 500;
      return Response.json({
        error: status === 412
          ? "As tabelas do checkout ainda não foram criadas no Supabase. Execute o SQL de configuração do checkout no SQL Editor."
          : `Não foi possível salvar os itens do pedido: ${detail}`,
      }, { status });
    }

    return Response.json({
      orderId,
      status: "pending",
      total: totalCents,
      message: "Pedido criado com segurança. Agora gere o PIX para concluir o pagamento.",
    });
  } catch (error) {
    console.error("[api/orders/create]", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Não foi possível iniciar o pedido.",
    }, { status: 500 });
  }
}
