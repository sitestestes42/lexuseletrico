import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, Copy, LockKeyhole, ShieldCheck, ShoppingBag } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  cartTotal,
  formatBRL,
  getCartLineKey,
  getVariantImages,
  productCatalog,
  readCart,
  type CartLine,
} from "@shared/catalog";

type PixPayment = {
  orderId: string;
  transactionId?: string;
  status?: string;
  amount?: number;
  qrCodeBase64?: string;
  copyPaste?: string;
  expiresAt?: string;
};

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [lines] = useState<CartLine[]>(() => readCart());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [orderLoading, setOrderLoading] = useState(false);
  const [payment, setPayment] = useState<PixPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const total = useMemo(() => cartTotal(lines), [lines]);

  const copyPix = async () => {
    if (!payment?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o código PIX e copie manualmente.");
    }
  };

  const submitOrder = async () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (lines.length === 0) {
      setError("Adicione uma configuração ao carrinho antes de continuar.");
      return;
    }

    setOrderLoading(true);
    setError("");
    setSuccess("");
    setCopied(false);

    try {
      const orderResponse = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          idempotencyKey,
          lines: lines.map(({ productId, variant, quantity }) => ({ productId, variant, quantity })),
        }),
      });

      const orderData = await orderResponse.json().catch(() => ({})) as {
        orderId?: string;
        message?: string;
        error?: string;
      };

      if (orderResponse.status === 401) {
        startLogin();
        return;
      }
      if (!orderResponse.ok || !orderData.orderId) {
        throw new Error(orderData.error || "Não foi possível criar o pedido.");
      }

      const pixResponse = await fetch("/api/payments/pix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: orderData.orderId }),
      });

      const pixData = await pixResponse.json().catch(() => ({})) as PixPayment & { error?: string };
      if (pixResponse.status === 401) {
        startLogin();
        return;
      }
      if (!pixResponse.ok) {
        throw new Error(pixData.error || "O pedido foi criado, mas não foi possível gerar o PIX.");
      }

      setPayment(pixData);
      setSuccess("PIX gerado com segurança. Escaneie o QR Code ou use o código copia e cola abaixo.");
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setOrderLoading(false);
    }
  };

  const expiresLabel = payment?.expiresAt
    ? new Date(payment.expiresAt).toLocaleString("pt-BR")
    : null;

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <Link href="/" className="brand-mark" aria-label="Voltar para Lexus Elétricos">
          <span className="checkout-logo">L</span>
          <span className="brand-name"><strong>Lexus</strong><span>Elétricos</span></span>
        </Link>
        <div className="checkout-secure"><LockKeyhole size={15} /> Checkout seguro</div>
      </header>

      <main className="checkout-main">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Voltar para a loja</Link>

        <div className="checkout-grid">
          <section className="checkout-card checkout-form-card">
            <div className="eyebrow">Etapa final</div>
            <h1>{payment ? "Pague com PIX." : "Revise sua seleção."}</h1>
            <p className="checkout-lead">
              {payment
                ? "A cobrança foi criada diretamente pela PanteraPay. O pedido permanece pendente até a confirmação do pagamento."
                : "O pedido será recalculado no servidor usando o catálogo oficial antes de qualquer pagamento."}
            </p>

            {!isAuthenticated && !loading && (
              <div className="auth-callout">
                <ShieldCheck size={19} />
                <div>
                  <strong>Entre para continuar</strong>
                  <p>O checkout exige uma sessão autenticada para proteger o pedido.</p>
                  <button className="text-button" onClick={startLogin}>Entrar com sua conta <ArrowRight size={15} /></button>
                </div>
              </div>
            )}

            <div className="checkout-security-list">
              <div><ShieldCheck size={17} /><span>Preço validado no servidor</span></div>
              <div><ShieldCheck size={17} /><span>PIX criado pela PanteraPay</span></div>
              <div><ShieldCheck size={17} /><span>Credenciais nunca chegam ao navegador</span></div>
            </div>

            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status">{success}</div>}

            {payment ? (
              <div className="pix-panel">
                <div className="pix-panel-heading">
                  <div>
                    <span className="pix-kicker">PIX</span>
                    <strong>{formatBRL(payment.amount ?? total)}</strong>
                  </div>
                  <span className="pix-status">Aguardando pagamento</span>
                </div>

                {payment.qrCodeBase64 && (
                  <div className="pix-qr-wrap">
                    <img src={payment.qrCodeBase64} alt="QR Code PIX para pagamento" className="pix-qr" />
                  </div>
                )}

                {payment.copyPaste && (
                  <div className="pix-copy-area">
                    <label htmlFor="pix-code">PIX copia e cola</label>
                    <div className="pix-code-row">
                      <textarea id="pix-code" value={payment.copyPaste} readOnly rows={3} />
                      <button type="button" className="pix-copy-button" onClick={copyPix}>
                        {copied ? <Check size={17} /> : <Copy size={17} />}
                        {copied ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>
                )}

                {expiresLabel && <p className="pix-expiry">Validade informada pela PanteraPay: {expiresLabel}</p>}
                <p className="checkout-disclaimer">Não feche esta página até concluir o pagamento. A confirmação automática do status será conectada na etapa de webhook.</p>
              </div>
            ) : (
              <>
                <button
                  className="button button-dark button-wide checkout-submit"
                  onClick={submitOrder}
                  disabled={orderLoading || loading || lines.length === 0}
                >
                  {orderLoading ? "Gerando PIX…" : isAuthenticated ? "Pagar com PIX" : "Entrar e continuar"}
                  {!orderLoading && <ArrowRight size={17} />}
                </button>
                <p className="checkout-disclaimer">O navegador nunca define sozinho se um pagamento foi aprovado.</p>
              </>
            )}
          </section>

          <aside className="checkout-card order-summary">
            <div className="summary-heading"><h2>Resumo</h2><span>{lines.length} {lines.length === 1 ? "item" : "itens"}</span></div>
            {lines.length === 0 ? (
              <div className="empty-summary"><ShoppingBag size={28} /><p>Seu carrinho está vazio.</p><Link href="/" className="text-button">Voltar à loja <ArrowRight size={15} /></Link></div>
            ) : (
              <div className="summary-lines">
                {lines.map((line) => (
                  <div className="summary-line" key={getCartLineKey(line)}>
                    <img src={getVariantImages(line.variant)[0].src} alt="" />
                    <div><strong>INOW 1000W</strong><span>Cor {line.variant} · {line.quantity} un.</span></div>
                    <b>{formatBRL(line.totalCents)}</b>
                  </div>
                ))}
              </div>
            )}
            <div className="summary-total"><span>Total</span><strong>{formatBRL(total)}</strong></div>
            <p className="muted-note">
              <span className="summary-original-price">{formatBRL(productCatalog.originalPriceCents)}</span>{" "}
              por {formatBRL(productCatalog.promotionalPriceCents)} por unidade.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
