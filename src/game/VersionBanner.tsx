import { useEffect, useState } from "react";
import { useVersionCheck, formatBuildDate } from "@/lib/version-check";

const DISMISS_KEY = "jce_version_banner_dismissed";

export default function VersionBanner() {
  const { hasUpdate, remote } = useVersionCheck();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissedFor = window.localStorage.getItem(DISMISS_KEY);
    if (!remote) return;
    if (dismissedFor === String(remote.builtAt)) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, [remote]);

  if (!hasUpdate || dismissed || !remote) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(remote.builtAt));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <>
      <style>{`
        .vb-banner {
          position: absolute; top: 14px; left: 14px; right: 70px; z-index: 55;
          background: rgba(20,22,28,0.95); color: #e8edf2;
          border: 1px solid #f5c542; border-radius: 12px;
          padding: 10px 12px; display: flex; align-items: center; gap: 10px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px);
          font-family: system-ui, -apple-system, sans-serif; font-size: 12px;
        }
        .vb-banner strong { color: #f5c542; }
        .vb-text { flex: 1; line-height: 1.4; }
        .vb-close {
          background: transparent; border: none; color: #8a8e94;
          font-size: 20px; cursor: pointer; line-height: 1; padding: 0 4px;
        }
        .vb-code {
          display: inline-block; background: #1f242b; color: #f5c542;
          padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 11px;
        }
      `}</style>
      <div className="vb-banner" role="status">
        <div className="vb-text">
          🆕 <strong>Nouvelle version dispo</strong> ({formatBuildDate(remote)}).
          Demande à Lovable : <span className="vb-code">fais-moi le zip</span>
        </div>
        <button className="vb-close" onClick={handleDismiss} aria-label="Masquer">×</button>
      </div>
    </>
  );
}
