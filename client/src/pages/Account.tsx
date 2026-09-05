import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CircleUserRound, LogOut, ShoppingBag } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) startLogin();
  }, [loading, isAuthenticated]);

  if (loading) return <div className="account-page"><div className="loading-card">Carregando sua conta…</div></div>;
  if (!isAuthenticated) return <div className="account-page"><div className="loading-card">Redirecionando para o login…</div></div>;

  return (
    <div className="account-page">
      <header className="checkout-header"><Link href="/" className="brand-mark"><span className="checkout-logo">L</span><span className="brand-name"><strong>Lexus</strong><span>Elétricos</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={16} /> Voltar à loja</Link></header>
      <main className="account-main"><div className="account-card"><div className="account-icon"><CircleUserRound size={28} /></div><div className="eyebrow">Minha conta</div><h1>Olá, {user?.name?.split(" ")[0] ?? "cliente"}.</h1><p>A sessão está ativa e pronta para proteger seu checkout.</p><div className="account-actions"><button className="button button-dark" onClick={() => setLocation("/checkout")}><ShoppingBag size={17} /> Ir para checkout</button><button className="button button-ghost" onClick={() => void logout()}><LogOut size={17} /> Sair</button></div></div></main>
    </div>
  );
}
