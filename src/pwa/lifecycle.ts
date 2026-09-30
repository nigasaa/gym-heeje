let registration: ServiceWorkerRegistration | undefined;
let reloadRequested = false;
let state = { ready: false, update: false };
const listeners = new Set<() => void>();
const notify = (change: Partial<typeof state>) => {
  state = { ...state, ...change };
  listeners.forEach((fn) => fn());
};
export const getPwaState = () => state;
export const subscribePwa = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
export function applyUpdate() {
  if (registration?.waiting) {
    reloadRequested = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}
export async function initializePwa() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only the tab accepting the update reloads; other editors keep their drafts.
    if (reloadRequested) window.location.reload();
    else notify({ update: !!registration?.waiting });
  });
  try {
    registration = await navigator.serviceWorker.register(
      new URL("sw.js", document.baseURI).href,
    );
    if (registration.waiting) notify({ update: true });
    if (registration.active) notify({ ready: true });
    registration.addEventListener("updatefound", () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed")
          notify(
            navigator.serviceWorker.controller
              ? { update: true }
              : { ready: true },
          );
      });
    });
    navigator.serviceWorker.ready.then(() => notify({ ready: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => {});
    });
  } catch {
    /* Local records remain usable if app shell caching is unavailable. */
  }
}
