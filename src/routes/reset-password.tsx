import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Nouveau mot de passe — My Taxi World : L'Empire des Rues" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase pose la session via le hash de l'URL (type=recovery)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasSession(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr("6 caractères minimum."); return; }
    if (password !== confirm) { setErr("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setOk(true);
    setTimeout(() => navigate({ to: "/" }), 1800);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(180deg,#1a1f2e 0%,#0a0c10 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"system-ui,sans-serif" }}>
      <div style={{ background:"#111827", border:"2px solid #f5c542", borderRadius:16, padding:28, maxWidth:380, width:"100%", boxShadow:"0 12px 40px rgba(0,0,0,0.6)" }}>
        <h1 style={{ color:"#f5c542", fontSize:24, fontWeight:900, textAlign:"center", margin:"0 0 8px" }}>🔑 Nouveau mot de passe</h1>
        <p style={{ color:"#9ca3af", textAlign:"center", fontSize:13, margin:"0 0 20px" }}>
          Choisis ton nouveau mot de passe.
        </p>

        {!hasSession && !ok && (
          <div style={{ color:"#fca5a5", background:"#7f1d1d", borderRadius:8, padding:10, fontSize:13, marginBottom:10 }}>
            ⚠️ Ce lien est invalide ou expiré. Demande un nouveau lien depuis la page de connexion.
          </div>
        )}

        {ok ? (
          <div style={{ color:"#d1fae5", background:"#065f46", borderRadius:8, padding:12, textAlign:"center" }}>
            ✅ Mot de passe modifié ! Redirection…
          </div>
        ) : (
          <form onSubmit={submit}>
            {err && <div style={{ color:"#fca5a5", background:"#7f1d1d", borderRadius:8, padding:8, fontSize:13, marginBottom:10 }}>{err}</div>}
            <input
              style={{ width:"100%", background:"#0a0c10", border:"2px solid #374151", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:15, outline:"none", marginBottom:10, boxSizing:"border-box" }}
              type="password" placeholder="Nouveau mot de passe" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={!hasSession}
            />
            <input
              style={{ width:"100%", background:"#0a0c10", border:"2px solid #374151", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:15, outline:"none", marginBottom:10, boxSizing:"border-box" }}
              type="password" placeholder="Confirmer" required minLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!hasSession}
            />
            <button
              type="submit" disabled={loading || !hasSession}
              style={{ width:"100%", border:"none", cursor: hasSession ? "pointer":"not-allowed", background:"linear-gradient(180deg,#f5c542 0%,#e0a92a 100%)", color:"#1a1208", fontWeight:900, padding:13, borderRadius:10, fontSize:16, textTransform:"uppercase", opacity: hasSession && !loading ? 1 : 0.6 }}
            >
              {loading ? "..." : "Valider"}
            </button>
          </form>
        )}

        <button onClick={() => navigate({ to: "/auth" })} style={{ display:"block", width:"100%", textAlign:"center", color:"#9ca3af", marginTop:14, fontSize:13, background:"none", border:"none", cursor:"pointer" }}>
          ← Retour à la connexion
        </button>
      </div>
    </div>
  );
}
