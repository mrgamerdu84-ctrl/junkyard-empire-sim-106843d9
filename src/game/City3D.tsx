import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera, ContactShadows, Environment } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ============================================================
 * JUNKY CITY EMPIRE — Stylized 3D City v2
 * Détaillé: bâtiments multi-volumes, voitures avec roues,
 * trottoirs, lampadaires, arbres, marquages au sol, parking,
 * grue animée, dépanneuses, fumée, jour/nuit, néons.
 * ============================================================ */

export type Zone3D = {
  id: string;
  name: string;
  pos: [number, number];
  color: string;
  size: [number, number, number];
  roof?: string;
  kind?: "casse" | "garage" | "carwash" | "concession" | "casino" | "mall" | "ville" | "construction" | "intl";
};

export const ZONES_3D: Zone3D[] = [
  { id: "casse",         name: "VOTRE CASSE",         pos: [-30, 16], color: "#6b5a3a", size: [12, 4, 9],  roof: "#3a2f1c", kind: "casse" },
  { id: "garage",        name: "GARAGE EXPRESS",      pos: [ 30, 16], color: "#3a4a5a", size: [11, 5, 8],  roof: "#1c2838", kind: "garage" },
  { id: "carwash",       name: "CAR WASH",            pos: [-24, 30], color: "#2a7aa0", size: [9,  4, 7],  roof: "#143b56", kind: "carwash" },
  { id: "concession",    name: "CONCESSION PREMIUM",  pos: [ 20,-20], color: "#b08838", size: [13, 6, 9],  roof: "#5a4318", kind: "concession" },
  { id: "casino",        name: "CASINO",              pos: [-20,-20], color: "#8a1f1f", size: [10,12, 9],  roof: "#3a0e0e", kind: "casino" },
  { id: "centre",        name: "CENTRE COMMERCIAL",   pos: [  0, -2], color: "#5a5a66", size: [15, 8,11],  roof: "#2a2a35", kind: "mall" },
  { id: "ville",         name: "VILLE ABANDONNÉE",    pos: [ 34, -2], color: "#5a4a4a", size: [9,  7, 7],  roof: "#2a1a1a", kind: "ville" },
  { id: "construction",  name: "ZONE EN CONSTRUCTION",pos: [  4, 30], color: "#8a7a3a", size: [10, 3, 8],  roof: "#3a2f18", kind: "construction" },
  { id: "international", name: "CASSE INTERNATIONALE",pos: [ 32, 30], color: "#3a6a4a", size: [12, 5, 9],  roof: "#1a3a1a", kind: "intl" },
];

/* -------- Roads -------- */
function makeLoop(points: [number, number][]) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0.06, z)),
    true, "catmullrom", 0.0,
  );
}

const ROAD_LOOPS = [
  makeLoop([[-42, -34], [42, -34], [42, 38], [-42, 38]]),
  makeLoop([[-24, -12], [24, -12], [24, 24], [-24, 24]]),
];

const ROAD_SEGMENTS: Array<{ from: [number, number]; to: [number, number]; w?: number }> = [
  { from: [-42, -34], to: [ 42, -34] },
  { from: [ 42, -34], to: [ 42,  38] },
  { from: [ 42,  38], to: [-42,  38] },
  { from: [-42,  38], to: [-42, -34] },
  { from: [-24, -12], to: [ 24, -12] },
  { from: [ 24, -12], to: [ 24,  24] },
  { from: [ 24,  24], to: [-24,  24] },
  { from: [-24,  24], to: [-24, -12] },
  { from: [  0, -34], to: [  0, -12] },
  { from: [  0,  24], to: [  0,  38] },
  { from: [-42,   6], to: [-24,   6] },
  { from: [ 24,   6], to: [ 42,   6] },
];

/* -------- Day/Night -------- */
function DayNight({ onPhase }: { onPhase: (d: number) => void }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  useFrame(() => {
    const t = (performance.now() % 180000) / 180000;
    const angle = t * Math.PI * 2;
    const sunY = Math.sin(angle);
    const day = Math.max(0, sunY);
    if (sunRef.current) {
      sunRef.current.position.set(Math.cos(angle) * 60, Math.max(4, sunY * 60 + 12), 30);
      sunRef.current.intensity = 0.3 + day * 1.4;
      sunRef.current.color = new THREE.Color().lerpColors(
        new THREE.Color("#3b4a7a"), new THREE.Color("#ffe2b0"), day,
      );
    }
    if (ambRef.current) ambRef.current.intensity = 0.2 + day * 0.35;
    if (hemiRef.current) hemiRef.current.intensity = 0.25 + day * 0.4;
    const bg = new THREE.Color().lerpColors(
      new THREE.Color("#0c1226"), new THREE.Color("#b8d0e8"), day,
    );
    scene.background = bg;
    if (scene.fog) (scene.fog as THREE.Fog).color = bg;
    onPhase(day);
  });
  return (
    <>
      <directionalLight ref={sunRef} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005}>
        <orthographicCamera attach="shadow-camera" args={[-70, 70, 70, -70, 1, 220]} />
      </directionalLight>
      <ambientLight ref={ambRef} />
      <hemisphereLight ref={hemiRef} args={["#bcd8ff", "#3a2a1a", 0.4]} />
    </>
  );
}

/* -------- Ground & Roads -------- */
function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#26301f" roughness={1} />
      </mesh>
      {/* grass patches */}
      {Array.from({ length: 60 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        const s = 1 + Math.random() * 2.5;
        return (
          <mesh key={i} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, Math.random() * Math.PI]}>
            <circleGeometry args={[s, 6]} />
            <meshStandardMaterial color={i % 2 ? "#2e3d24" : "#384a2a"} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function Roads() {
  return (
    <group>
      {ROAD_SEGMENTS.map((s, i) => {
        const dx = s.to[0] - s.from[0];
        const dz = s.to[1] - s.from[1];
        const len = Math.hypot(dx, dz);
        const cx = (s.from[0] + s.to[0]) / 2;
        const cz = (s.from[1] + s.to[1]) / 2;
        const rot = Math.atan2(dz, dx);
        const w = s.w ?? 6;
        const dashes = Math.floor(len / 2);
        return (
          <group key={i} position={[cx, 0.02, cz]} rotation={[0, -rot, 0]}>
            {/* sidewalks */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
              <planeGeometry args={[len, w + 1.6]} />
              <meshStandardMaterial color="#3a3a40" roughness={1} />
            </mesh>
            {/* asphalt */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
              <planeGeometry args={[len, w]} />
              <meshStandardMaterial color="#1d1d20" roughness={0.92} />
            </mesh>
            {/* dashed center */}
            {Array.from({ length: dashes }).map((_, k) => (
              <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[-len / 2 + 1 + k * 2, 0.02, 0]}>
                <planeGeometry args={[1, 0.18]} />
                <meshBasicMaterial color="#f7d96a" />
              </mesh>
            ))}
            {/* curb edge lines */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, w / 2 - 0.1]}>
              <planeGeometry args={[len, 0.12]} />
              <meshBasicMaterial color="#dadada" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -w / 2 + 0.1]}>
              <planeGeometry args={[len, 0.12]} />
              <meshBasicMaterial color="#dadada" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* -------- Detailed Car -------- */
function Car({ color, scale = 1 }: { color: string; scale?: number }) {
  return (
    <group scale={scale}>
      {/* chassis */}
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[1.7, 0.4, 3.4]} />
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.25} />
      </mesh>
      {/* lower skirt */}
      <mesh castShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[1.78, 0.18, 3.45]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      {/* cabin */}
      <mesh castShadow position={[0, 0.78, -0.15]}>
        <boxGeometry args={[1.5, 0.55, 1.8]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
      </mesh>
      {/* roof glass */}
      <mesh position={[0, 1.07, -0.15]}>
        <boxGeometry args={[1.42, 0.04, 1.7]} />
        <meshStandardMaterial color="#0a1322" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* windshields */}
      <mesh position={[0, 0.82, 0.78]} rotation={[Math.PI * 0.12, 0, 0]}>
        <boxGeometry args={[1.45, 0.5, 0.05]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.82, -1.08]} rotation={[-Math.PI * 0.12, 0, 0]}>
        <boxGeometry args={[1.45, 0.5, 0.05]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* side windows */}
      <mesh position={[ 0.76, 0.82, -0.15]}>
        <boxGeometry args={[0.04, 0.45, 1.5]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      <mesh position={[-0.76, 0.82, -0.15]}>
        <boxGeometry args={[0.04, 0.45, 1.5]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* wheels */}
      {[[ 0.72, 0.25, 1.15],[-0.72, 0.25, 1.15],[ 0.72, 0.25,-1.15],[-0.72, 0.25,-1.15]].map((p, i) => (
        <group key={i} position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.22, 16]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.24, 12]} />
            <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* headlights */}
      <mesh position={[ 0.5, 0.38, 1.72]}>
        <boxGeometry args={[0.3, 0.18, 0.05]} />
        <meshStandardMaterial color="#fff7c0" emissive="#fff2a8" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[-0.5, 0.38, 1.72]}>
        <boxGeometry args={[0.3, 0.18, 0.05]} />
        <meshStandardMaterial color="#fff7c0" emissive="#fff2a8" emissiveIntensity={1.4} />
      </mesh>
      {/* taillights */}
      <mesh position={[ 0.5, 0.38, -1.72]}>
        <boxGeometry args={[0.35, 0.18, 0.05]} />
        <meshStandardMaterial color="#ff3a2a" emissive="#ff2a1a" emissiveIntensity={1.0} />
      </mesh>
      <mesh position={[-0.5, 0.38, -1.72]}>
        <boxGeometry args={[0.35, 0.18, 0.05]} />
        <meshStandardMaterial color="#ff3a2a" emissive="#ff2a1a" emissiveIntensity={1.0} />
      </mesh>
    </group>
  );
}

function Traffic({ count = 16 }: { count?: number }) {
  const specs = useMemo(() => {
    const palette = ["#e85d3a", "#f5d666", "#3a8ad0", "#86c46a", "#c44569", "#dde2e8", "#1a1a1a", "#9a6a3a", "#d44", "#446"];
    return Array.from({ length: count }, (_, i) => ({
      curve: ROAD_LOOPS[i % ROAD_LOOPS.length],
      offset: (i / count + Math.random() * 0.04) % 1,
      speed: 0.010 + Math.random() * 0.020,
      color: palette[i % palette.length],
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
        g.position.set(p.x, 0.03, p.z);
        g.rotation.y = Math.atan2(t.x, t.z);
      }
    });
  });
  return (
    <>
      {specs.map((s, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <Car color={s.color} />
        </group>
      ))}
    </>
  );
}

/* -------- Tow truck -------- */
function TowTruck({ phase, color = "#e85d3a" }: { phase: number; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(-24, 0.06, 6),
      new THREE.Vector3(  0, 0.06, 6),
      new THREE.Vector3( 24, 0.06, 6),
      new THREE.Vector3( 24, 0.06, 24),
      new THREE.Vector3(  0, 0.06, 24),
      new THREE.Vector3(-24, 0.06, 24),
      new THREE.Vector3(-24, 0.06, 6),
    ], true, "catmullrom", 0.1),
    [],
  );
  const t = useRef(phase);
  useFrame((_, dt) => {
    t.current = (t.current + dt * 0.04) % 1;
    const p = curve.getPointAt(t.current);
    const tg = curve.getTangentAt(t.current);
    if (ref.current) {
      ref.current.position.set(p.x, 0.05, p.z);
      ref.current.rotation.y = Math.atan2(tg.x, tg.z);
    }
    if (beacon.current) {
      const mat = beacon.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.abs(Math.sin(performance.now() / 200)) * 2;
    }
  });
  return (
    <group ref={ref}>
      {/* cab */}
      <mesh castShadow position={[0, 0.85, 1.2]}>
        <boxGeometry args={[2.1, 1.4, 1.9]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.0, 2.1]}>
        <boxGeometry args={[1.95, 0.9, 0.05]} />
        <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* bed */}
      <mesh castShadow position={[0, 0.7, -1.0]}>
        <boxGeometry args={[2.0, 0.4, 3.0]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* hook arm */}
      <mesh castShadow position={[0, 1.2, -2.5]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.25, 0.25, 2.2]} />
        <meshStandardMaterial color="#f5d666" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* wrecked car on bed */}
      <mesh castShadow position={[0, 1.2, -1.0]}>
        <boxGeometry args={[1.5, 0.5, 2.4]} />
        <meshStandardMaterial color="#6a4a30" metalness={0.4} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 1.55, -1.2]}>
        <boxGeometry args={[1.3, 0.35, 1.4]} />
        <meshStandardMaterial color="#5a4030" metalness={0.4} roughness={0.8} />
      </mesh>
      {/* beacon */}
      <mesh ref={beacon} position={[0, 1.7, 1.6]}>
        <boxGeometry args={[0.55, 0.18, 0.35]} />
        <meshStandardMaterial color="#ffae00" emissive="#ffae00" emissiveIntensity={1.5} />
      </mesh>
      {/* wheels */}
      {[[ 0.9, 0.35, 1.6],[-0.9, 0.35, 1.6],[ 0.9, 0.35,-1.6],[-0.9, 0.35,-1.6]].map((p, i) => (
        <mesh key={i} castShadow position={p as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.28, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      ))}
    </group>
  );
}

/* -------- Crane -------- */
function Crane({ pos }: { pos: [number, number] }) {
  const arm = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (arm.current) arm.current.rotation.y += dt * 0.25;
    if (hook.current) {
      const t = performance.now() / 1000;
      hook.current.position.y = -2 + Math.sin(t * 1.4) * 1.5;
    }
  });
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.4, 1.6, 1, 20]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 4.5, 0]}>
        <boxGeometry args={[0.9, 8, 0.9]} />
        <meshStandardMaterial color="#f5d666" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* truss diagonals */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 1 + i * 1.8, 0]} rotation={[0, Math.PI / 4, Math.PI / 4]}>
          <boxGeometry args={[0.07, 1.2, 0.07]} />
          <meshStandardMaterial color="#caa84a" />
        </mesh>
      ))}
      <group ref={arm} position={[0, 8.5, 0]}>
        <mesh castShadow position={[3.5, 0, 0]}>
          <boxGeometry args={[8, 0.45, 0.45]} />
          <meshStandardMaterial color="#f5d666" />
        </mesh>
        <mesh castShadow position={[-2, 0, 0]}>
          <boxGeometry args={[2.5, 0.9, 0.9]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh castShadow position={[-2, 0.5, 0]}>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <group ref={hook} position={[6, 0, 0]}>
          <mesh position={[0, -1, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 2]} />
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

/* -------- Worker -------- */
function Worker({ center, radius = 3, speed = 0.4, color = "#f5d666" }: { center: [number, number]; radius?: number; speed?: number; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = performance.now() / 1000 * speed;
    if (ref.current) {
      ref.current.position.set(center[0] + Math.cos(t) * radius, 0.5 + Math.abs(Math.sin(t * 8)) * 0.08, center[1] + Math.sin(t) * radius);
      ref.current.rotation.y = -t + Math.PI / 2;
    }
  });
  return (
    <group ref={ref}>
      {/* legs */}
      <mesh castShadow position={[0.13, 0.25, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      <mesh castShadow position={[-0.13, 0.25, 0]}>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
      {/* torso (vest) */}
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 1.18, 0]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#e8c8a0" />
      </mesh>
      {/* helmet */}
      <mesh castShadow position={[0, 1.27, 0]}>
        <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f5d666" />
      </mesh>
    </group>
  );
}

/* -------- Smoke -------- */
function Smoke({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const N = 8;
  useFrame(() => {
    if (!ref.current) return;
    const t = performance.now() / 1000;
    ref.current.children.forEach((c, i) => {
      const local = (t * 0.3 + i / N) % 1;
      c.position.y = local * 5;
      c.position.x = Math.sin(local * 3 + i) * 0.6;
      (c as THREE.Mesh).scale.setScalar(0.4 + local * 1.4);
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = (1 - local) * 0.55;
    });
  });
  return (
    <group ref={ref} position={pos}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.6, 10, 10]} />
          <meshStandardMaterial color="#cfcfcf" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* -------- Tree -------- */
function Tree({ pos, scale = 1 }: { pos: [number, number]; scale?: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]} scale={scale}>
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 1.2, 8]} />
        <meshStandardMaterial color="#4a3220" />
      </mesh>
      <mesh castShadow position={[0, 1.5, 0]}>
        <coneGeometry args={[0.9, 1.6, 10]} />
        <meshStandardMaterial color="#2d5a2a" />
      </mesh>
      <mesh castShadow position={[0, 2.2, 0]}>
        <coneGeometry args={[0.65, 1.2, 10]} />
        <meshStandardMaterial color="#356b30" />
      </mesh>
    </group>
  );
}

/* -------- Street lamp -------- */
function StreetLamp({ pos, night }: { pos: [number, number]; night: number }) {
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 3, 8]} />
        <meshStandardMaterial color="#222" metalness={0.5} />
      </mesh>
      <mesh position={[0.5, 3, 0]}>
        <boxGeometry args={[1, 0.1, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[1, 2.9, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color="#fff5b0" emissive="#ffd66a" emissiveIntensity={0.3 + night * 2.5} />
      </mesh>
      {night > 0.4 && (
        <pointLight position={[1, 2.9, 0]} intensity={night * 1.2} distance={6} color="#ffd66a" />
      )}
    </group>
  );
}

/* -------- Building kinds -------- */
function BuildingMesh({ zone, built, progress, night }: { zone: Zone3D; built: boolean; progress: number; night: number }) {
  const [w, h, d] = zone.size;
  const curH = built ? h : Math.max(0.2, h * progress);
  const kind = zone.kind ?? "garage";

  const baseMat = (
    <meshStandardMaterial
      color={zone.color}
      metalness={0.25}
      roughness={0.65}
      emissive={built ? zone.color : "#000"}
      emissiveIntensity={built ? night * 0.15 : 0}
    />
  );

  return (
    <group>
      {/* main body */}
      <mesh castShadow receiveShadow position={[0, curH / 2, 0]}>
        <boxGeometry args={[w, curH, d]} />
        {baseMat}
      </mesh>
      {/* roof slab */}
      {built && (
        <mesh castShadow position={[0, curH + 0.18, 0]}>
          <boxGeometry args={[w + 0.5, 0.35, d + 0.5]} />
          <meshStandardMaterial color={zone.roof ?? "#222"} roughness={0.8} />
        </mesh>
      )}

      {/* Windows grid */}
      {built && [-1, 1].map((side) =>
        Array.from({ length: Math.max(2, Math.floor(w / 1.4)) }).map((_, i) =>
          Array.from({ length: Math.max(1, Math.floor(curH / 1.6)) }).map((__, row) => (
            <mesh key={`${side}-${i}-${row}`} position={[-w / 2 + 0.9 + i * 1.4, 1 + row * 1.6, (d / 2 + 0.02) * side]}>
              <boxGeometry args={[0.75, 0.7, 0.06]} />
              <meshStandardMaterial color="#bcd4ec" emissive="#ffd966" emissiveIntensity={0.2 + night * 1.8} metalness={0.6} roughness={0.2} />
            </mesh>
          )),
        ),
      )}

      {/* Door */}
      {built && (
        <mesh position={[0, 0.9, d / 2 + 0.04]}>
          <boxGeometry args={[1.4, 1.8, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
        </mesh>
      )}

      {/* Kind specific */}
      {built && kind === "casse" && (
        <group>
          {/* car wrecks pile */}
          {[[3, 0, 2], [3.8, 0, -1], [-3, 0, 2.5], [-3.5, 0.5, -1]].map((p, i) => (
            <mesh key={i} castShadow position={[p[0], 0.4 + p[1], p[2]]} rotation={[0, i, i * 0.1]}>
              <boxGeometry args={[1.4, 0.5, 2.2]} />
              <meshStandardMaterial color={["#6a4030", "#3a4a4a", "#7a5a2a", "#4a2a2a"][i]} roughness={0.9} />
            </mesh>
          ))}
          {/* tire stack */}
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[-4.5, 0.15 + i * 0.28, 3]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.13, 8, 16]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
          ))}
        </group>
      )}

      {built && kind === "garage" && (
        <group>
          {/* garage doors */}
          {[-2, 2].map((x, i) => (
            <mesh key={i} position={[x, 1, d / 2 + 0.05]}>
              <boxGeometry args={[1.8, 2, 0.08]} />
              <meshStandardMaterial color="#c4c4c4" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          {/* sign */}
          <mesh position={[0, curH - 0.5, d / 2 + 0.1]}>
            <boxGeometry args={[w * 0.7, 0.7, 0.1]} />
            <meshStandardMaterial color="#1c2838" emissive="#3a8ad0" emissiveIntensity={0.6 + night * 1.5} />
          </mesh>
        </group>
      )}

      {built && kind === "carwash" && (
        <group>
          {/* tunnel arch */}
          <mesh castShadow position={[0, 1.5, 0]}>
            <torusGeometry args={[2.5, 0.3, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#2a7aa0" metalness={0.4} />
          </mesh>
          {/* water mist */}
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[1.2, 10, 10]} />
            <meshStandardMaterial color="#bcd8ee" transparent opacity={0.25} />
          </mesh>
        </group>
      )}

      {built && kind === "casino" && (
        <group>
          {/* neon sign */}
          <mesh position={[0, curH + 1, 0]}>
            <boxGeometry args={[w * 0.8, 1.4, 0.3]} />
            <meshStandardMaterial color="#3a0000" emissive="#ff2a2a" emissiveIntensity={1.5 + night * 2} />
          </mesh>
          {/* corner spires */}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} castShadow position={[(w / 2 - 0.4) * sx, curH + 1, (d / 2 - 0.4) * sz]}>
              <coneGeometry args={[0.5, 2, 8]} />
              <meshStandardMaterial color="#5a0a0a" metalness={0.6} />
            </mesh>
          ))}
        </group>
      )}

      {built && kind === "concession" && (
        <group>
          {/* glass facade */}
          <mesh position={[0, curH * 0.5, d / 2 + 0.04]}>
            <boxGeometry args={[w - 0.6, curH - 0.8, 0.05]} />
            <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} emissive="#3a8ad0" emissiveIntensity={night * 0.6} />
          </mesh>
          {/* showroom cars */}
          {[-2.5, 0, 2.5].map((x, i) => (
            <group key={i} position={[x, 0, d / 2 + 2.5]} rotation={[0, Math.PI / 6, 0]}>
              <Car color={["#dd2a2a", "#f5d666", "#dde2e8"][i]} scale={0.85} />
            </group>
          ))}
        </group>
      )}

      {built && kind === "mall" && (
        <group>
          {/* glass entrance */}
          <mesh position={[0, 2, d / 2 + 0.04]}>
            <boxGeometry args={[w * 0.5, 3.5, 0.05]} />
            <meshStandardMaterial color="#0c1a2e" metalness={0.95} roughness={0.05} emissive="#fff" emissiveIntensity={night * 0.4} />
          </mesh>
          {/* rooftop AC units */}
          {[[-3, -2], [3, -2], [0, 2]].map(([x, z], i) => (
            <mesh key={i} castShadow position={[x, curH + 0.5, z]}>
              <boxGeometry args={[1.2, 0.7, 1.2]} />
              <meshStandardMaterial color="#888" metalness={0.5} />
            </mesh>
          ))}
        </group>
      )}

      {built && kind === "ville" && (
        <group>
          {/* broken roof */}
          <mesh castShadow position={[1, curH + 0.5, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[w * 0.5, 0.2, d]} />
            <meshStandardMaterial color="#2a1a1a" />
          </mesh>
        </group>
      )}

      {built && kind === "intl" && (
        <group>
          {/* shipping containers */}
          {[[3, 0, 2, "#c44"], [3, 0.9, 2, "#48a"], [-3, 0, -2, "#5a4"], [-3, 0, 0, "#d84"]].map((c, i) => (
            <mesh key={i} castShadow position={[c[0] as number, 0.6 + (c[1] as number), c[2] as number]}>
              <boxGeometry args={[2.5, 1.2, 1.2]} />
              <meshStandardMaterial color={c[3] as string} roughness={0.85} />
            </mesh>
          ))}
        </group>
      )}

      {/* Construction scaffolding */}
      {!built && progress > 0 && (
        <group>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
            <mesh key={i} position={[(w / 2 + 0.3) * sx, h / 2, (d / 2 + 0.3) * sz]}>
              <boxGeometry args={[0.12, h, 0.12]} />
              <meshStandardMaterial color="#f5d666" />
            </mesh>
          ))}
          {/* horizontal beams */}
          {[0, 1, 2].map((row) => (
            <group key={row}>
              <mesh position={[0, 1 + row * 1.2, d / 2 + 0.3]}>
                <boxGeometry args={[w + 0.6, 0.08, 0.08]} />
                <meshStandardMaterial color="#f5d666" />
              </mesh>
              <mesh position={[0, 1 + row * 1.2, -d / 2 - 0.3]}>
                <boxGeometry args={[w + 0.6, 0.08, 0.08]} />
                <meshStandardMaterial color="#f5d666" />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function Building({ zone, state, locked, onClick, night, children }: {
  zone: Zone3D;
  state: { estAchete: boolean; estFini: boolean; clicsEnregistres: number };
  locked: boolean;
  onClick: () => void;
  night: number;
  children?: React.ReactNode;
}) {
  const [w, _h, d] = zone.size;
  const built = state.estFini;
  const progress = state.estAchete ? Math.max(0.1, Math.min(1, state.clicsEnregistres / 15)) : 0.05;

  return (
    <group
      position={[zone.pos[0], 0, zone.pos[1]]}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "default"; }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Plot/pavement */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[w + 5, d + 5]} />
        <meshStandardMaterial color={locked ? "#1a1a1a" : built ? "#403628" : "#2a2a2a"} roughness={1} />
      </mesh>
      {/* Pavement edge */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <planeGeometry args={[w + 4.6, d + 4.6]} />
        <meshStandardMaterial color={locked ? "#222" : built ? "#5a4838" : "#363636"} roughness={1} />
      </mesh>

      {locked ? (
        <group>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[w, 2, d]} />
            <meshStandardMaterial color="#2a2a2a" roughness={1} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <torusGeometry args={[0.6, 0.18, 8, 16]} />
            <meshStandardMaterial color="#777" metalness={0.8} />
          </mesh>
        </group>
      ) : (
        <BuildingMesh zone={zone} built={built} progress={progress} night={night} />
      )}

      {children}
    </group>
  );
}

/* ============================================================ */
type City3DProps = {
  zones: Zone3D[];
  states: Record<string, { estAchete: boolean; estFini: boolean; clicsEnregistres: number }>;
  niveau: number;
  unlocks: Record<string, number>;
  onZoneClick: (id: string) => void;
  renderLabel: (zone: Zone3D) => React.ReactNode;
};

export default function City3D(props: City3DProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [night, setNight] = useState(0.5);

  if (!mounted) return <div style={{ width: "100%", height: "100%", background: "#0c0d10" }} />;

  // Decoration positions
  const trees: [number, number][] = [
    [-38, -28], [-36, 12], [-38, 32], [38, -28], [36, 0], [38, 32],
    [-12, 36], [12, 36], [-12, -32], [12, -32], [-6, 10], [6, 10],
    [-32, -4], [32, -4], [-18, 8], [18, 8],
  ];
  const lamps: [number, number][] = [
    [-30, -34], [-15, -34], [0, -34], [15, -34], [30, -34],
    [-30, 38], [-15, 38], [0, 38], [15, 38], [30, 38],
    [-42, -15], [-42, 20], [42, -15], [42, 20],
    [-24, 0], [24, 0], [-24, 12], [24, 12],
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <OrthographicCamera makeDefault position={[55, 50, 55]} zoom={10} near={0.1} far={500} />
      <CamLook />
      <fog attach="fog" args={["#b8d0e8", 90, 240]} />
      <DayNight onPhase={(d) => setNight(1 - d)} />
      <Environment preset="city" />

      <Ground />
      <Roads />
      <ContactShadows position={[0, 0.05, 0]} opacity={0.35} scale={140} blur={2.2} far={20} />

      <Traffic count={16} />
      <TowTruck phase={0} color="#e85d3a" />
      <TowTruck phase={0.5} color="#f5d666" />

      <Crane pos={[-34, 20]} />

      <Smoke pos={[-34, 4, 14]} />
      <Smoke pos={[ 30, 5, 16]} />

      <Worker center={[30, 16]} radius={4} speed={0.5} color="#3a8ad0" />
      <Worker center={[ 0, -2]} radius={5} speed={0.4} color="#86c46a" />
      <Worker center={[-24, 30]} radius={3} speed={0.6} color="#e85d3a" />
      <Worker center={[-30, 16]} radius={5} speed={0.35} color="#f5d666" />

      {trees.map((p, i) => <Tree key={i} pos={p} scale={1 + (i % 3) * 0.2} />)}
      {lamps.map((p, i) => <StreetLamp key={i} pos={p} night={night} />)}

      {props.zones.map((z) => {
        const st = props.states[z.id];
        const locked = (props.unlocks[z.id] ?? 1) > props.niveau;
        return (
          <Building
            key={z.id}
            zone={z}
            state={st}
            locked={locked}
            night={night}
            onClick={() => props.onZoneClick(z.id)}
          >
            <Html
              position={[0, (st.estFini ? z.size[1] : z.size[1] * 0.5) + 2.5, 0]}
              center
              distanceFactor={18}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "none" }}
            >
              {props.renderLabel(z)}
            </Html>
          </Building>
        );
      })}
    </Canvas>
  );
}

function CamLook() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0, 0); }, [camera]);
  return null;
}
