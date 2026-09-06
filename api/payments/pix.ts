const ACCESS_COOKIE = "lexus_access_token";

type AuthUser = {
  id: string;
  email?: string | null;
};

type OrderRow = {
  id: string;
  userId: number;
  totalCents: number;
  status: string;
  providerReference?: string | null;
};

type PanteraTransaction = {
  status?: string;
  id?: string;
  amount?: number;
  qrCodeBase64?: string;
  copyPaste?: string;
  expiresAt?: string;
  fee?: number;
  storeId?: string;
  message?: string;
  error?: string;
};

function env() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
    panteraApiUrl: (process.env.PANTEPAY_API_URL ?? "").replace(/\/+$/, ""),
    panteraSecretKey: process.env.PANTEPAY_SECRET_KEY ?? "",
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

function adminHeaders(secretKey: string, prefer?: string) {
  const headers: Record<string, string> = {
    apikey: secretKey,
    "content-type": "application/json",
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

function transactionsUrl(apiUrl: string) {
  return /\/transactions$/i.test(apiUrl) ? apiUrl : `${apiUrl}/transactions`;
}

async function getAuthenticatedUser(
  url: string,
  publishableKey: string,
  accessToken: string,
): Promise<AuthUser | null> {
  if (!accessToken) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as AuthUser;
}

async function readJson(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function providerError(body: Record<string, unknown>, status: number) {
  const candidates = [body.message, body.error, body.error_description, body.detail];
  const message = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof message === "string" ? message : `PanteraPay respondeu ${status}.`;
}

function publicPayment(transaction: PanteraTransaction, orderId: string) {
  return {
    orderId,
    transactionId: transaction.id,
    status: transaction.status ?? "pending",
    amount: transaction.amount,
    qrCodeBase64: transaction.qrCodeBase64,
    copyPaste: transaction.copyPaste,
    expiresAt: transaction.expiresAt,
  };
}

export async function POST(request: Request) {
  try {
    const {
      supabaseUrl,
      supabasePublishableKey,
      supabaseSecretKey,
      panteraApiUrl,
      panteraSecretKey,
    } = env();

    if (!supabaseUrl || !supabasePublishableKey || !supabaseSecretKey) {
      return Response.json({ error: "Configuração do Supabase incompleta no Vercel." }, { status: 500 });
    }
    if (!panteraApiUrl || !panteraSecretKey) {
      return Response.json({ error: "Configuração da PanteraPay incompleta no Vercel." }, { status: 500 });
    }

    const cookies = parseCookies(request.headers.get("cookie"));
    const authUser = await getAuthenticatedUser(
      supabaseUrl,
      supabasePublishableKey,
      cookies[ACCESS_COOKIE] ?? "",
    );
    if (!authUser?.id) {
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!/^[a-zA-Z0-9_-]{8,32}$/.test(orderId)) {
      return Response.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id&openId=eq.${encodeURIComponent(authUser.id)}&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(supabaseSecretKey),
        cache: "no-store",
      },
    );
    if (!userResponse.ok) {
      return Response.json({ error: "Não foi possível localizar o cliente." }, { status: 500 });
    }
    const users = await userResponse.json().catch(() => []) as Array<{ id?: number }>;
    const userId = Number(users[0]?.id ?? 0);
    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json({ error: "Cliente não encontrado para este pedido." }, { status: 404 });
    }

    const orderResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=id,userId,totalCents,status,providerReference&id=eq.${encodeURIComponent(orderId)}&userId=eq.${userId}&limit=1`,
      {
        method: "GET",
        headers: adminHeaders(supabaseSecretKey),
        cache: "no-store",
      },
    );
    if (!orderResponse.ok) {
      return Response.json({ error: "Não foi possível consultar o pedido." }, { status: 500 });
    }

    const orders = await orderResponse.json().catch(() => []) as OrderRow[];
    const order = orders[0];
    if (!order) {
      return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (order.status === "paid") {
      return Response.json({ error: "Este pedido já está pago." }, { status: 409 });
    }
    if (!Number.isInteger(order.totalCents) || order.totalCents <= 0) {
      return Response.json({ error: "Valor do pedido inválido." }, { status: 500 });
    }

    const txUrl = transactionsUrl(panteraApiUrl);

    // If a charge already exists for this order, retrieve it instead of creating a duplicate PIX.
    if (order.providerReference) {
      const existingPaymentResponse = await fetch(
        `${txUrl}/${encodeURIComponent(order.providerReference)}`,
        {
          method: "GET",
          headers: {
            Authorization: panteraSecretKey,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );
      const existingBody = await readJson(existingPaymentResponse);
      if (existingPaymentResponse.ok) {
        const transaction = existingBody as PanteraTransaction;
        if (transaction.copyPaste || transaction.qrCodeBase64) {
          return Response.json(publicPayment(transaction, orderId));
        }
      }

      return Response.json({
        error: "Já existe uma cobrança PIX vinculada a este pedido, mas não foi possível recuperá-la. Evitamos criar outra cobrança para não duplicar o pagamento.",
      }, { status: 409 });
    }

    const paymentResponse = await fetch(txUrl, {
      method: "POST",
      headers: {
        Authorization: panteraSecretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: order.totalCents }),
      cache: "no-store",
    });

    const paymentBody = await readJson(paymentResponse);
    if (!paymentResponse.ok) {
      return Response.json({
        error: `A PanteraPay não conseguiu criar o PIX: ${providerError(paymentBody, paymentResponse.status)}`,
      }, { status: 502 });
    }

    const transaction = paymentBody as PanteraTransaction;
    if (!transaction.id || (!transaction.copyPaste && !transaction.qrCodeBase64)) {
      return Response.json({
        error: "A PanteraPay criou uma resposta inesperada e o PIX não pôde ser exibido.",
      }, { status: 502 });
    }

    const saveReferenceResponse = await fetch(
      `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&userId=eq.${userId}`,
      {
        method: "PATCH",
        headers: adminHeaders(supabaseSecretKey, "return=minimal"),
        body: JSON.stringify({
          providerReference: transaction.id,
          updatedAt: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

    if (!saveReferenceResponse.ok) {
      // The PIX exists at the provider, so never create another one automatically here.
      console.error("[api/payments/pix] PIX criado, mas providerReference não foi salvo", transaction.id);
      return Response.json({
        error: "O PIX foi criado, mas não conseguimos vinculá-lo ao pedido. Não tente pagar novamente; contate o suporte.",
      }, { status: 500 });
    }

    return Response.json(publicPayment(transaction, orderId), { status: 201 });
  } catch (error) {
    console.error("[api/payments/pix]", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Não foi possível gerar o PIX.",
    }, { status: 500 });
  }
}
