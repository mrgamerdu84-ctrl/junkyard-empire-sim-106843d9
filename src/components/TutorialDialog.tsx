import { useEffect, useRef, useState } from "react";
import tutorAsset from "@/assets/tutor-driver.png.asset.json";
import { markTutorialSeen } from "@/lib/leaderboard";

const STEPS = [
  {
    title: "Salut, chauffeur !",
    text: "Bienvenue dans Junky City Empire ! Je suis Léo, vétéran du volant. Je vais te montrer les ficelles du métier en deux minutes.",
  },
  {
    title: "Ton QG, ton garage",
    text: "Tu démarres avec un garage délabré et un seul taxi. Plus tu encaisses, plus tu débloques de niveaux de QG (jusqu'à 12 taxis simultanés) et de meilleurs tarifs.",
  },
  {
    title: "Prendre un client",
    text: "Les clients t'attendent sur les trottoirs (point bleu). Le taxi le plus proche est envoyé automatiquement. Le client n'a que 35 secondes de patience !",
  },
  {
    title: "Déposer & encaisser",
    text: "Une fois chargé, file vers la destination (point jaune). Le tarif dépend de la distance et de ton niveau de QG. L'argent tombe à la dépose.",
  },
  {
    title: "Attention, la concurrence !",
    text: "La ville est envahie par les QG rivaux de Junky City. Leurs taxis sombres sont plus rapides à chaque niveau que tu gagnes. Ils chassent les mêmes clients que toi.",
  },
  {
    title: "Missions d'urgence : sois rapide !",
    text: "Crime, accident, incendie : quand une icône apparaît, clique vite ! Si tu attends trop, c'est l'IA qui rafle la mission et toi tu prends une pénalité de 200 dollars.",
  },
  {
    title: "Pénalité croisée",
    text: "Inverse la vapeur : si tu cliques la mission avant l'IA et que ton véhicule arrive sur place, tu gagnes 500 dollars de bonus. Plus tu es rapide, plus l'empire grossit !",
  },
  {
    title: "Récompense hebdomadaire",
    text: "Chaque dimanche soir, le meilleur jour de la semaine débloque le TAXI D'OR : bonus tarif plus 50 pour cent et conso moins 30 pour cent. À toi de jouer !",
  },
];

// Préfère une voix masculine française "vétéran/autoritaire".
// Beaucoup de navigateurs nomment les voix : "Thomas", "Daniel", "Paul",
// "Henri", "Nicolas", ou exposent un champ "Male". On les détecte par nom,
// avec repli sur la première voix française disponible.
const MALE_FR_HINTS = /(thomas|daniel|paul|henri|nicolas|jean|pierre|google.*français.*homme|male|homme|guillaume|sébastien|antoine)/i;
const FEMALE_FR_HINTS = /(amelie|amélie|audrey|marie|julie|virginie|female|femme|aurélie|aurelie|céline|celine)/i;

function pickFrenchMaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const fr = voices.filter(v => /^fr/i.test(v.lang));
  return (
    fr.find(v => MALE_FR_HINTS.test(v.name)) ||
    fr.find(v => !FEMALE_FR_HINTS.test(v.name)) ||
    voices.find(v => MALE_FR_HINTS.test(v.name)) ||
    fr[0] ||
    null
  );
}

function applyVeteranTone(utter: SpeechSynthesisUtterance) {
  utter.lang = "fr-FR";
  utter.rate = 0.92;   // un peu plus lent
  utter.pitch = 0.75;  // grave, autoritaire
  utter.volume = 1.0;
}

// Helper unique : ne touche jamais à SpeechSynthesisUtterance si l'API
// n'existe pas (preview sandbox, iOS lockdown, navigateurs anciens…).
// Toute erreur est avalée — le tuto ne doit JAMAIS crasher la page.
function speakStep(title: string, text: string) {
  try {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;
    try { synth.cancel(); } catch {}
    const utter = new window.SpeechSynthesisUtterance(`${title}. ${text}`);
    applyVeteranTone(utter);
    const v = pickFrenchMaleVoice();
    if (v) utter.voice = v;
    synth.speak(utter);
  } catch {
    /* silencieux : pas de voix dispo, on n'empêche pas le tuto */
  }
}

function cancelSpeak() {
  try {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
  } catch {}
}

export default function TutorialDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Charge les voix dès l'ouverture
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const handler = () => { /* trigger voices load */ };
    try { window.speechSynthesis.getVoices(); } catch {}
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
      cancelSpeak();
    };
  }, []);

  // Lit chaque étape à voix haute
  useEffect(() => {
    if (mutedRef.current) { cancelSpeak(); return; }
    speakStep(s.title, s.text);
  }, [step, s.title, s.text]);

  const toggleMute = () => {
    const nm = !mutedRef.current;
    mutedRef.current = nm;
    setMuted(nm);
    if (nm) cancelSpeak();
    else speakStep(s.title, s.text);
  };

  const stopVoice = cancelSpeak;

  const next = () => {
    stopVoice();
    if (last) {
      markTutorialSeen();
      onClose();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => {
    stopVoice();
    markTutorialSeen();
    onClose();
  };

  return (
    <div className="td-root">
      <style>{`
        .td-root { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px; font-family: system-ui, sans-serif; }
        .td-card { background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border: 2px solid #f5c542; border-radius: 16px; max-width: 480px; width: 100%; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); }
        .td-head { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
        .td-avatar { width: 80px; height: 80px; border-radius: 50%; border: 3px solid #f5c542; background: #fff; flex-shrink: 0; object-fit: cover; }
        .td-title { color: #f5c542; font-size: 20px; font-weight: 900; margin: 0; }
        .td-step { color: #9ca3af; font-size: 12px; display: flex; align-items: center; gap: 8px; }
        .td-mute { background: transparent; border: 1px solid #374151; color: #9ca3af; border-radius: 6px; padding: 2px 8px; cursor: pointer; font-size: 12px; }
        .td-mute:hover { color: #f5c542; border-color: #f5c542; }
        .td-text { color: #e5e7eb; font-size: 15px; line-height: 1.5; min-height: 110px; }
        .td-dots { display: flex; gap: 6px; justify-content: center; margin: 16px 0 14px; flex-wrap: wrap; }
        .td-dot { width: 8px; height: 8px; border-radius: 50%; background: #374151; }
        .td-dot.active { background: #f5c542; }
        .td-btns { display: flex; gap: 10px; }
        .td-btn { flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; font-size: 15px; }
        .td-btn.skip { background: #374151; color: #d1d5db; }
        .td-btn.next { background: linear-gradient(180deg, #f5c542, #e0a92a); color: #1a1208; box-shadow: 0 3px 0 #8a6510; }
        .td-btn.next:active { transform: translateY(2px); box-shadow: 0 1px 0 #8a6510; }
      `}</style>
      <div className="td-card">
        <div className="td-head">
          <img src={tutorAsset.url} alt="Léo" className="td-avatar" />
          <div style={{ flex: 1 }}>
            <h2 className="td-title">{s.title}</h2>
            <div className="td-step">
              <span>Étape {step + 1} / {STEPS.length}</span>
              <button className="td-mute" onClick={toggleMute} title={muted ? "Réactiver la voix" : "Couper la voix"}>
                {muted ? "🔇 Voix" : "🔊 Voix"}
              </button>
            </div>
          </div>
        </div>
        <div className="td-text">{s.text}</div>
        <div className="td-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={`td-dot ${i === step ? "active" : ""}`} />
          ))}
        </div>
        <div className="td-btns">
          {!last && <button className="td-btn skip" onClick={skip}>Passer</button>}
          <button className="td-btn next" onClick={next}>{last ? "Commencer ▶" : "Suivant →"}</button>
        </div>
      </div>
    </div>
  );
}
