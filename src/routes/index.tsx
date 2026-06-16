import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Junky City Empire" },
      { name: "description", content: "Construis ton empire de casses automobiles et stations de lavage." },
      { property: "og:title", content: "Junky City Empire" },
      { property: "og:description", content: "Construis ton empire de casses automobiles et stations de lavage." },
    ],
  }),
  component: JunkyCityEmpire,
});

type Car = {
  el: HTMLDivElement | null;
  targetIndex: number;
  x: number;
  y: number;
  speed: number;
  baseSpeed: number;
  enLavage: boolean;
};

const route = [
  { x: 100, y: 150 },
  { x: 680, y: 150 },
  { x: 680, y: 520 },
  { x: 100, y: 520 },
];

function JunkyCityEmpire() {
  const [argent, setArgent] = useState(260);
  const argentRef = useRef(argent);
  argentRef.current = argent;

  const car1Ref = useRef<HTMLDivElement>(null);
  const car2Ref = useRef<HTMLDivElement>(null);
  const bubblesRef = useRef<HTMLDivElement>(null);

  const carsRef = useRef<Car[]>([
    { el: null, targetIndex: 0, x: 100, y: 150, speed: 2, baseSpeed: 2, enLavage: false },
    { el: null, targetIndex: 2, x: 680, y: 520, speed: 1.5, baseSpeed: 1.5, enLavage: false },
  ]);

  useEffect(() => {
    carsRef.current[0].el = car1Ref.current;
    carsRef.current[1].el = car2Ref.current;

    let raf = 0;

    const declencherLavage = (car: Car) => {
      car.enLavage = true;
      const prev = car.speed;
      car.speed = 0;
      if (bubblesRef.current) bubblesRef.current.style.display = "block";

      setTimeout(() => {
        car.speed = prev;
        car.enLavage = false;
        if (bubblesRef.current) bubblesRef.current.style.display = "none";
        setArgent((a) => a + 50);
        if (car.el) car.el.style.backgroundColor = "#00ffcc";
      }, 2000);
    };

    const tick = (car: Car) => {
      const cible = route[car.targetIndex];
      const dx = cible.x - car.x;
      const dy = cible.y - car.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        car.x += (dx / dist) * car.speed;
        car.y += (dy / dist) * car.speed;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (car.el) {
          car.el.style.transform = `translate(${car.x}px, ${car.y}px) rotate(${angle}deg)`;
        }
      } else {
        car.targetIndex = (car.targetIndex + 1) % route.length;
      }
      if (Math.abs(car.x - 450) < 20 && Math.abs(car.y - 150) < 20 && !car.enLavage) {
        declencherLavage(car);
      }
    };

    const loop = () => {
      for (const c of carsRef.current) tick(c);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const boostEmpire = () => {
    setArgent((a) => a + 500);
    const [c1, c2] = carsRef.current;
    c1.speed = 5;
    c2.speed = 4;
    setTimeout(() => {
      c1.speed = c1.baseSpeed;
      c2.speed = c2.baseSpeed;
    }, 3000);
  };

  return (
    <div className="jce-root">
      <style>{`
        .jce-root {
          margin: 0; padding: 0;
          background-color: #1a1a1a;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          overflow: hidden; color: white; user-select: none;
          width: 100vw; height: 100vh; position: relative;
        }
        .jce-top-bar {
          position: absolute; top: 0; width: 100%; height: 60px;
          background: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 100%);
          display: flex; justify-content: space-around; align-items: center;
          border-bottom: 2px solid #ff7300; z-index: 10;
        }
        .jce-stat-box { text-align: center; }
        .jce-stat-label { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
        .jce-stat-value { font-size: 18px; font-weight: bold; color: #ffb700; }
        .jce-city-map {
          position: relative; width: 100vw; height: 100vh;
          background-color: #2e2e2e;
          background-image:
            radial-gradient(#3a3a3a 20%, transparent 20%),
            radial-gradient(#3a3a3a 20%, transparent 20%);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
        }
        .jce-road {
          position: absolute; background-color: #111;
          border: 2px dashed #555; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
        }
        .jce-road-loop { top: 150px; left: 100px; width: 600px; height: 400px; border-radius: 20px; }
        .jce-building {
          position: absolute; border-radius: 8px; border: 2px solid #333;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          font-weight: bold; font-size: 12px; text-align: center;
          box-shadow: 0 10px 20px rgba(0,0,0,0.5);
        }
        .jce-junkyard { top: 220px; left: 200px; width: 160px; height: 120px; background-color: #4a3c31; border-color: #ff7300; }
        .jce-carwash { top: 220px; left: 420px; width: 140px; height: 120px; background-color: #1a3c5a; border-color: #00a2ff; }
        .jce-crane {
          width: 6px; height: 50px; background-color: #ff7300;
          position: absolute; top: 30px; left: 80px;
          transform-origin: bottom center;
          animation: jceSwingCrane 4s infinite ease-in-out;
        }
        @keyframes jceSwingCrane {
          0% { transform: rotate(-45deg); }
          50% { transform: rotate(45deg); }
          100% { transform: rotate(-45deg); }
        }
        .jce-bubbles {
          position: absolute; width: 100%; height: 20px; bottom: 10px;
          background: rgba(255,255,255,0.3); display: none;
        }
        .jce-car {
          position: absolute; width: 30px; height: 20px;
          background-color: #ff3333; border-radius: 4px; border: 1px solid #000;
          transition: background-color 0.5s; z-index: 5; top: 0; left: 0;
        }
        .jce-car::after {
          content: ''; position: absolute; right: 4px; top: 4px;
          width: 6px; height: 12px; background-color: #88ccff; border-radius: 2px;
        }
        .jce-depanneuse { background-color: #ffb700; width: 35px; }
        .jce-visiteur { background-color: #3388ff; }
        .jce-play-btn {
          position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
          padding: 15px 60px;
          background: linear-gradient(180deg, #ffb700 0%, #ff7300 100%);
          border: none; border-radius: 30px; color: black;
          font-size: 22px; font-weight: bold; letter-spacing: 2px; cursor: pointer;
          box-shadow: 0 5px 15px rgba(255, 115, 0, 0.4); transition: 0.2s;
          z-index: 10;
        }
        .jce-play-btn:hover { transform: translateX(-50%) scale(1.05); }
      `}</style>

      <div className="jce-top-bar">
        <div className="jce-stat-box">
          <div className="jce-stat-label">Argent</div>
          <div className="jce-stat-value">{argent} €</div>
        </div>
        <div className="jce-stat-box">
          <div className="jce-stat-label">Niveau</div>
          <div className="jce-stat-value">LVL 1</div>
        </div>
        <div className="jce-stat-box">
          <div className="jce-stat-label">Ressources</div>
          <div className="jce-stat-value">🔧 15 / ⚙️ 8</div>
        </div>
      </div>

      <div className="jce-city-map">
        <div className="jce-road jce-road-loop" />
        <div className="jce-building jce-junkyard">
          🏚️ CASSE AUTO
          <div className="jce-crane" />
        </div>
        <div className="jce-building jce-carwash">
          🚿 WASH STATION
          <div ref={bubblesRef} className="jce-bubbles" />
        </div>
        <div ref={car1Ref} className="jce-car jce-visiteur" />
        <div ref={car2Ref} className="jce-car jce-depanneuse" />
      </div>

      <button className="jce-play-btn" onClick={boostEmpire}>JOUER</button>
    </div>
  );
}
