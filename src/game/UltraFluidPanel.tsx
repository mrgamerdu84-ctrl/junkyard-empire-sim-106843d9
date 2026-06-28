import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { perfSettings, setPerfSettings, perfTier, targetFps } from "@/lib/perf";

export default function UltraFluidPanel() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(() => perfSettings());

  useEffect(() => {
    const sync = () => setS(perfSettings());
    window.addEventListener("mtwr.perf.changed", sync);
    return () => window.removeEventListener("mtwr.perf.changed", sync);
  }, []);

  const apply = (patch: Partial<typeof s>) => {
    setPerfSettings(patch);
    setS(perfSettings());
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Mode ultra-fluide"
        aria-label="Mode ultra-fluide"
        style={{
          position: "fixed",
          right: 10,
          bottom: 10,
          zIndex: 9999,
          width: 42,
          height: 42,
          borderRadius: 999,
          background: "rgba(15,18,22,0.85)",
          border: "1px solid rgba(255,210,80,0.4)",
          color: "#ffd650",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        }}
      >
        <Zap size={20} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mode ultra-fluide</DialogTitle>
            <DialogDescription>
              Ajuste les performances pour que le jeu reste fluide sur mobile.
              Appareil détecté : <b>{perfTier()}</b> · FPS effectif : <b>{targetFps()}</b>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Préréglage ultra-fluide</div>
              <div className="text-xs text-muted-foreground">Force 20 FPS, peu d'entités, sans effets.</div>
            </div>
            <Switch
              checked={s.ultraFluid}
              onCheckedChange={(v) => apply({ ultraFluid: v })}
            />
          </div>

          <div className="py-2">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-sm">Densité d'entités</span>
              <span className="text-xs text-muted-foreground">{Math.round(s.entityScale * 100)}%</span>
            </div>
            <Slider
              min={10} max={100} step={5}
              value={[Math.round(s.entityScale * 100)]}
              onValueChange={([v]) => apply({ entityScale: v / 100 })}
            />
          </div>

          <div className="py-2">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-sm">Limite FPS</span>
              <span className="text-xs text-muted-foreground">{s.fpsCap} fps</span>
            </div>
            <Slider
              min={15} max={60} step={1}
              value={[s.fpsCap]}
              onValueChange={([v]) => apply({ fpsCap: v })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">Désactiver les effets</div>
              <div className="text-xs text-muted-foreground">Halos, ombres, animations décoratives.</div>
            </div>
            <Switch
              checked={s.fxOff}
              onCheckedChange={(v) => apply({ fxOff: v })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                apply({ ultraFluid: false, entityScale: 1, fpsCap: 60, fxOff: false });
              }}
            >
              Réinitialiser
            </Button>
            <Button className="flex-1" onClick={() => window.location.reload()}>
              Appliquer & recharger
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
