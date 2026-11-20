import {
  GITHUB_ANNOUNCEMENT_URL,
  GITHUB_LATEST_RELEASE_API,
  GITHUB_RELEASES_PAGE_URL,
} from '../config/releaseConfig';

export type RuntimeTarget = 'android' | 'windows' | 'web';

export interface AvailableUpdateInfo {
  version: string;
  tagName: string;
  releaseName: string;
  releaseUrl: string;
  downloadUrl: string;
  downloadLabelAr: string;
  downloadLabelEn: string;
  target: RuntimeTarget;
  summary: string;
  publishedAt: string | null;
}

export type AnnouncementTone = 'info' | 'update' | 'warning';

export interface RemoteAnnouncement {
  id: string;
  type: AnnouncementTone;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  actionLabelAr: string;
  actionLabelEn: string;
  actionUrl: string | null;
}

interface GitHubReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface GitHubLatestReleasePayload {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  assets?: unknown;
}

interface RemoteAnnouncementPayload {
  enabled?: unknown;
  id?: unknown;
  type?: unknown;
  titleAr?: unknown;
  titleEn?: unknown;
  messageAr?: unknown;
  messageEn?: unknown;
  actionLabelAr?: unknown;
  actionLabelEn?: unknown;
  actionUrl?: unknown;
  minVersion?: unknown;
  maxVersion?: unknown;
}

const RELEASE_DISMISS_KEY = 'aoa_dismissed_release_v1';
const ANNOUNCEMENT_DISMISS_KEY = 'aoa_dismissed_announcement_ids_v1';
const MAX_DISMISSED_ANNOUNCEMENTS = 30;

/** Parses a v-prefixed or plain SemVer string into a `[major, minor, patch]` tuple. */
export function parseSemver(raw: string): [number, number, number] | null {
  const cleaned = raw.trim().replace(/^[vV]/, '').split(/[-+]/)[0].trim();
  if (!cleaned) return null;

  const parts = cleaned.split('.');
  if (parts.length < 1 || parts.length > 3) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    numbers.push(Number.parseInt(part, 10));
  }

  return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0];
}

/** Compares two SemVer strings: returns `1` if `a > b`, `-1` if `a < b`, `0` otherwise. */
export function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) return 0;

  for (let i = 0; i < 3; i += 1) {
    if (parsedA[i] > parsedB[i]) return 1;
    if (parsedA[i] < parsedB[i]) return -1;
  }
  return 0;
}

/** Validates external links so only `http:` and `https:` URLs can be opened. */
export function sanitizeExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Detects whether the app is running on Android (Capacitor), Windows (Electron), or Web. */
export function detectRuntimeTarget(): RuntimeTarget {
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
      anatomyDesktop?: { isElectron?: boolean; platform?: string };
    };

    if (
      win.Capacitor?.isNativePlatform?.() &&
      win.Capacitor.getPlatform?.() === 'android'
    ) {
      return 'android';
    }

    if (
      win.anatomyDesktop?.isElectron &&
      win.anatomyDesktop.platform === 'win32'
    ) {
      return 'windows';
    }
  }

  if (typeof navigator !== 'undefined') {
    if (/Android/i.test(navigator.userAgent)) return 'android';
    if (/Windows/i.test(navigator.userAgent)) return 'windows';
  }

  return 'web';
}

/** Selects the best installer/download URL and bilingual CTA label for the active platform. */
export function pickDownloadForTarget(
  assets: GitHubReleaseAsset[],
  releaseUrl: string,
  target: RuntimeTarget
): {
  downloadUrl: string;
  downloadLabelAr: string;
  downloadLabelEn: string;
} {
  if (target === 'android') {
    const apk = assets.find(
      (asset) =>
        typeof asset.name === 'string' &&
        asset.name.toLowerCase().endsWith('.apk')
    );
    const apkUrl = sanitizeExternalUrl(apk?.browser_download_url);
    if (apkUrl) {
      return {
        downloadUrl: apkUrl,
        downloadLabelAr: 'تحميل التحديث (APK)',
        downloadLabelEn: 'Download APK',
      };
    }
  }

  if (target === 'windows') {
    const exe = assets.find(
      (asset) =>
        typeof asset.name === 'string' &&
        asset.name.toLowerCase().endsWith('.exe')
    );
    const exeUrl = sanitizeExternalUrl(exe?.browser_download_url);
    if (exeUrl) {
      return {
        downloadUrl: exeUrl,
        downloadLabelAr: 'تحميل التحديث (Windows)',
        downloadLabelEn: 'Download Setup',
      };
    }
  }

  return {
    downloadUrl: releaseUrl,
    downloadLabelAr: 'عرض الإصدار الجديد',
    downloadLabelEn: 'View Release',
  };
}

/** Checks whether `currentVersion` falls within optional `[minVersion, maxVersion]` bounds. */
export function isVersionInRange(
  currentVersion: string,
  minVersion?: string,
  maxVersion?: string
): boolean {
  const cleanMin = minVersion?.trim() ?? '';
  if (cleanMin && compareSemver(currentVersion, cleanMin) < 0) {
    return false;
  }

  const cleanMax = maxVersion?.trim() ?? '';
  if (cleanMax && compareSemver(currentVersion, cleanMax) > 0) {
    return false;
  }

  return true;
}

export function isReleaseDismissed(tagName: string): boolean {
  try {
    return window.localStorage.getItem(RELEASE_DISMISS_KEY) === tagName;
  } catch {
    return false;
  }
}

export function dismissRelease(tagName: string): void {
  try {
    window.localStorage.setItem(RELEASE_DISMISS_KEY, tagName);
  } catch {
    // Ignore storage failures in restricted WebViews
  }
}

function readDismissedAnnouncementIds(): string[] {
  try {
    const raw = window.localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function isAnnouncementDismissed(id: string): boolean {
  return readDismissedAnnouncementIds().includes(id);
}

export function dismissAnnouncement(id: string): void {
  try {
    const existing = readDismissedAnnouncementIds().filter(
      (item) => item !== id
    );
    const updated = [...existing, id].slice(-MAX_DISMISSED_ANNOUNCEMENTS);
    window.localStorage.setItem(
      ANNOUNCEMENT_DISMISS_KEY,
      JSON.stringify(updated)
    );
  } catch {
    // Ignore storage failures in restricted WebViews
  }
}

function cleanReleaseSummary(body: unknown): string {
  if (typeof body !== 'string') return '';
  const meaningfulLines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^[#>*\-\s`]+/, '').replace(/[*`]/g, '').trim())
    .filter(
      (line) =>
        line.length > 0 && !/^Full Changelog:/i.test(line)
    );

  if (meaningfulLines.length === 0) return '';
  const joined = meaningfulLines.join(' · ').replace(/\s+/g, ' ').trim();
  return joined.length > 160 ? `${joined.slice(0, 157)}...` : joined;
}

function normalizeTone(raw: unknown): AnnouncementTone {
  if (raw === 'update' || raw === 'warning') return raw;
  return 'info';
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Queries GitHub's latest published release and returns update metadata if a
 * strictly newer stable SemVer version exists; fails silently when offline.
 */
export async function fetchLatestReleaseUpdate(
  currentVersion: string,
  signal?: AbortSignal
): Promise<AvailableUpdateInfo | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const res = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as GitHubLatestReleasePayload;
    if (data.draft === true || data.prerelease === true) return null;

    const tagName = cleanString(data.tag_name);
    if (!tagName || compareSemver(tagName, currentVersion) <= 0) {
      return null;
    }

    const parsedTag = parseSemver(tagName);
    const normalizedVersion = parsedTag
      ? parsedTag.join('.')
      : tagName.replace(/^[vV]/, '');
    const releaseUrl =
      sanitizeExternalUrl(data.html_url) ?? GITHUB_RELEASES_PAGE_URL;
    const assets = Array.isArray(data.assets)
      ? (data.assets as GitHubReleaseAsset[])
      : [];
    const target = detectRuntimeTarget();
    const { downloadUrl, downloadLabelAr, downloadLabelEn } =
      pickDownloadForTarget(assets, releaseUrl, target);

    return {
      version: normalizedVersion,
      tagName,
      releaseName: cleanString(data.name) || tagName,
      releaseUrl,
      downloadUrl,
      downloadLabelAr,
      downloadLabelEn,
      target,
      summary: cleanReleaseSummary(data.body),
      publishedAt: cleanString(data.published_at) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches the remote `announcement.json` broadcast file from GitHub `main`
 * using a minute-bucket cache buster; fails silently on network/parse errors.
 */
export async function fetchRemoteAnnouncement(
  currentVersion: string,
  signal?: AbortSignal
): Promise<RemoteAnnouncement | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const cacheBucket = Math.floor(Date.now() / 60000);
    const res = await fetch(`${GITHUB_ANNOUNCEMENT_URL}?t=${cacheBucket}`, {
      cache: 'no-store',
      signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as RemoteAnnouncementPayload;
    if (data.enabled !== true) return null;

    const id = cleanString(data.id);
    if (!id) return null;

    const messageAr = cleanString(data.messageAr);
    const messageEn = cleanString(data.messageEn);
    if (!messageAr && !messageEn) return null;

    const minVersion = cleanString(data.minVersion);
    const maxVersion = cleanString(data.maxVersion);
    if (!isVersionInRange(currentVersion, minVersion, maxVersion)) {
      return null;
    }

    return {
      id,
      type: normalizeTone(data.type),
      titleAr: cleanString(data.titleAr),
      titleEn: cleanString(data.titleEn),
      messageAr,
      messageEn,
      actionLabelAr: cleanString(data.actionLabelAr),
      actionLabelEn: cleanString(data.actionLabelEn),
      actionUrl: sanitizeExternalUrl(data.actionUrl),
    };
  } catch {
    return null;
  }
}
