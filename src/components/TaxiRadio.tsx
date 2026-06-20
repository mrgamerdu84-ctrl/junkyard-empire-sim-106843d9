let _currentUtterance = null; // garde la référence pour éviter le GC mobile

const pickVoice = (lang) => {
  const voices = window.speechSynthesis.getVoices();
  const target = lang === "en"? "en" : "fr";
  // 1. voix exacte fr-FR / en-US, 2. fallback fr / en
  return voices.find(v => v.lang.toLowerCase() === (target === "fr"? "fr-fr" : "en-us"))
      || voices.find(v => v.lang.toLowerCase().startsWith(target))
      || null;
};

const speakBrowser = () => {
  if (typeof window === "undefined" ||!("speechSynthesis" in window)) { wrapDone(); return; }

  const synth = window.speechSynthesis;

  try {
    // 1. stop propre, mais avec un petit délai après
    if (synth.speaking || synth.pending) {
      synth.cancel();
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = l === "en"? "en-US" : "fr-FR";
    u.rate = 1;
    u.pitch = 1;
    u.volume = 1;

    // 2. on attache les events AVANT
    u.onend = () => { _currentUtterance = null; wrapDone(); };
    u.onerror = (e) => { console.warn("[Radio] TTS Error:", e); _currentUtterance = null; wrapDone(); };

    const startSpeak = () => {
      const v = pickVoice(l);
      if (v) u.voice = v;

      _currentUtterance = u; // important mobile

      // délai de 60ms après cancel, sinon iOS ignore le speak
      setTimeout(() => {
        synth.speak(u);
        if (synth.paused) synth.resume(); // débloque le canal audio
      }, 60);
    };

    // 3. les voix arrivent en asynchrone sur mobile
    if (synth.getVoices().length === 0) {
      synth.addEventListener("voiceschanged", () => startSpeak(), { once: true });
      synth.getVoices(); // force le chargement
    } else {
      startSpeak();
    }

  } catch (err) {
    console.warn("[Radio] speakBrowser error:", err);