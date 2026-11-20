import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ExternalLink,
  Megaphone,
  Sparkles,
  X,
} from 'lucide-react';
import { APP_VERSION } from '../../config/releaseConfig';
import { cn } from '../../lib/utils';
import {
  dismissAnnouncement,
  dismissRelease,
  fetchLatestReleaseUpdate,
  fetchRemoteAnnouncement,
  isAnnouncementDismissed,
  isReleaseDismissed,
  type AnnouncementTone,
  type AvailableUpdateInfo,
  type RemoteAnnouncement,
} from '../../services/updateAndAnnouncementService';

const CHECK_DELAY_MS = 2500;
const REQUEST_TIMEOUT_MS = 8000;

const TONE_STYLES: Record<
  AnnouncementTone,
  {
    border: string;
    iconWrap: string;
    badge: string;
    cta: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  info: {
    border: 'border-sky-500/35',
    iconWrap: 'border-sky-500/35 bg-sky-500/15 text-sky-300',
    badge: 'border-sky-500/35 bg-sky-500/15 text-sky-300',
    cta: 'border-sky-400/45 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30',
    Icon: Megaphone,
  },
  update: {
    border: 'border-emerald-500/35',
    iconWrap: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
    badge: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
    cta: 'border-emerald-400/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30',
    Icon: Sparkles,
  },
  warning: {
    border: 'border-amber-500/35',
    iconWrap: 'border-amber-500/35 bg-amber-500/15 text-amber-300',
    badge: 'border-amber-500/35 bg-amber-500/15 text-amber-300',
    cta: 'border-amber-400/45 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30',
    Icon: AlertTriangle,
  },
};

/**
 * Checks once in the background after initial boot for a newer GitHub Release
 * or an active remote `announcement.json` message and shows a non-blocking banner.
 */
export const UpdateAnnouncementBanner: React.FC = () => {
  const [update, setUpdate] = useState<AvailableUpdateInfo | null>(null);
  const [announcement, setAnnouncement] = useState<RemoteAnnouncement | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let timeoutId: number | undefined;

    const delayId = window.setTimeout(async () => {
      timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const [updateResult, announcementResult] = await Promise.allSettled([
          fetchLatestReleaseUpdate(APP_VERSION, controller.signal),
          fetchRemoteAnnouncement(APP_VERSION, controller.signal),
        ]);

        if (cancelled) return;

        if (
          updateResult.status === 'fulfilled' &&
          updateResult.value &&
          !isReleaseDismissed(updateResult.value.tagName)
        ) {
          setUpdate(updateResult.value);
        }

        if (
          announcementResult.status === 'fulfilled' &&
          announcementResult.value &&
          !isAnnouncementDismissed(announcementResult.value.id)
        ) {
          setAnnouncement(announcementResult.value);
        }
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    }, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      controller.abort();
    };
  }, []);

  if (update) {
    const showSecondaryNotes = update.downloadUrl !== update.releaseUrl;
    return (
      <div className="pointer-events-none fixed left-1/2 top-14 z-[55] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:top-[68px]">
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#0a0c10]/95 p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15 text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  dir="rtl"
                  className="text-xs font-semibold text-zinc-100"
                >
                  يوجد إصدار جديد متاح
                </span>
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  {update.tagName}
                </span>
              </div>

              <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                New version available (Current: v{APP_VERSION})
              </p>

              {update.summary && (
                <p
                  dir="auto"
                  className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-300"
                >
                  {update.summary}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={update.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>{update.downloadLabelEn}</span>
                </a>

                {showSecondaryNotes && (
                  <a
                    href={update.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                  >
                    <span>View Release</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    dismissRelease(update.tagName);
                    setUpdate(null);
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                >
                  <span>OK</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              aria-label="Dismiss update notification"
              onClick={() => {
                dismissRelease(update.tagName);
                setUpdate(null);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (announcement) {
    const tone = TONE_STYLES[announcement.type];
    const ToneIcon = tone.Icon;
    const actionLabel =
      announcement.actionLabelEn ||
      announcement.actionLabelAr ||
      'View Release';

    return (
      <div className="pointer-events-none fixed left-1/2 top-14 z-[55] w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:top-[68px]">
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'pointer-events-auto overflow-hidden rounded-2xl border bg-[#0a0c10]/95 p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-xl',
            tone.border
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                tone.iconWrap
              )}
            >
              <ToneIcon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              {announcement.titleAr && (
                <div
                  dir="auto"
                  className="text-xs font-semibold text-zinc-100"
                >
                  {announcement.titleAr}
                </div>
              )}

              {announcement.titleEn && (
                <div className="mt-0.5 font-mono text-[10px] text-zinc-400">
                  {announcement.titleEn}
                </div>
              )}

              {announcement.messageAr && (
                <p
                  dir="auto"
                  className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-zinc-200"
                >
                  {announcement.messageAr}
                </p>
              )}

              {announcement.messageEn && (
                <p
                  dir="auto"
                  className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-zinc-400"
                >
                  {announcement.messageEn}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {announcement.actionUrl && (
                  <a
                    href={announcement.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                      tone.cta
                    )}
                  >
                    <span dir="auto">{actionLabel}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    dismissAnnouncement(announcement.id);
                    setAnnouncement(null);
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <span>OK</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              aria-label="Dismiss announcement"
              onClick={() => {
                dismissAnnouncement(announcement.id);
                setAnnouncement(null);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
