import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck, ShoppingBag } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  cartTotal,
  formatBRL,
  getCartLineKey,
  getVariantImages,
  readCart,
  type CartLine,
} from "@shared/catalog";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [lines] = useState<CartLine[]>(() => readCart());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (result) => {
      setSuccess(result.message);
      setError("");
    },
    onError: (mutationError) => {
      setError(mutationError.message || "Não foi possível iniciar o pedido.");
      setSuccess("");
    },
  });
  const total = useMemo(() => cartTotal(lines), [lines]);

  const submitOrder = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    if (lines.length === 0) {
      setError("Adicione uma configuração ao carrinho antes de continuar.");
      return;
    }
    createOrder.mutate({
      idempotencyKey,
      lines: lines.map(({ productId, variant, quantity }) => ({ productId, variant, quantity })),
    });
  };

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
            <h1>Revise sua seleção.</h1>
            <p className="checkout-lead">O pedido será recalculado no servidor usando o catálogo oficial antes de qualquer pagamento.</p>
            {!isAuthenticated && !loading && (
              <div className="auth-callout"><ShieldCheck size={19} /><div><strong>Entre para continuar</strong><p>O checkout exige uma sessão autenticada para proteger o pedido.</p><button className="text-button" onClick={startLogin}>Entrar com sua conta <ArrowRight size={15} /></button></div></div>
            )}
            <div className="checkout-security-list"><div><ShieldCheck size={17} /><span>Preço validado no servidor</span></div><div><ShieldCheck size={17} /><span>Pagamento só é confirmado pelo provedor</span></div><div><ShieldCheck size={17} /><span>Credenciais nunca chegam ao navegador</span></div></div>
            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status">{success}</div>}
            <button className="button button-dark button-wide checkout-submit" onClick={submitOrder} disabled={createOrder.isPending || loading || lines.length === 0}>
              {createOrder.isPending ? "Validando pedido…" : isAuthenticated ? "Validar pedido" : "Entrar e continuar"}
              {!createOrder.isPending && <ArrowRight size={17} />}
            </button>
            <p className="checkout-disclaimer">Nenhum pagamento é considerado aprovado por uma informação enviada pelo navegador.</p>
          </section>
          <aside className="checkout-card order-summary">
            <div className="summary-heading"><h2>Resumo</h2><span>{lines.length} {lines.length === 1 ? "item" : "itens"}</span></div>
            {lines.length === 0 ? <div className="empty-summary"><ShoppingBag size={28} /><p>Seu carrinho está vazio.</p><Link href="/" className="text-button">Voltar à loja <ArrowRight size={15} /></Link></div> : <div className="summary-lines">{lines.map((line) => <div className="summary-line" key={getCartLineKey(line)}><img src={getVariantImages(line.variant)[0].src} alt="" /><div><strong>INOW 1000W</strong><span>Cor {line.variant} · {line.quantity} un.</span></div><b>{formatBRL(line.totalCents)}</b></div>)}</div>}
            <div className="summary-total"><span>Total</span><strong>{formatBRL(total)}</strong></div>
            <p className="muted-note">Valor promocional informado: R$ 1.550,00 por unidade.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}
