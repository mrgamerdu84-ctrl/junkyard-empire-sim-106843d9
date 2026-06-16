import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ============================================================
 * JUNKY CITY EMPIRE — 3D Overlay
 * Canvas TRANSPARENT posé par-dessus la map 2D (citymap.jpg).
 * Aligné en coords [-50..50] = 0..100% de la map.
 * Voitures détaillées suivant des splines calées sur les routes.
 * Lampadaires qui éclairent la nuit, arbres, fumée, dépanneuses.
 * ============================================================ */

/* World coords: x ∈ [-50,50] = left% 0..100, z ∈ [-50,50] = top% 0..100 */

function loop(points: [number, number][], tension = 0.0) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true, "catmullrom", tension,
  );
}

/* Splines calées sur les routes visibles de citymap.jpg.
 * La grande route horizontale visible passe à ~ top 72% (z ≈ +22)
 * Une route secondaire passe entre le centre commercial et les buildings (z ≈ -2)
 */
const ROAD_LOOPS = [
  // Boulevard principal en bas (route grise très visible)
  loop([[-44, 22], [-25, 22], [0, 24], [25, 22], [44, 22], [44, 36], [25, 38], [0, 36], [-25, 38], [-44, 36]], 0.2),
  // Route médiane horizontale (entre buildings et centre)
  loop([[-44, 0], [-25, -2], [0, 0], [25, -2], [44, 0], [44, 10], [25, 12], [0, 10], [-25, 12], [-44, 10]], 0.2),
  // Petite boucle autour du carwash / construction (bas gauche)
  loop([[-40, 28], [-20, 30], [-20, 44], [-40, 44]], 0.2),
];


/* ===== Day / Night ===== */
function DayNight({ onPhase }: { onPhase: (day: number) => void }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  useFrame(() => {
    const t = (performance.now() % 180000) / 180000;
    const a = t * Math.PI * 2;
    const sy = Math.sin(a);
    const day = Math.max(0, sy);
    if (sun.current) {
      sun.current.position.set(Math.cos(a) * 60, Math.max(8, sy * 60 + 12), 30);
      sun.current.intensity = 0.35 + day * 1.1;
      sun.current.color.setRGB(
        THREE.MathUtils.lerp(0.4, 1.0, day),
        THREE.MathUtils.lerp(0.45, 0.92, day),
        THREE.MathUtils.lerp(0.7, 0.7, day),
      );
    }
    if (amb.current) amb.current.intensity = 0.25 + day * 0.4;
    onPhase(day);
  });
  return (
    <>
      <directionalLight ref={sun} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005}>
        <orthographicCamera attach="shadow-camera" args={[-60, 60, 60, -60, 1, 200]} />
      </directionalLight>
      <ambientLight ref={amb} />
      <hemisphereLight args={["#cfe1ff", "#2a2418", 0.35]} />
    </>
  );
}

/* ===== Caméra ortho qui s'adapte à la viewport ===== */
function FitCam() {
  const { size, set, camera } = useThree();
  const cam = useMemo(() => new THREE.OrthographicCamera(), []);
  useEffect(() => {
    const span = 100; // hauteur monde
    const aspect = size.width / Math.max(1, size.height);
    cam.left = -(span * aspect) / 2;
    cam.right = (span * aspect) / 2;
    cam.top = span / 2;
    cam.bottom = -span / 2;
    cam.near = 0.1;
    cam.far = 500;
    cam.position.set(0, 90, 25); // léger tilt pour donner du volume
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    set({ camera: cam });
  }, [size, cam, set]);
  void camera;
  return null;
}

/* ===== Voiture détaillée ===== */
function Car({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={scale}>
      {/* châssis bas */}
      <mesh castShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[1.7, 0.45, 3.6]} />
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.25} />
      </mesh>
      {/* jupe */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[1.8, 0.2, 3.7]} />
        <meshStandardMaterial color="#161616" roughness={0.6} />
      </mesh>
      {/* cabine */}
      <mesh castShadow position={[0, 0.85, -0.15]}>
        <boxGeometry args={[1.55, 0.6, 1.9]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
      </mesh>
      {/* vitres avant/arrière */}
      <mesh position={[0, 0.9, 0.85]} rotation={[Math.PI * 0.14, 0, 0]}>
        <boxGeometry args={[1.48, 0.55, 0.05]} />
        <meshStandardMaterial color="#0a1626" metalness={0.95} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.9, -1.15]} rotation={[-Math.PI * 0.14, 0, 0]}>
        <boxGeometry args={[1.48, 0.55, 0.05]} />
        <meshStandardMaterial color="#0a1626" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* toit */}
      <mesh position={[0, 1.16, -0.15]}>
        <boxGeometry args={[1.45, 0.05, 1.85]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
      </mesh>
      {/* roues + jantes */}
      {([[0.78, 0.3, 1.2], [-0.78, 0.3, 1.2], [0.78, 0.3, -1.2], [-0.78, 0.3, -1.2]] as [number, number, number][]).map((p, i) => (
        <group key={i} position={p} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.16, 0.16, 0.24, 10]} />
            <meshStandardMaterial color="#b8c2cc" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* phares */}
      <mesh position={[0.5, 0.42, 1.83]}>
        <boxGeometry args={[0.32, 0.2, 0.05]} />
        <meshStandardMaterial color="#fff7c0" emissive="#fff2a8" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[-0.5, 0.42, 1.83]}>
        <boxGeometry args={[0.32, 0.2, 0.05]} />
        <meshStandardMaterial color="#fff7c0" emissive="#fff2a8" emissiveIntensity={1.6} />
      </mesh>
      {/* feux arrière */}
      <mesh position={[0.5, 0.42, -1.83]}>
        <boxGeometry args={[0.36, 0.2, 0.05]} />
        <meshStandardMaterial color="#ff3a2a" emissive="#ff2a1a" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-0.5, 0.42, -1.83]}>
        <boxGeometry args={[0.36, 0.2, 0.05]} />
        <meshStandardMaterial color="#ff3a2a" emissive="#ff2a1a" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

/* ===== Traffic ===== */
function Traffic({ count = 12 }: { count?: number }) {
  const specs = useMemo(() => {
    const palette = ["#e0362a", "#f5c542", "#2b6ed8", "#e8edf2", "#0e0e0e", "#3a8a48", "#888e96", "#d97a2a", "#b81c4a", "#1a3a6a"];
    return Array.from({ length: count }, (_, i) => ({
      curve: ROAD_LOOPS[i % ROAD_LOOPS.length],
      offset: (i / count + Math.random() * 0.04) % 1,
      speed: 0.010 + Math.random() * 0.018,
      color: palette[i % palette.length],
      scale: 2.6 + Math.random() * 0.3, // grosses voitures bien visibles
    }));
  }, [count]);

  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    specs.forEach((s, i) => {
      s.offset = (s.offset + s.speed * dt) % 1;
      const p = s.curve.getPointAt(s.offset);
      const t = s.curve.getTangentAt(s.offset);
      const g = refs.current[i];
      if (g) {
        g.position.set(p.x, 0, p.z);
        g.rotation.y = Math.atan2(t.x, t.z);
      }
    });
  });
  return (
    <>
      {specs.map((s, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <Car color={s.color} scale={s.scale} />
        </group>
      ))}
    </>
  );
}

/* ===== Dépanneuse navette ===== */
function TowTruck({ phase, color = "#e85d3a" }: { phase: number; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => loop([
    [-34, 12], [-15, 8], [0, 6], [15, 8], [34, 12], [34, 26], [10, 30], [-10, 30], [-34, 26], [-34, 12],
  ], 0.2), []);
  const t = useRef(phase);
  useFrame((_, dt) => {
    t.current = (t.current + dt * 0.03) % 1;
    const p = curve.getPointAt(t.current);
    const tg = curve.getTangentAt(t.current);
    if (ref.current) {
      ref.current.position.set(p.x, 0, p.z);
      ref.current.rotation.y = Math.atan2(tg.x, tg.z);
    }
    if (beacon.current) {
      const m = beacon.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.6 + Math.abs(Math.sin(performance.now() / 180)) * 2.4;
    }
  });
  return (
    <group ref={ref} scale={1.7}>
      {/* cabine */}
      <mesh castShadow position={[0, 0.95, 1.3]}>
        <boxGeometry args={[2.1, 1.5, 1.9]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.15, 2.2]}>
        <boxGeometry args={[1.95, 0.9, 0.05]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* plateau */}
      <mesh castShadow position={[0, 0.8, -1.0]}>
        <boxGeometry args={[2.0, 0.4, 3.2]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* bras */}
      <mesh castShadow position={[0, 1.3, -2.5]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.25, 0.25, 2.2]} />
        <meshStandardMaterial color="#f5d666" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* épave */}
      <mesh castShadow position={[0, 1.3, -1.0]}>
        <boxGeometry args={[1.55, 0.55, 2.5]} />
        <meshStandardMaterial color="#6a4a30" metalness={0.4} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 1.7, -1.2]}>
        <boxGeometry args={[1.35, 0.4, 1.5]} />
        <meshStandardMaterial color="#5a4030" metalness={0.4} roughness={0.85} />
      </mesh>
      {/* gyrophare */}
      <mesh ref={beacon} position={[0, 1.85, 1.6]}>
        <boxGeometry args={[0.6, 0.2, 0.4]} />
        <meshStandardMaterial color="#ffae00" emissive="#ffae00" emissiveIntensity={1.5} />
      </mesh>
      {/* roues */}
      {([[0.92, 0.4, 1.6], [-0.92, 0.4, 1.6], [0.92, 0.4, -1.6], [-0.92, 0.4, -1.6]] as [number, number, number][]).map((p, i) => (
        <mesh key={i} castShadow position={p} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      ))}
    </group>
  );
}

/* ===== Lampadaire ===== */
function StreetLamp({ pos, night }: { pos: [number, number]; night: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh castShadow position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 3.2, 8]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.6, 3.15, 0]}>
        <boxGeometry args={[1.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[1.15, 3.0, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshStandardMaterial color="#fff5b0" emissive="#ffd66a" emissiveIntensity={0.3 + night * 3.0} />
      </mesh>
      {night > 0.35 && (
        <pointLight position={[1.15, 3.0, 0]} intensity={night * 1.4} distance={9} color="#ffd66a" />
      )}
    </group>
  );
}

/* ===== Arbre ===== */
function Tree({ pos, scale = 1 }: { pos: [number, number]; scale?: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]} scale={scale}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.22, 1.2, 8]} />
        <meshStandardMaterial color="#4a3220" />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]}>
        <coneGeometry args={[0.95, 1.7, 10]} />
        <meshStandardMaterial color="#2d5a2a" />
      </mesh>
      <mesh castShadow position={[0, 2.3, 0]}>
        <coneGeometry args={[0.65, 1.2, 10]} />
        <meshStandardMaterial color="#356b30" />
      </mesh>
    </group>
  );
}

/* ===== Fumée ===== */
function Smoke({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const N = 7;
  useFrame(() => {
    if (!ref.current) return;
    const t = performance.now() / 1000;
    ref.current.children.forEach((c, i) => {
      const local = (t * 0.3 + i / N) % 1;
      c.position.y = local * 6;
      c.position.x = Math.sin(local * 3 + i) * 0.7;
      (c as THREE.Mesh).scale.setScalar(0.45 + local * 1.6);
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - local) * 0.55;
    });
  });
  return (
    <group ref={ref} position={pos}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.7, 10, 10]} />
          <meshStandardMaterial color="#d0d0d0" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ===== Ouvrier patrouille ===== */
function Worker({ center, radius = 3, speed = 0.4, color = "#f5d666" }: { center: [number, number]; radius?: number; speed?: number; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 1000 * speed;
    if (ref.current) {
      ref.current.position.set(center[0] + Math.cos(t) * radius, Math.abs(Math.sin(t * 8)) * 0.1, center[1] + Math.sin(t) * radius);
      ref.current.rotation.y = -t + Math.PI / 2;
    }
  });
  return (
    <group ref={ref} scale={1.5}>
      <mesh castShadow position={[0.14, 0.27, 0]}>
        <boxGeometry args={[0.2, 0.55, 0.22]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      <mesh castShadow position={[-0.14, 0.27, 0]}>
        <boxGeometry args={[0.2, 0.55, 0.22]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      <mesh castShadow position={[0, 0.82, 0]}>
        <boxGeometry args={[0.58, 0.58, 0.34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#e8c8a0" />
      </mesh>
      <mesh castShadow position={[0, 1.36, 0]}>
        <sphereGeometry args={[0.23, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f5d666" />
      </mesh>
    </group>
  );
}

/* ===== Visualisation des routes (asphalte sous les voitures) ===== */
function RoadStrips() {
  const tubes = useMemo(
    () => ROAD_LOOPS.map((c) => new THREE.TubeGeometry(c, 200, 2.2, 8, true)),
    [],
  );
  return (
    <group position={[0, 0.02, 0]}>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial color="#1a1a1d" roughness={0.95} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================================================ */

export type City3DProps = {
  /** opacité du calque asphalte dessiné par dessus la map (0 = invisible) */
  drawRoadStrips?: boolean;
};

export default function City3D({ drawRoadStrips = false }: City3DProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [night, setNight] = useState(0.4);

  if (!mounted) return null;

  /* Lampadaires alignés le long des routes principales */
  const lamps: [number, number][] = [
    // ring extérieur
    [-40, -36], [-20, -36], [0, -36], [20, -36], [40, -36],
    [-40, 40], [-20, 40], [0, 40], [20, 40], [40, 40],
    [-44, -10], [-44, 14], [44, -10], [44, 14],
    // mid loop
    [-22, -8], [22, -8], [-22, 20], [22, 20],
  ];
  const trees: [number, number][] = [
    [-44, -20], [-44, 2], [-44, 24], [44, -20], [44, 2], [44, 24],
    [-12, -42], [12, -42], [-12, 44], [12, 44],
    [-8, 6], [8, 6], [-8, 18], [8, 18],
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }}
      onCreated={({ scene }) => { scene.background = null; }}
    >
      <FitCam />
      <DayNight onPhase={(d) => setNight(1 - d)} />
      <Environment preset="city" />

      {drawRoadStrips && <RoadStrips />}

      {/* Ombres douces des véhicules sur la map */}
      <ContactShadows position={[0, 0.05, 0]} opacity={0.4} scale={120} blur={2.4} far={20} />

      <Traffic count={14} />
      <TowTruck phase={0} color="#e85d3a" />
      <TowTruck phase={0.55} color="#f5d666" />

      {/* Grue dans la casse */}
      <CraneStatic pos={[-38, 16]} />

      {/* Fumée près de la casse et du garage */}
      <Smoke pos={[-38, 0, 8]} />
      <Smoke pos={[36, 0, 8]} />

      {/* Ouvriers */}
      <Worker center={[-34, 12]} radius={4} speed={0.5} color="#3a8ad0" />
      <Worker center={[34, 12]} radius={4} speed={0.45} color="#86c46a" />
      <Worker center={[-2, 0]} radius={5} speed={0.4} color="#e85d3a" />
      <Worker center={[-30, 32]} radius={3} speed={0.55} color="#f5d666" />

      {trees.map((p, i) => <Tree key={i} pos={p} scale={1 + (i % 3) * 0.2} />)}
      {lamps.map((p, i) => <StreetLamp key={i} pos={p} night={night} />)}
    </Canvas>
  );
}

/* Petite grue statique animée */
function CraneStatic({ pos }: { pos: [number, number] }) {
  const arm = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (arm.current) arm.current.rotation.y += dt * 0.25;
    if (hook.current) hook.current.position.y = -2 + Math.sin(performance.now() / 700) * 1.3;
  });
  return (
    <group position={[pos[0], 0, pos[1]]} scale={1.3}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.2, 1.4, 1, 16]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 4.5, 0]}>
        <boxGeometry args={[0.85, 8, 0.85]} />
        <meshStandardMaterial color="#f5d666" metalness={0.5} roughness={0.4} />
      </mesh>
      <group ref={arm} position={[0, 8.5, 0]}>
        <mesh castShadow position={[3.5, 0, 0]}>
          <boxGeometry args={[8, 0.42, 0.42]} />
          <meshStandardMaterial color="#f5d666" />
        </mesh>
        <mesh castShadow position={[-2, 0, 0]}>
          <boxGeometry args={[2.5, 0.85, 0.85]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <group ref={hook} position={[6, 0, 0]}>
          <mesh position={[0, -1, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 2.2]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh castShadow position={[0, -2.2, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.4, 16]} />
            <meshStandardMaterial color="#c0392b" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ===== Type re-export pour compat avec index.tsx ===== */
export type Zone3D = { id: string; name: string; pos: [number, number] };
export const ZONES_3D: Zone3D[] = [];
