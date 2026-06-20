// ====== PARTIE QUE TU AS DÉJÀ (je la laisse ici pour le contexte) ======
let l = 'fr'; // tes radios mettent 'fr' ou 'en'
let text = ''; // le texte à lire
function wrapDone() {
  // ton code actuel quand la lecture finit
  console.log('[Radio] fini');
}

// ====== PICK VOICE - version safe ======
function pickVoice(lang) {
  if (typeof window === 'undefined' ||!window.speechSynthesis) return null;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const target = lang === 'en'? 'en' : 'fr';
    // 1. voix exacte, 2. fallback langue
    return voices.find(v => v.lang.toLowerCase() === (target === 'fr'? 'fr-fr' : 'en-us'))
        || voices.find(v => v.lang.toLowerCase().startsWith(target))
        || null;
  } catch { return null; }
}

// ====== SPEAK BROWSER - version qui ne crashe plus ======
const speakBrowser = () => {
  try {
    if (typeof window === 'undefined' ||!window.speechSynthesis) {
      wrapDone && wrapDone();
      return;
    }
    const synth = window.speechSynthesis;
    try { if (synth.speaking || synth.pending) synth.cancel(); } catch {}

    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = l === 'en'? 'en-US' : 'fr-FR';
    u.rate = 1; u.pitch = 1; u.volume = 1;

    u.onend = () => { try { wrapDone && wrapDone(); } catch {} };
    u.onerror = (e) => { console.warn('[Radio] TTS Error', e); try { wrapDone && wrapDone(); } catch {} };

    const doSpeak = () => {
      const v = pickVoice(l);
      if (v) u.voice = v;
      // délai après cancel, obligatoire sur iOS
      setTimeout(() => {
        try {
          synth.speak(u);
          if (synth.paused) synth.resume();
          // garde référence pour Safari
          window._currentTTS = u;
        } catch (e) { console.warn(e); wrapDone && wrapDone(); }
      }, 70);
    };

    const voices = synth.getVoices? synth.getVoices() : [];
    if (!voices.length) {
      // pas de {once:true} car ça plante sur certaines webviews
      synth.onvoiceschanged = () => {
        synth.onvoiceschanged = null;
        doSpeak();
      };
      try { synth.getVoices(); } catch {}
    } else {
      doSpeak();
    }
  } catch (err) {
    console.error('[Radio] crash speakBrowser', err);
    try { wrapDone && wrapDone(); } catch {}
  }
};

// ====== BRANCHEMENT DE TES RADIOS (si tu ne l'as pas déjà) ======
if (typeof document!== 'undefined') {
  document.querySelectorAll('input[name="lang"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      l = e.target.value; // 'fr' ou 'en'
    });
  });
}

// Précharge les voix une fois, sans bloquer
if (typeof window!== 'undefined') {
  try { window.speechSynthesis.getVoices(); } catch {}
}