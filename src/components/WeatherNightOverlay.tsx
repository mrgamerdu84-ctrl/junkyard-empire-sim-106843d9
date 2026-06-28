// Overlay visuel : teinte nuit + effets météo (pluie, neige, brouillard, orage).
// Se superpose au-dessus de la carte mais sous l'UI.
import { useRealWorldEnv } from "@/lib/realWorldEnv";
import { isUltraLite, reduceMotion } from "@/lib/perf";

export function WeatherNightOverlay({ lite = false }: { lite?: boolean }) {
  const env = useRealWorldEnv();
  if (!env) return null;

  const night = !env.isDay;
  const w = env.weather;
  const staticFx = lite || isUltraLite() || reduceMotion();

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
        overflow: "hidden",
      }}
    >
      {/* Teinte nuit */}
      {night && (
        <div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at center, rgba(8,12,32,0.35) 0%, rgba(4,6,20,0.65) 100%)",
            mixBlendMode: "multiply",
          }}
        />
      )}

      {/* Brouillard */}
      {w === "fog" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(220,225,235,0.30)", backdropFilter: staticFx ? undefined : "blur(1.5px)" }} />
      )}

      {/* Pluie / orage */}
      {(w === "rain" || w === "storm") && (
        <>
          {staticFx ? (
            <div style={{ position: "absolute", inset: 0, background: "rgba(70,95,125,0.16)" }} />
          ) : (
            <div className="jce-rain" />
          )}
          {night || w === "storm" ? (
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,15,25,0.25)" }} />
          ) : null}
          {w === "storm" && !staticFx && <div className="jce-lightning" />}
        </>
      )}

      {/* Neige */}
      {w === "snow" && (staticFx
        ? <div style={{ position: "absolute", inset: 0, background: "rgba(235,245,255,0.14)" }} />
        : <div className="jce-snow" />)}

      <style>{`
        .jce-rain {
          position: absolute; inset: 0;
          background-image: repeating-linear-gradient(
            105deg,
            rgba(180,200,230,0.45) 0px,
            rgba(180,200,230,0.45) 1px,
            transparent 1px,
            transparent 6px
          );
          animation: jce-rain-move 0.45s linear infinite;
          opacity: 0.55;
        }
        @keyframes jce-rain-move {
          from { background-position: 0 0; }
          to   { background-position: -30px 60px; }
        }
        .jce-snow {
          position: absolute; inset: 0;
          background-image:
            radial-gradient(circle at 20% 30%, #fff 1.2px, transparent 1.6px),
            radial-gradient(circle at 70% 60%, #fff 1.4px, transparent 1.8px),
            radial-gradient(circle at 40% 80%, #fff 1px, transparent 1.4px),
            radial-gradient(circle at 85% 20%, #fff 1.2px, transparent 1.6px);
          background-size: 120px 120px, 160px 160px, 100px 100px, 140px 140px;
          animation: jce-snow-fall 6s linear infinite;
          opacity: 0.85;
        }
        @keyframes jce-snow-fall {
          from { background-position: 0 0, 0 0, 0 0, 0 0; }
          to   { background-position: 20px 120px, -30px 160px, 15px 100px, -20px 140px; }
        }
        .jce-lightning {
          position: absolute; inset: 0;
          background: rgba(255,255,255,0.8);
          opacity: 0;
          animation: jce-lightning-flash 7s linear infinite;
        }
        @keyframes jce-lightning-flash {
          0%, 92%, 100% { opacity: 0; }
          93% { opacity: 0.6; }
          94% { opacity: 0; }
          95% { opacity: 0.4; }
          96% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
