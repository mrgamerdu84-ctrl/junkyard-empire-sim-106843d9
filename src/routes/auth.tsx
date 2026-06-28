import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "Connexion — My Taxi World : L'Empire des Rues" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [remember, setRemember] = useState(() => {
    try { return localStorage.getItem("auth.remember") !== "0"; } catch { return true; }
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  // Auto-login silencieux : si une session valide existe déjà, on file au jeu.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      try { localStorage.setItem("auth.remember", remember ? "1" : "0"); } catch {}
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { pseudo: pseudo.trim() || "Chauffeur" },
          },
        });
        if (error) throw error;
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Si l'utilisateur a décoché "Se souvenir", on purge la session au
        // prochain fermeture d'onglet en passant le stockage en sessionStorage.
        if (!remember) {
          try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
            for (const k of keys) {
              const v = localStorage.getItem(k);
              if (v) { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
            }
          } catch {}
        }
        navigate({ to: "/" });
      }
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) { setErr(String(result.error?.message ?? result.error)); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="auth-root">
      <style>{`
        .auth-root { min-height: 100vh; background: linear-gradient(180deg,#1a1f2e 0%,#0a0c10 100%); display:flex; align-items:center; justify-content:center; padding:20px; font-family: system-ui,sans-serif; }
        .auth-card { background:#111827; border:2px solid #f5c542; border-radius:16px; padding:28px; max-width:380px; width:100%; box-shadow:0 12px 40px rgba(0,0,0,0.6); }
        .auth-title { color:#f5c542; font-size:26px; font-weight:900; text-align:center; margin:0 0 6px; }
        .auth-sub { color:#9ca3af; text-align:center; font-size:13px; margin:0 0 20px; }
        .auth-tabs { display:flex; gap:6px; margin-bottom:18px; background:#0a0c10; padding:4px; border-radius:10px; }
        .auth-tab { flex:1; padding:8px; border:none; background:transparent; color:#9ca3af; font-weight:700; cursor:pointer; border-radius:7px; }
        .auth-tab.active { background:#f5c542; color:#1a1208; }
        .auth-input { width:100%; background:#0a0c10; border:2px solid #374151; border-radius:10px; padding:12px 14px; color:#fff; font-size:15px; outline:none; margin-bottom:10px; box-sizing:border-box; }
        .auth-input:focus { border-color:#f5c542; }
        .auth-btn { width:100%; border:none; cursor:pointer; background:linear-gradient(180deg,#f5c542 0%,#e0a92a 100%); color:#1a1208; font-weight:900; padding:13px; border-radius:10px; font-size:16px; text-transform:uppercase; margin-top:6px; }
        .auth-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .auth-google { background:#fff; color:#1f2937; display:flex; align-items:center; justify-content:center; gap:10px; }
        .auth-sep { text-align:center; color:#6b7280; font-size:12px; margin:14px 0; position:relative; }
        .auth-sep::before, .auth-sep::after { content:''; position:absolute; top:50%; width:38%; height:1px; background:#374151; }
        .auth-sep::before { left:0; } .auth-sep::after { right:0; }
        .auth-err { color:#fca5a5; background:#7f1d1d; border-radius:8px; padding:8px 12px; font-size:13px; margin-bottom:10px; }
        .auth-back { display:block; text-align:center; color:#9ca3af; margin-top:14px; font-size:13px; text-decoration:none; cursor:pointer; background:none; border:none; width:100%; }
      `}</style>
      <div className="auth-card">
        <h1 className="auth-title">🚕 My Taxi World : L'Empire des Rues</h1>
        <p className="auth-sub">Crée ton compte pour sauver tes scores</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "signin" ? "active" : ""}`} onClick={() => setMode("signin")}>Connexion</button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Inscription</button>
        </div>

        <button className="auth-btn auth-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C41 35 44 30 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
          Continuer avec Google
        </button>

        <div className="auth-sep">ou</div>

        {err && <div className="auth-err">{err}</div>}
        {info && <div className="auth-err" style={{ background:"#065f46", color:"#d1fae5" }}>{info}</div>}

        <form onSubmit={handleEmail}>
          {mode === "signup" && (
            <input className="auth-input" placeholder="Pseudo" maxLength={16} value={pseudo} onChange={(e) => setPseudo(e.target.value)} />
          )}
          <input className="auth-input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="auth-input" type="password" placeholder="Mot de passe" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "signin" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", fontSize: 13, margin: "4px 0 10px", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#f5c542", cursor: "pointer" }}
              />
              Se souvenir de moi (rester connecté)
            </label>
          )}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            className="auth-back"
            style={{ color: "#f5c542", marginTop: 10 }}
            onClick={async () => {
              setErr(null); setInfo(null);
              if (!email) { setErr("Entre ton email d'abord."); return; }
              setLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
              });
              setLoading(false);
              if (error) setErr(error.message);
              else { setInfo("📧 Email envoyé ! Vérifie ta boîte (et les spams)."); setShowReset(true); }
            }}
          >
            🔑 Mot de passe oublié ?
          </button>
        )}

        <button className="auth-back" onClick={() => navigate({ to: "/" })}>← Retour au jeu</button>
        {showReset && (
          <p style={{ color:"#9ca3af", fontSize:11, textAlign:"center", marginTop:8 }}>
            Tu recevras un lien pour choisir un nouveau mot de passe.
          </p>
        )}
      </div>
    </div>
  );
}
