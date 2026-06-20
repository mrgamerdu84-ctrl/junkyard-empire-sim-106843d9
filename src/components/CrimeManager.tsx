import { useState, useEffect } from "react";

type CrimeEvent = {
  id: string;
  type: "cambriolage" | "braquage";
  statut: "en_cours" | "police_en_route" | "intercepte";
};

export default function CrimeManager() {
  const [activeCrime, setActiveCrime] = useState<CrimeEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeCrime && Math.random() < 0.20) {
        const nouveauCrime: CrimeEvent = {
          id: Math.random().toString(),
          type: Math.random() > 0.5 ? "braquage" : "cambriolage",
          statut: "en_cours",
        };
        setActiveCrime(nouveauCrime);
        setLogs((prev) => [`🚨 ALERTE : Un ${nouveauCrime.type} a commencé !`, ...prev]);
      }
    }, 45000); // Vérifie toutes les 45 secondes

    return () => clearInterval(interval);
  }, [activeCrime]);

  const envoyerPolice = () => {
    if (!activeCrime) return;
    setActiveCrime({ ...activeCrime, statut: "police_en_route" });
    setLogs((prev) => ["🚓 Police en route ! Les sirènes hurlent.", ...prev]);

    setTimeout(() => {
      setActiveCrime({ ...activeCrime, statut: "intercepte" });
      setLogs((prev) => [
        "💥 FUSILLADE ! La police tire sur les braqueurs !",
        "👮 Criminels arrêtés et menottés !",
        ...prev
      ]);
      setTimeout(() => setActiveCrime(null), 4000);
    }, 3000);
  };

  return (
    <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-700 max-w-sm mt-4 shadow-2xl">
      <h3 className="text-xs font-bold text-red-500 uppercase tracking-wide">🚨 Sécurité de la Casse</h3>
      {activeCrime ? (
        <div className="mt-2 bg-red-950/40 border border-red-800 p-2 rounded-lg text-xs">
          <div>Événement : <span className="text-red-400 font-bold uppercase">{activeCrime.type}</span></div>
          <div className="text-yellow-400 font-mono mt-1">Statut : {activeCrime.statut}</div>
          {activeCrime.statut === "en_cours" && (
            <button onClick={envoyerPolice} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 rounded">
              🚨 Déployer la Police
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-1">Rien à signaler. Vos voitures sont en sécurité.</p>
      )}
      <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] font-mono text-slate-300 max-h-20 overflow-y-auto">
        {logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
      </div>
    </div>
  );
}
