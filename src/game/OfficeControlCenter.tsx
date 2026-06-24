import React, { useState, useEffect } from 'react';
import decorBureau from '@/assets/decor_bureau_realiste.jpg';
import mapBg from '@/assets/map_vierge_paysage.jpg';
import taxiSprite from '@/assets/taxi_yellow_isometric.png';

interface Chauffeur {
  id: string;
  nom: string;
  salaire: number;
  statut: 'idle' | 'en_course' | 'refuel' | 'accident';
  taxiAssigne: string | null;
}

interface TaxiVehicule {
  plaque: string;
  modele: string;
  carburant: number;
  position: { x: number; y: number };
}

interface BeeperAlert {
  id: string;
  clientNom: string;
  prixCourse: number;
  tempsRestant: number;
}

interface Props {
  onClose?: () => void;
}

const STYLE_KEYFRAMES = `
@keyframes occZoomIn { from { opacity: 0; transform: scale(0.96);} to { opacity: 1; transform: scale(1);} }
@keyframes occBlink { 0%,100% { opacity: 1;} 50% { opacity: 0.3;} }
.occ-zoom { animation: occZoomIn 0.4s ease-out; }
.occ-blink { animation: occBlink 1s infinite; }
`;

export const OfficeControlCenter: React.FC<Props> = ({ onClose }) => {
  const [vueActuelle, setVueActuelle] = useState<'bureau' | 'ordinateur_gps'>('bureau');
  const [ongletBeeper, setOngletBeeper] = useState<'missions' | 'messages' | 'radio'>('missions');
  const [listeChauffeurs] = useState<Chauffeur[]>([
    { id: '1', nom: 'Gérard', salaire: 15, statut: 'idle', taxiAssigne: 'AA-123-BB' },
    { id: '2', nom: 'Youssef', salaire: 18, statut: 'en_course', taxiAssigne: 'CC-456-DD' },
  ]);
  const [flotteTaxis] = useState<TaxiVehicule[]>([
    { plaque: 'AA-123-BB', modele: 'Berline Classique', carburant: 85, position: { x: 450, y: 300 } },
    { plaque: 'CC-456-DD', modele: 'Break Confort', carburant: 40, position: { x: 820, y: 550 } },
  ]);
  const [alerteBeeper, setAlerteBeeper] = useState<BeeperAlert | null>({
    id: 'req_99',
    clientNom: 'M. Martin',
    prixCourse: 45,
    tempsRestant: 15,
  });

  const faireParlerLeo = (texte: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      u.pitch = 0.75;
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    }
  };

  useEffect(() => {
    if (!alerteBeeper) return;
    const timer = setInterval(() => {
      setAlerteBeeper(prev => {
        if (!prev) return null;
        if (prev.tempsRestant <= 1) {
          faireParlerLeo('Trop tard gamin, un taxi rouge a intercepté la course !');
          return null;
        }
        return { ...prev, tempsRestant: prev.tempsRestant - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [alerteBeeper]);

  useEffect(() => {
    if (alerteBeeper) {
      faireParlerLeo("Boss, un client vient d'envoyer un message sur le Biper.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', backgroundColor: '#111', overflow: 'hidden', zIndex: 9999 }}>
      <style>{STYLE_KEYFRAMES}</style>

      {vueActuelle === 'bureau' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', backgroundImage: `url(${decorBureau})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div style={{ textAlign: 'center', color: '#fff', backgroundColor: 'rgba(0,0,0,0.75)', padding: '20px', borderRadius: '10px', margin: '0 0 40px 0', maxWidth: 480 }}>
            <h2 style={{ margin: '0 0 8px 0' }}>Bureau du Directeur</h2>
            <p style={{ margin: '0 0 14px 0', fontSize: 13 }}>Allume l'ordinateur pour superviser ta flotte en direct.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setVueActuelle('ordinateur_gps')}
                style={{ padding: '12px 22px', fontSize: 15, cursor: 'pointer', backgroundColor: '#00ffcc', color: '#000', border: 'none', borderRadius: 5, fontWeight: 'bold' }}
              >
                🖥️ ÉCRAN GPS / CAMÉRA
              </button>
              {onClose && (
                <button onClick={onClose} style={{ padding: '12px 18px', fontSize: 14, cursor: 'pointer', background: '#444', color: '#fff', border: 'none', borderRadius: 5 }}>
                  ← Retour au jeu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {vueActuelle === 'ordinateur_gps' && (
        <div className="occ-zoom" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#1a1d24', color: '#fff' }}>
          <div style={{ width: '25%', minWidth: 220, borderRight: '2px solid #2a303c', padding: 12, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: '#00ffcc', margin: '0 0 12px 0', fontSize: 15 }}>📊 Flotte</h3>
            <button onClick={() => setVueActuelle('bureau')} style={{ marginBottom: 10, padding: 6, cursor: 'pointer', background: '#2a303c', color: '#fff', border: '1px solid #444', borderRadius: 4, fontSize: 12 }}>
              🚪 Retour bureau
            </button>
            {onClose && (
              <button onClick={onClose} style={{ marginBottom: 12, padding: 6, cursor: 'pointer', background: '#3a1010', color: '#fff', border: '1px solid #553', borderRadius: 4, fontSize: 12 }}>
                ← Sortir du QG
              </button>
            )}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h4 style={{ fontSize: 12, color: '#aaa', margin: '0 0 8px' }}>Chauffeurs actifs</h4>
              {listeChauffeurs.map(chef => {
                const taxi = flotteTaxis.find(t => t.plaque === chef.taxiAssigne);
                return (
                  <div key={chef.id} style={{ padding: 10, backgroundColor: '#242b35', marginBottom: 8, borderRadius: 4, borderLeft: chef.statut === 'en_course' ? '4px solid #00ff00' : '4px solid #ffcc00' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 13 }}>👤 {chef.nom}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>🆔 {chef.taxiAssigne || '—'}</div>
                    {taxi && <div style={{ fontSize: 11, color: '#00ffcc' }}>⛽ {taxi.carburant}%</div>}
                    <div style={{ fontSize: 11, marginTop: 4 }}>{chef.statut.toUpperCase()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#15171c' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: 4, zIndex: 10, fontSize: 11 }}>
              🌐 MONITORING GPS
            </div>
            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${mapBg})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
              {flotteTaxis.map(taxi => {
                const chef = listeChauffeurs.find(c => c.taxiAssigne === taxi.plaque);
                return (
                  <div key={taxi.plaque} style={{ position: 'absolute', left: taxi.position.x, top: taxi.position.y, transition: 'all 0.5s linear', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 10, padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid #00ffcc', marginBottom: 2 }}>
                      {chef?.nom} [{taxi.plaque}]
                    </div>
                    <img src={taxiSprite} alt="Taxi" style={{ width: 40, height: 40, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.6))' }} />
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ width: '25%', minWidth: 220, borderLeft: '2px solid #2a303c', padding: 12, display: 'flex', flexDirection: 'column', backgroundColor: '#101216' }}>
            <div style={{ backgroundColor: '#222', border: '4px solid #444', borderRadius: 10, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#a4c2a0', color: '#000', fontFamily: 'monospace', padding: 10, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', marginBottom: 8, paddingBottom: 4, fontSize: 11 }}>
                  <span onClick={() => setOngletBeeper('missions')} style={{ cursor: 'pointer', fontWeight: ongletBeeper === 'missions' ? 'bold' : 'normal' }}>[📟 MISS]</span>
                  <span onClick={() => setOngletBeeper('messages')} style={{ cursor: 'pointer', fontWeight: ongletBeeper === 'messages' ? 'bold' : 'normal' }}>[💬 LÉO]</span>
                  <span onClick={() => setOngletBeeper('radio')} style={{ cursor: 'pointer', fontWeight: ongletBeeper === 'radio' ? 'bold' : 'normal' }}>[📻 RAD]</span>
                </div>

                {ongletBeeper === 'missions' && (
                  <div>
                    {alerteBeeper ? (
                      <div>
                        <div className="occ-blink" style={{ fontWeight: 'bold' }}>⚠️ BIP! DEMANDE APPEL</div>
                        <div>Client: {alerteBeeper.clientNom}</div>
                        <div>Tarif: +{alerteBeeper.prixCourse}$</div>
                        <div style={{ color: '#d00', fontWeight: 'bold', marginTop: 5 }}>🚨 INTERCEPTION RIVALE : {alerteBeeper.tempsRestant}s</div>
                        <button
                          onClick={() => {
                            faireParlerLeo('Course validée. Assignation au chauffeur disponible.');
                            setAlerteBeeper(null);
                          }}
                          style={{ marginTop: 10, width: '100%', padding: 6, backgroundColor: '#000', color: '#fff', border: '1px solid #000', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          [ ACCEPTER COURSE ]
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: '#555', textAlign: 'center', marginTop: 20 }}>En attente de signal...</div>
                    )}
                  </div>
                )}

                {ongletBeeper === 'messages' && (
                  <div style={{ fontSize: 11 }}>
                    <strong>Vétéran Léo :</strong>
                    <p style={{ margin: '4px 0' }}>"Gamin, oublie pas d'assigner tes plaques à tes gars dans le garage, sinon tes bagnoles bougeront pas d'un poil."</p>
                  </div>
                )}

                {ongletBeeper === 'radio' && (
                  <div style={{ fontSize: 12, textAlign: 'center' }}>
                    <div>📻 RADIO POP STATION</div>
                    <div style={{ fontSize: 10, margin: '10px 0' }}>Lecture : Florent Pagny</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                      <button style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '4px 8px' }}>⏮️</button>
                      <button style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '4px 8px' }}>⏸️</button>
                      <button style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '4px 8px' }}>⏭️</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ height: 20, backgroundColor: '#333', textAlign: 'center', color: '#fff', fontSize: 9, lineHeight: '20px' }}>
                📟 MOTOROLA FLOTTE PRO-V1
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficeControlCenter;
