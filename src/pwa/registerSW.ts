// vite-plugin-pwa exposes a virtual module that registers the SW.
// We import it dynamically so dev mode (no SW) doesn't break.
export function registerSW() {
  if (typeof window === 'undefined') return;
  if (import.meta.env.DEV) return;
  import('virtual:pwa-register')
    .then(({ registerSW: register }) => {
      register({ immediate: true });
    })
    .catch(() => {
      /* PWA registration is best-effort */
    });
}
