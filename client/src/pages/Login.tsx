import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { consumeLoginReturnPath } from "@/const";

type Mode = "login" | "signup";

type AuthResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
};

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark";
    },
  ) => string | number;
  reset: (widgetId?: string | number) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

const HCAPTCHA_SCRIPT_ID = "lexus-hcaptcha-script";
const FALLBACK_HCAPTCHA_SITEKEY = "089a13f6-f6e0-4982-9604-b9e4f5021192";

function loadHCaptcha() {
  if (window.hcaptcha) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const waitForApi = () => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.hcaptcha) {
          window.clearInterval(timer);
          resolve();
        } else if (attempts > 100) {
          window.clearInterval(timer);
          reject(new Error("O hCaptcha demorou demais para carregar."));
        }
      }, 50);
    };

    const existing = document.getElementById(HCAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      waitForApi();
      return;
    }

    const script = document.createElement("script");
    script.id = HCAPTCHA_SCRIPT_ID;
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = waitForApi;
    script.onerror = () => reject(new Error("Não foi possível carregar o hCaptcha."));
    document.head.appendChild(script);
  });
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetRef = useRef<string | number | null>(null);

  const sitekey = (import.meta.env.VITE_HCAPTCHA_SITEKEY || FALLBACK_HCAPTCHA_SITEKEY).trim();

  useEffect(() => {
    let cancelled = false;
    setCaptchaToken("");
    setCaptchaReady(false);

    const mountCaptcha = async () => {
      try {
        await loadHCaptcha();
        if (cancelled || !captchaContainerRef.current || !window.hcaptcha) return;

        captchaContainerRef.current.innerHTML = "";
        captchaWidgetRef.current = window.hcaptcha.render(captchaContainerRef.current, {
          sitekey,
          theme: "light",
          callback: (token) => {
            setCaptchaToken(token);
            setError("");
          },
          "expired-callback": () => setCaptchaToken(""),
          "error-callback": () => {
            setCaptchaToken("");
            setError("Não foi possível validar o hCaptcha. Tente novamente.");
          },
        });
        setCaptchaReady(true);
      } catch (captchaError) {
        if (!cancelled) {
          setError(captchaError instanceof Error ? captchaError.message : "Não foi possível carregar o hCaptcha.");
        }
      }
    };

    mountCaptcha();

    return () => {
      cancelled = true;
      captchaWidgetRef.current = null;
      if (captchaContainerRef.current) captchaContainerRef.current.innerHTML = "";
    };
  }, [mode, sitekey]);

  const resetCaptcha = () => {
    setCaptchaToken("");
    if (window.hcaptcha && captchaWidgetRef.current !== null) {
      try {
        window.hcaptcha.reset(captchaWidgetRef.current);
      } catch {
        // O widget pode ter sido desmontado durante uma navegação.
      }
    }
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setCaptchaToken("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!captchaToken) {
      setError("Confirme o hCaptcha antes de continuar.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          captchaToken,
          ...(mode === "signup" ? { name: name.trim() } : {}),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as AuthResponse;
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a autenticação.");

      if (data.requiresEmailConfirmation) {
        setSuccess(data.message || "Conta criada. Confirme seu e-mail e depois entre.");
        setMode("login");
        setPassword("");
        resetCaptcha();
        return;
      }

      setLocation(consumeLoginReturnPath());
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Não foi possível concluir a autenticação.");
      resetCaptcha();
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
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Entrar</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Criar conta</button>
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

            <div className="captcha-block">
              <div className="captcha-label"><ShieldCheck size={15} /><span>Verificação de segurança</span></div>
              <div className="captcha-frame" ref={captchaContainerRef} aria-label="hCaptcha" />
              {!captchaReady && <small>Carregando verificação…</small>}
            </div>

            {error && <div className="form-message error" role="alert">{error}</div>}
            {success && <div className="form-message success" role="status">{success}</div>}

            <button className="button button-dark button-wide auth-submit" type="submit" disabled={loading || !captchaReady}>
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
