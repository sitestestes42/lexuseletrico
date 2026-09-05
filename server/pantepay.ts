import { ENV } from "./_core/env";

/**
 * Configuração server-side da PantePay.
 *
 * Preencha estes valores em Settings → Secrets / Environment Variables:
 * - PANTEPAY_API_URL
 * - PANTEPAY_SECRET_KEY
 * - PANTEPAY_WEBHOOK_SECRET
 *
 * A chamada de pagamento ainda não é executada neste arquivo porque o endpoint,
 * payload e assinatura oficiais da PantePay precisam vir da documentação do provedor.
 */
export function getPantePayConfig() {
  return {
    apiUrl: ENV.pantepayApiUrl,
    secretKeyConfigured: Boolean(ENV.pantepaySecretKey),
    webhookSecretConfigured: Boolean(ENV.pantepayWebhookSecret),
  };
}

export function assertPantePayConfigured() {
  if (!ENV.pantepayApiUrl || !ENV.pantepaySecretKey) {
    throw new Error(
      "PantePay não configurada. Adicione PANTEPAY_API_URL e PANTEPAY_SECRET_KEY em Settings → Secrets / Environment Variables.",
    );
  }
}
