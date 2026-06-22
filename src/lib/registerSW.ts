// Service worker registration wrapper. Strict guards: never registers in
// dev, iframe preview, Lovable preview hosts, or with ?sw=off. Also
// unregisters any matching /sw.js when refused so stale workers don't
// persist on those hosts.
//
// Follows the built-in Lovable PWA skill exactly. Do not register from
// anywhere else and do not introduce ad-hoc registration code.

const SW_URL = "/sw.js";

function isLovablePreviewHost(host: string): boolean {
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
      if (url.endsWith(SW_URL)) await reg.unregister();
    }
  } catch {
    // best-effort
  }
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const url = new URL(window.location.href);
  const killSwitch = url.searchParams.get("sw") === "off";

  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    isLovablePreviewHost(host) ||
    killSwitch;

  if (refused) {
    // Make sure no stale registration sticks around in preview / dev.
    void unregisterMatching();
    return;
  }

  // Defer to idle so SW install doesn't fight initial render on mobile.
  const start = () => {
    import("workbox-window")
      .then(({ Workbox }) => {
        const wb = new Workbox(SW_URL, { scope: "/" });
        wb.addEventListener("waiting", () => {
          // Auto-update: tell the new SW to activate immediately.
          wb.messageSkipWaiting();
        });
        wb.addEventListener("controlling", () => {
          // Reload once the new SW takes control so users get fresh assets.
          window.location.reload();
        });
        wb.register().catch(() => {});
      })
      .catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(start, { timeout: 4000 });
  } else {
    window.setTimeout(start, 1500);
  }
}
