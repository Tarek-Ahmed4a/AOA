/**
 * Resolves relative and root-prefixed public asset paths (`/models/...`, `/books/...`)
 * cleanly across Vite dev (`http://localhost`), hosted web (`https://`), Electron
 * desktop (`app://bundle/` or `file://`), and Capacitor Android (`https://localhost/`).
 */
export function resolveAssetUrl(assetPath: string): string {
  const raw = String(assetPath || '').trim();
  if (!raw) return '';

  if (/^(?:https?:|data:|blob:|file:|capacitor:|ionic:|app:)/i.test(raw)) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, '');
  const baseUrl =
    (typeof import.meta !== 'undefined' &&
      (import.meta as unknown as { env?: { BASE_URL?: string } }).env
        ?.BASE_URL) ||
    './';

  if (
    typeof window !== 'undefined' &&
    window.location?.href &&
    !window.location.href.startsWith('about:')
  ) {
    try {
      const resolvedBase = new URL(baseUrl, window.location.href);
      return new URL(normalized, resolvedBase).href;
    } catch {
      // Fallback to prefixed relative path below
    }
  }

  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${prefix}${normalized}`;
}
