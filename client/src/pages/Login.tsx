import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { consumeLoginReturnPath } from "@/const";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "signup";

type AuthResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
};

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password, ...(mode === "signup" ? { name: name.trim() } : {}) }),
      });
      const data = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a autenticação.");

      if (data.requiresEmailConfirmation) {
        setSuccess(data.message || "Conta criada. Confirme seu e-mail e depois entre.");
        setMode("login");
        setPassword("");
        return;
      }

      await utils.auth.me.invalidate();
      setLocation(consumeLoginReturnPath());
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível concluir a autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="checkout-header">
        <Link href="/" className="brand-mark" aria-label="Voltar para Lexus Elétricos">
          <span className="checkout-logo">L</span>
          <span className="brand-name"><strong>Lexus</strong><span>Elétricos</span></span>
        </Link>
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Voltar à loja</Link>
      </header>

      <main className="auth-main">
        <section className="auth-card">
          <div className="auth-icon"><LockKeyhole size={23} /></div>
          <div className="eyebrow">Conta Lexus</div>
          <h1>{mode === "login" ? "Entre para continuar." : "Crie sua conta."}</h1>
          <p>{mode === "login" ? "Sua sessão é protegida pelo Supabase Auth e usada no checkout." : "Use seu e-mail para criar uma conta e acompanhar o checkout com segurança."}</p>

          <div className="auth-tabs" role="tablist" aria-label="Tipo de acesso">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Entrar</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Criar conta</button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Nome</span>
                <div><UserRound size={17} /><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Seu nome" /></div>
              </label>
            )}
            <label className="auth-field">
              <span>E-mail</span>
              <div><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={320} placeholder="voce@exemplo.com" /></div>
            </label>
            <label className="auth-field">
              <span>Senha</span>
              <div><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} maxLength={128} placeholder="Mínimo de 6 caracteres" /></div>
            </label>

            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status">{success}</div>}

            <button className="button button-dark button-wide auth-submit" type="submit" disabled={loading}>
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>
          <small className="auth-note">A senha é enviada apenas ao endpoint de autenticação e não é armazenada pelo site.</small>
        </section>
      </main>
    </div>
  );
}
