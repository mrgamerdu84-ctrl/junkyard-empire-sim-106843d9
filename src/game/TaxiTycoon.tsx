import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import LeaderboardPanel from '@/components/LeaderboardPanel';
import TutorialDialog from '@/components/TutorialDialog';
import { resetTutorial } from '@/lib/leaderboard';
import mapAsset from '@/assets/map_city.png.asset.json';
import bureauAsset from '@/assets/bureau_patron.png.asset.json';

// --- Customisation taxi (utilisée par ProfileCard) ---
export interface TaxiPaint { id: string; name: string; color: string; filter?: string; }
export interface TaxiLivery { id: string; name: string; image: string; faceRight?: boolean; city?: string; }

export const TAXI_PAINTS: TaxiPaint[] = [
  { id: 'yellow', name: 'Jaune Classique', color: '#ffcc00', filter: 'none' },
  { id: 'black',  name: 'Noir Limousine',  color: '#1a1a1a', filter: 'brightness(0.4)' },
  { id: 'white',  name: 'Blanc Pur',       color: '#f5f5f5', filter: 'brightness(1.3) saturate(0.2)' },
  { id: 'red',    name: 'Rouge Sport',     color: '#cc2222', filter: 'hue-rotate(-40deg) saturate(1.4)' },
  { id: 'blue',   name: 'Bleu Nuit',       color: '#1e3a8a', filter: 'hue-rotate(180deg) saturate(1.2)' },
];

const TAXI_SPRITE = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 32'><rect x='4' y='10' width='56' height='14' rx='4' fill='%23ffcc00' stroke='%23000' stroke-width='2'/><rect x='16' y='4' width='32' height='10' rx='2' fill='%23ffd84d' stroke='%23000' stroke-width='2'/><circle cx='16' cy='26' r='4' fill='%23222'/><circle cx='48' cy='26' r='4' fill='%23222'/></svg>`
);

const LIVERIES: TaxiLivery[] = [
  { id: 'none',    name: 'Sans livrée',    image: TAXI_SPRITE, faceRight: true,  city: 'Standard' },
  { id: 'stripes', name: 'Rayures Course', image: TAXI_SPRITE, faceRight: true,  city: 'Monaco' },
  { id: 'checker', name: 'Damier NYC',     image: TAXI_SPRITE, faceRight: false, city: 'New York' },
];

export const getAllLiveries = (): TaxiLivery[] => LIVERIES;

// --- INTERFACES DES ENTITÉS (MANAGEMENT PATRON) ---
interface Chauffeur {
  id: string;
  nom: string;
  plaqueAssignee: string;
  statut: 'en_service' | 'bouchon' | 'accident';
}

interface Vehicle {
  id: string;
  plaque: string;
  type: 'joueur' | 'rival_rouge' | 'rival_vert';
  x: number;
  y: number;
  direction: 'up' | 'down';
  speed: number;
}

export const TaxiTycoon: React.FC = () => {
  const [ecranActuel, setEcranActuel] = useState<'bureau' | 'gps_zoom'>('bureau');
  const [ongletBeeper, setOngletBeeper] = useState<'missions' | 'messages' | 'radio'>('missions');
  const [pseudo, setPseudo] = useState('Mrgamerdu84');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();
  const [, setMissionActive] = useState<boolean>(false);
  const [timerBeeper, setTimerBeeper] = useState<number>(12);

  const [listeChauffeurs] = useState<Chauffeur[]>([
    { id: 'c1', nom: 'Gérard', plaqueAssignee: 'AA-123-BB', statut: 'en_service' },
    { id: 'c2', nom: 'Youssef', plaqueAssignee: 'CC-456-DD', statut: 'en_service' }
  ]);

  const [taxis, setTaxis] = useState<Vehicle[]>([
    { id: 't1', plaque: 'AA-123-BB', type: 'joueur', x: 150, y: 200, direction: 'down', speed: 2 },
    { id: 't2', plaque: 'CC-456-DD', type: 'joueur', x: 450, y: 450, direction: 'up', speed: 2 },
    { id: 'r1', plaque: 'ROUGE-66', type: 'rival_rouge', x: 600, y: 300, direction: 'down', speed: 2.2 },
    { id: 'v1', plaque: 'VERT-77', type: 'rival_vert', x: 250, y: 380, direction: 'up', speed: 1.8 }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerBeeper(t => (t > 0 ? t - 1 : 12));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (ecranActuel !== 'gps_zoom') return;

    const boucleTrafic = setInterval(() => {
      setTaxis(prevTaxis =>
        prevTaxis.map(actuel => {
          const DISTANCE_STOP = 50;
          const obstacleDevant = prevTaxis.find(autre => {
            if (autre.id === actuel.id) return false;
            if (autre.direction !== actuel.direction) return false;
            const distance = Math.sqrt(Math.pow(autre.x - actuel.x, 2) + Math.pow(autre.y - actuel.y, 2));
            return distance < DISTANCE_STOP;
          });

          if (obstacleDevant) {
            return { ...actuel, speed: 0 };
          }

          let newX = actuel.x;
          let newY = actuel.y;
          const vitesseNormale = actuel.type === 'joueur' ? 2 : 2.2;

          if (actuel.direction === 'down') {
            newX += vitesseNormale;
            newY += vitesseNormale * 0.5;
            if (newX > 1100) { newX = 100; newY = 150; }
          } else {
            newX -= vitesseNormale;
            newY -= vitesseNormale * 0.5;
            if (newX < 50) { newX = 1000; newY = 500; }
          }

          return { ...actuel, x: newX, y: newY, speed: vitesseNormale };
        })
      );
    }, 30);

    return () => clearInterval(boucleTrafic);
  }, [ecranActuel]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', margin: 0, padding: 0, overflow: 'hidden', position: 'relative' }}>

      {ecranActuel === 'bureau' && (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url("${bureauAsset.url}")`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          position: 'relative'
        }}>
          <button
            onClick={() => setEcranActuel('gps_zoom')}
            style={{ position: 'absolute', top: '20%', left: '32%', width: '36%', height: '32%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
            title="Clique sur l'écran pour zoomer sur le GPS"
          />
          {/* ARÈNE → route /arena */}
          <button
            onClick={() => navigate({ to: '/arena' })}
            title="Arène Mondiale"
            style={{ position: 'absolute', top: '73%', left: '40%', width: '16%', height: '5%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
          />
          {/* CLASSEMENT → LeaderboardPanel */}
          <button
            onClick={() => setShowLeaderboard(true)}
            title="Classement Mondial"
            style={{ position: 'absolute', top: '4%', right: '2%', width: '7%', height: '18%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
          />
          <div style={{ position: 'absolute', bottom: '18%', left: '21%', zIndex: 10 }}>
            <input
              type="text"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid #ffcc00', color: '#ffcc00', padding: '5px 10px', borderRadius: '4px', fontWeight: 'bold', width: '120px', fontSize: '12px' }}
            />
          </div>
          {/* TUTO → TutorialDialog */}
          <button
            onClick={() => { resetTutorial(); setShowTutorial(true); }}
            title="Tutoriel avec Léo"
            style={{ position: 'absolute', bottom: '20%', right: '4%', width: '10%', height: '8%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
          />
          {/* APK → route /download */}
          <button
            onClick={() => navigate({ to: '/download' })}
            title="Télécharger l'APK"
            style={{ position: 'absolute', bottom: '1%', right: '10%', width: '10%', height: '10%', opacity: 0, cursor: 'pointer', zIndex: 10 }}
          />

          {/* Étiquettes visibles pour repérer les zones cliquables */}
          <div style={{ position: 'absolute', top: '74%', left: '40%', width: '16%', textAlign: 'center', color: '#00ffcc', fontSize: '11px', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 1px 2px #000', zIndex: 9 }}>⚔️ ARÈNE</div>
          <div style={{ position: 'absolute', top: '21%', right: '2%', width: '7%', textAlign: 'center', color: '#ffcc00', fontSize: '10px', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 1px 2px #000', zIndex: 9 }}>🏆 CLASSEMENT</div>
          <div style={{ position: 'absolute', bottom: '17%', right: '4%', width: '10%', textAlign: 'center', color: '#ffcc00', fontSize: '10px', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 1px 2px #000', zIndex: 9 }}>📖 TUTO</div>
          <div style={{ position: 'absolute', bottom: '0%', right: '10%', width: '10%', textAlign: 'center', color: '#00ff66', fontSize: '10px', fontWeight: 'bold', pointerEvents: 'none', textShadow: '0 1px 2px #000', zIndex: 9 }}>📲 APK</div>
        </div>
      )}

      {showLeaderboard && <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />}
      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}
      <div style={{ display: 'none' }}>{/* anchor */}</div>

      {ecranActuel === 'gps_zoom' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', backgroundColor: '#111317' }}>

          <div style={{ width: '25%', backgroundColor: '#1a1d24', borderRight: '2px solid #2d3440', padding: '15px', display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ color: '#ffcc00', fontSize: '18px', margin: '0 0 5px 0' }}>{pseudo.toUpperCase()} CORP.</h2>
            <div style={{ color: '#00ffcc', fontSize: '12px', marginBottom: '20px' }}>● DIRECTION DE FLOTTE ACTIVE</div>

            <button
              onClick={() => setEcranActuel('bureau')}
              style={{ width: '100%', padding: '10px', backgroundColor: '#cc3333', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}
            >
              🚪 Quitter le Moniteur (Retour QG)
            </button>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h3 style={{ color: '#fff', fontSize: '14px', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Immatriculations & Statuts</h3>
              {listeChauffeurs.map(c => (
                <div key={c.id} style={{ backgroundColor: '#242a35', padding: '12px', borderRadius: '5px', marginBottom: '10px' }}>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>👤 {c.nom}</div>
                  <div style={{ color: '#ffcc00', fontSize: '12px', marginTop: '4px' }}>🔢 Plaque : <strong>{c.plaqueAssignee}</strong></div>
                  <div style={{ color: '#00ff00', fontSize: '11px', marginTop: '6px' }}>Sécurité : Anti-collision OK</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '50%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#1c1f26' }}>
            <div style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url("${mapAsset.url}")`,
              backgroundSize: '100% 100%',
              position: 'relative'
            }}>
              {taxis.map(v => (
                <div key={v.id} style={{ position: 'absolute', left: `${v.x}px`, top: `${v.y}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.03s linear' }}>
                  <div style={{ backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: '9px', padding: '2px 4px', borderRadius: '3px', border: '1px solid #ffcc00', marginBottom: '2px', whiteSpace: 'nowrap' }}>
                    {v.plaque} {v.speed === 0 ? '⛔ COLLISION_PREV' : ''}
                  </div>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: v.type === 'joueur' ? '#ffcc00' : v.type === 'rival_rouge' ? '#ff3333' : '#33cc33',
                    border: '2px solid #fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                  }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ width: '25%', backgroundColor: '#101216', padding: '15px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#222', border: '3px solid #555', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#a4c2a0', color: '#000', fontFamily: 'monospace', padding: '10px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', marginBottom: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                  <span onClick={() => setOngletBeeper('missions')} style={{ cursor: 'pointer', textDecoration: ongletBeeper === 'missions' ? 'underline' : 'none' }}>[BIP]</span>
                  <span onClick={() => setOngletBeeper('messages')} style={{ cursor: 'pointer', textDecoration: ongletBeeper === 'messages' ? 'underline' : 'none' }}>[LÉO]</span>
                  <span onClick={() => setOngletBeeper('radio')} style={{ cursor: 'pointer', textDecoration: ongletBeeper === 'radio' ? 'underline' : 'none' }}>[RAD]</span>
                </div>

                {ongletBeeper === 'missions' && (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>⚠️ URGENCE CLIENT</div>
                    <div style={{ marginTop: '5px' }}>Client: M. Martin</div>
                    <div>Gain estimé: +45$</div>
                    <div style={{ color: '#900', fontWeight: 'bold', marginTop: '10px' }}>ALERTE CONCURRENCE : {timerBeeper}s</div>
                    <button
                      onClick={() => { alert("Assignation de la course transmise à ta flotte active !"); setMissionActive(true); }}
                      style={{ marginTop: '15px', width: '100%', backgroundColor: '#000', color: '#fff', border: '1px solid #000', padding: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      [ CONFIRMER APPEL ]
                    </button>
                  </div>
                )}

                {ongletBeeper === 'messages' && (
                  <div style={{ fontSize: '11px' }}>
                    <strong>Léo :</strong>
                    <p style={{ margin: '5px 0 0 0' }}>"Regarde l'écran GPS gamin ! Mes gars roulent à droite et pilent net s'ils collent le pare-choc de devant."</p>
                  </div>
                )}

                {ongletBeeper === 'radio' && (
                  <div style={{ textAlign: 'center', fontSize: '12px' }}>
                    <div>📻 RADIO VARIÉTÉ</div>
                    <div style={{ margin: '15px 0', fontSize: '11px', fontWeight: 'bold' }}>Florent Pagny</div>
                    <div style={{ fontSize: '10px', fontStyle: 'italic' }}>"Savoir aimer"</div>
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#333', color: '#fff', fontSize: '10px', padding: '5px', textAlign: 'center' }}>
                📟 OPERATEUR MOTOROLA V1
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default TaxiTycoon;
