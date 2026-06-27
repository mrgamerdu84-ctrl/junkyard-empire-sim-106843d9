import { useEffect, useRef, useState } from "react";
import tutorAsset from "@/assets/tutor-driver.png.asset.json";
import { markTutorialSeen } from "@/lib/leaderboard";

const STEPS = [
  {
    title: "Bienvenue dans My Taxi World Rivalité !",
    text: "Salut patron ! Je suis Léo, ton bras droit. Ici, tu ne pilotes pas un seul taxi : tu diriges toute une compagnie face à la Mafia qui veut ta peau. Suis le guide.",
  },
  {
    title: "Ton QG, le cœur de l'empire",
    text: "Au centre de la ville, ton entrepôt jaune. Toutes tes voitures dorment là. Clique dessus à tout moment pour rappeler instantanément la flotte au bercail.",
  },
  {
    title: "Embauche ton équipe (👥 ÉQUIPE)",
    text: "Chauffeurs, Mécanos, Managers, Secrétaires : chaque embauche débloque un taxi supplémentaire qui sort automatiquement chercher des clients. Plus tu embauches, plus la ville grouille de tes taxis jaunes.",
  },
  {
    title: "Les courses : auto-dispatch",
    text: "Quand un client apparaît, le taxi disponible le plus proche file le récupérer tout seul. Tu vois la flèche bleue (prise en charge) puis orange (destination). L'argent tombe à la dépose.",
  },
  {
    title: "🕹️ Mode PILOTE manuel",
    text: "Appuie sur PILOTE dans le tableau de bord : un taxi rose apparaît devant le QG, et tu le conduis avec ton doigt directement sur la carte. Idéal pour les missions stratégiques.",
  },
  {
    title: "⚠️ La menace Mafia",
    text: "Des voitures noires roulent dans la ville et tentent de saboter tes taxis en mission. Clique vite dessus pour les faire exploser avant qu'elles ne t'atteignent !",
  },
  {
    title: "🚚 Détourner le camion blindé",
    text: "Régulièrement, la Mafia transporte son butin vers son dépôt. Intercepte le camion, ramène-le à TON QG, et empoche le magot. Mais attention : la Mafia envoie 10 voitures pour le récupérer. Aucune ne doit arriver vivante à ton entrepôt.",
  },
  {
    title: "🎩 Le Parrain et la rançon",
    text: "Le Parrain de la Mafia apparaît sur ton écran et te propose une trêve de 1h contre 1 500 $. Si tu refuses : RAID immédiat de 10 voitures sur ton QG. À toi de toutes les détruire pour survivre.",
  },
  {
    title: "📻 Radio, contrats & profil",
    text: "Le tableau de bord LCD regroupe tout : radio (Célébrer Radio + Droit Libre), contrats spéciaux, profil joueur, équipe, et plein écran de la carte. Tout est à portée de pouce.",
  },
  {
    title: "⚔️ Arène Mondiale",
    text: "Quand tu te sens prêt, défie les autres compagnies du monde entier en multijoueur classé. Plus tu montes au classement ELO, plus tu deviens une légende du taxi. Bonne route, patron !",
  },
];

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
  utter.rate = 0.92;
  utter.pitch = 0.75;
  utter.volume = 1.0;
}

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
  } catch {}
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

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const handler = () => {};
    try { window.speechSynthesis.getVoices(); } catch {}
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
      cancelSpeak();
    };
  }, []);

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
        .td-text { color: #e5e7eb; font-size: 15px; line-height: 1.5; min-height: 140px; }
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
