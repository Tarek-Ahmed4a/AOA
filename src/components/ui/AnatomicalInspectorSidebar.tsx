import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Database,
  ExternalLink,
  EyeOff,
  Focus,
  GitBranch,
  Globe,
  HeartPulse,
  Loader2,
  Scissors,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import { ANATOMICAL_SYSTEMS } from '../../config/anatomicalSystems';
import { cn } from '../../lib/utils';
import {
  useAnatomyStore,
  type MobileSheetSnap,
} from '../../store/useAnatomyStore';

const SNAP_ORDER: MobileSheetSnap[] = ['peek', 'half', 'full'];

const MOBILE_SNAP_HEIGHT_CLASSES: Record<MobileSheetSnap, string> = {
  peek: 'h-[22dvh]',
  half: 'h-[52dvh]',
  full: 'h-[86dvh]',
};

export const AnatomicalInspectorSidebar: React.FC = () => {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const medicalProfile = useAnatomyStore((s) => s.medicalProfile);
  const isLoadingMedicalData = useAnatomyStore((s) => s.isLoadingMedicalData);
  const language = useAnatomyStore((s) => s.language);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const slicing = useAnatomyStore((s) => s.slicing);
  const mobileSheetSnap = useAnatomyStore((s) => s.mobileSheetSnap);
  const activeTab = useAnatomyStore((s) => s.activeTab);

  const setLanguage = useAnatomyStore((s) => s.setLanguage);
  const selectPart = useAnatomyStore((s) => s.selectPart);
  const focusSelectedPart = useAnatomyStore((s) => s.focusSelectedPart);
  const toggleIsolateSelected = useAnatomyStore((s) => s.toggleIsolateSelected);
  const peelSelectedPart = useAnatomyStore((s) => s.peelSelectedPart);
  const updateSlicing = useAnatomyStore((s) => s.updateSlicing);
  const setMobileSheetSnap = useAnatomyStore((s) => s.setMobileSheetSnap);
  const openTextbookReference = useAnatomyStore((s) => s.openTextbookReference);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [medicalProfile?.thumbnailUrl, selectedPart?.meshUuid]);

  if (!selectedPart || !medicalProfile || activeTab === 'pdf-books') {
    return null;
  }

  const cycleSheetSnap = () => {
    const idx = SNAP_ORDER.indexOf(mobileSheetSnap);
    setMobileSheetSnap(SNAP_ORDER[(idx + 1) % SNAP_ORDER.length]);
  };

  const handleHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragStartYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleHandlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const idx = SNAP_ORDER.indexOf(mobileSheetSnap);
    if (deltaY < -28) {
      // Swiped up -> expand
      setMobileSheetSnap(SNAP_ORDER[Math.min(idx + 1, SNAP_ORDER.length - 1)]);
    } else if (deltaY > 28) {
      // Swiped down -> collapse
      setMobileSheetSnap(SNAP_ORDER[Math.max(idx - 1, 0)]);
    } else {
      // Tap -> cycle peek -> half -> full
      cycleSheetSnap();
    }
  };

  const systemInfo = ANATOMICAL_SYSTEMS[medicalProfile.system];
  const isArabic = language === 'ar';
  const isIsolated =
    isolatedPartId === selectedPart.meshUuid ||
    isolatedPartId === selectedPart.rawName;
  const isOrganSlicingActive =
    slicing.enabled && slicing.scope === 'selected';
  const isPeekMode = mobileSheetSnap === 'peek';

  const isPrimaryTextbook = medicalProfile.source === 'textbook-primary';
  const sourceBadge =
    isPrimaryTextbook
      ? {
          label: '📘 PRIMARY SOURCE: ANATOMY TEXTBOOK',
          cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        }
      : medicalProfile.source === 'live-api'
      ? {
          label: 'LIVE API',
          cls: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-300',
        }
      : medicalProfile.source === 'cached'
      ? {
          label: 'CACHED',
          cls: 'border-sky-400/35 bg-sky-500/15 text-sky-300',
        }
      : {
          label: 'OFFLINE BASELINE',
          cls: 'border-amber-400/35 bg-amber-500/15 text-amber-300',
        };

  const enWikiReferenceUrl =
    medicalProfile.wikipediaUrlEn ||
    `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
      medicalProfile.cleanNameEn
    )}`;

  const arWikiReferenceUrl =
    medicalProfile.wikipediaUrlAr ||
    `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
      medicalProfile.cleanNameAr || medicalProfile.cleanNameEn
    )}`;

  const wikidataReferenceUrl =
    medicalProfile.wikidataUrl ??
    `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(
      medicalProfile.ta98Code || medicalProfile.latinName
    )}`;

  return (
    <aside
      aria-label="Anatomical Clinical Inspector"
      className={cn(
        'pointer-events-auto fixed bottom-0 left-0 right-0 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#08080c]/95 shadow-[0_20px_60px_rgba(0,0,0,0.94)] backdrop-blur-xl transition-[height] duration-300 ease-out md:bottom-20 md:left-auto md:right-4 md:top-[146px] md:h-auto md:w-96 md:rounded-2xl md:transition-none 2xl:top-16',
        MOBILE_SNAP_HEIGHT_CLASSES[mobileSheetSnap]
      )}
    >
      {/* Mobile Ergonomic Bottom-Sheet Drag & Snap Handle Bar */}
      <button
        type="button"
        onPointerDown={handleHandlePointerDown}
        onPointerUp={handleHandlePointerUp}
        aria-label={`Resize clinical panel (current: ${mobileSheetSnap})`}
        className="flex w-full shrink-0 touch-none items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2 md:hidden"
      >
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
          {mobileSheetSnap}
        </span>
        <span className="h-1 w-10 rounded-full bg-white/30" />
        <span className="flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-wider text-sky-300">
          {mobileSheetSnap === 'full' ? (
            <>
              <span>Min</span>
              <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              <span>Expand</span>
              <ChevronUp className="h-3 w-3" />
            </>
          )}
        </span>
      </button>

      {/* Header Bar */}
      <header className="shrink-0 border-b border-white/10 px-4 pb-3 pt-2.5 md:pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
              style={{ backgroundColor: systemInfo.accentColor }}
            />
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-200">
              {systemInfo.label}
            </span>
            <span className="rounded border border-sky-400/25 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
              {medicalProfile.laterality === 'Median / Unpaired'
                ? 'Median'
                : medicalProfile.laterality}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Language Switcher (AR | EN) */}
            <div
              role="group"
              aria-label="Language Switcher"
              className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 font-mono text-[10px]"
            >
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-semibold transition-colors',
                  isArabic
                    ? 'bg-sky-500/25 text-sky-200'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                AR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-semibold transition-colors',
                  !isArabic
                    ? 'bg-sky-500/25 text-sky-200'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={() => selectPart(null)}
              title="Close Inspector [Esc]"
              aria-label="Close Anatomical Inspector"
              className="rounded-lg border border-white/10 bg-white/5 p-1 text-zinc-400 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Bilingual Title + Latin TA98 Name */}
        <div className="mt-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h2 className="text-base font-bold tracking-tight text-white">
              {medicalProfile.cleanNameEn}
            </h2>
            <span
              dir="rtl"
              className="text-sm font-semibold text-sky-200/95"
            >
              {medicalProfile.cleanNameAr}
            </span>
          </div>
          <p className="mt-0.5 font-serif text-xs italic text-zinc-400">
            {medicalProfile.latinName}
          </p>
        </div>

        {/* Ontology Codes + Data Source Row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-200">
            TA98: {medicalProfile.ta98Code}
          </span>
          {medicalProfile.fmaId && (
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-zinc-300">
              {medicalProfile.fmaId}
            </span>
          )}
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold',
              sourceBadge.cls
            )}
          >
            {isLoadingMedicalData ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Database className="h-2.5 w-2.5" />
            )}
            <span>
              {isLoadingMedicalData ? 'SYNCING WIKI...' : sourceBadge.label}
            </span>
          </span>
        </div>

        {(medicalProfile.region || medicalProfile.textbookRefCitation) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[9.5px] text-emerald-200/90">
            {medicalProfile.region && (
              <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5">
                {medicalProfile.region}
                {medicalProfile.muscleGroup ? ` • ${medicalProfile.muscleGroup}` : ''}
              </span>
            )}
            {medicalProfile.textbookRefCitation && (
              <span className="truncate rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-zinc-300">
                {medicalProfile.textbookRefCitation}
              </span>
            )}
          </div>
        )}

        {/* Quick Surgical Action Strip */}
        <div
          className={cn(
            'mt-2.5 grid grid-cols-4 gap-1.5 md:grid',
            isPeekMode && 'hidden'
          )}
        >
          <button
            type="button"
            onClick={focusSelectedPart}
            title="Focus Camera [F]"
            className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] font-medium text-zinc-200 transition-all hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white active:scale-95"
          >
            <Crosshair className="h-3 w-3 shrink-0 text-sky-400" />
            <span className="truncate">Focus</span>
          </button>

          <button
            type="button"
            onClick={toggleIsolateSelected}
            title="Isolate Organ [I]"
            className={cn(
              'flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-medium transition-all active:scale-95',
              isIsolated
                ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                : 'border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10'
            )}
          >
            <Focus className="h-3 w-3 shrink-0" />
            <span className="truncate">{isIsolated ? 'Isolated' : 'Isolate'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              updateSlicing(
                isOrganSlicingActive
                  ? { enabled: false }
                  : { enabled: true, scope: 'selected' }
              )
            }
            title="Slice Selected Organ [S]"
            className={cn(
              'flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-medium transition-all active:scale-95',
              isOrganSlicingActive
                ? 'border-sky-400/55 bg-sky-500/25 text-white'
                : 'border-white/10 bg-white/5 text-zinc-200 hover:border-sky-400/40 hover:bg-sky-500/15'
            )}
          >
            <Scissors className="h-3 w-3 shrink-0 text-sky-300" />
            <span className="truncate">Slice</span>
          </button>

          <button
            type="button"
            onClick={peelSelectedPart}
            title="Peel / Hide Organ [H]"
            className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] font-medium text-zinc-200 transition-all hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-100 active:scale-95"
          >
            <EyeOff className="h-3 w-3 shrink-0 text-rose-400" />
            <span className="truncate">Peel</span>
          </button>
        </div>
      </header>

      {/* Scrollable Clinical Documentation Body */}
      <div
        className={cn(
          'flex-1 space-y-3.5 overflow-y-auto touch-pan-y px-4 py-3.5 md:block',
          isPeekMode && 'hidden'
        )}
      >
        {/* Optional Anatomical Thumbnail + Overview */}
        <section aria-label="Anatomical Overview">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <BookOpen className="h-3 w-3 text-sky-400" />
            <span>
              {isArabic
                ? 'الوصف التشريحي والوظيفة'
                : 'Anatomical Overview & Function'}
            </span>
          </div>

          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-200"
          >
            {medicalProfile.thumbnailUrl && !thumbnailFailed && (
              <img
                src={medicalProfile.thumbnailUrl}
                alt={medicalProfile.cleanNameEn}
                onError={() => setThumbnailFailed(true)}
                className={cn(
                  'mb-2 h-20 w-20 rounded-lg border border-white/10 bg-black/50 object-cover',
                  isArabic ? 'float-left mr-3' : 'float-right ml-3'
                )}
              />
            )}
            <p className="text-zinc-200">
              {isArabic ? medicalProfile.summaryAr : medicalProfile.summaryEn}
            </p>
            <div className="clear-both mt-2.5 border-t border-white/10 pt-2 text-[11px] text-zinc-300">
              <span className="font-semibold text-sky-300">
                {isArabic ? 'الوظيفة الأساسية: ' : 'Primary Function: '}
              </span>
              <span>
                {isArabic
                  ? medicalProfile.primaryFunctionAr
                  : medicalProfile.primaryFunctionEn}
              </span>
            </div>

            {medicalProfile.secondaryWikiSummaryEn &&
              medicalProfile.secondaryWikiSummaryEn !== medicalProfile.summaryEn && (
                <p className="mt-2 border-t border-white/5 pt-2 text-[11px] text-zinc-400">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-sky-300/90">
                    Secondary Reference (Wiki):{' '}
                  </span>
                  {isArabic && medicalProfile.secondaryWikiSummaryAr
                    ? medicalProfile.secondaryWikiSummaryAr
                    : medicalProfile.secondaryWikiSummaryEn}
                </p>
              )}
          </div>
        </section>

        {(medicalProfile.origin ||
          medicalProfile.insertion ||
          medicalProfile.action ||
          medicalProfile.relationsEn) && (
          <section aria-label="Attachments and Anatomical Relations">
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              <BookOpen className="h-3 w-3 text-emerald-400" />
              <span>
                {isArabic
                  ? 'المنشأ والمغرز والعلاقات التشريحية'
                  : 'Origin, Insertion & Anatomical Relations'}
              </span>
            </div>

            <div className="space-y-1.5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-2.5 text-xs text-zinc-200">
              {medicalProfile.origin && (
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase text-emerald-300">
                    Origin (Proximal):{' '}
                  </span>
                  <span>{medicalProfile.origin}</span>
                </div>
              )}
              {medicalProfile.insertion && (
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase text-emerald-300">
                    Insertion (Distal):{' '}
                  </span>
                  <span>{medicalProfile.insertion}</span>
                </div>
              )}
              {medicalProfile.action && (
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase text-sky-300">
                    Action:{' '}
                  </span>
                  <span>{medicalProfile.action}</span>
                </div>
              )}
              {medicalProfile.relationsEn && (
                <div>
                  <span className="font-mono text-[10px] font-semibold uppercase text-emerald-300">
                    Anatomical Relations:{' '}
                  </span>
                  <span>{medicalProfile.relationsEn}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Vascular & Neural Supply Grid (3 Clinical Cards) */}
        <section aria-label="Vascular and Neural Supply">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <Activity className="h-3 w-3 text-rose-400" />
            <span>
              {isArabic
                ? 'التروية الدموية والتعصيب'
                : 'Neurovascular Supply'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Arterial Supply */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-rose-400" />
                  <span>Arterial Supply</span>
                </span>
                <span dir="rtl" className="text-[11px] text-rose-200/90">
                  التغذية الشريانية
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-zinc-200">
                {medicalProfile.arterialSupply}
              </p>
            </div>

            {/* Venous Drainage */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-blue-300">
                <span className="flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-blue-400" />
                  <span>Venous Drainage</span>
                </span>
                <span dir="rtl" className="text-[11px] text-blue-200/90">
                  التصريف الوريدي
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-zinc-200">
                {medicalProfile.venousDrainage}
              </p>
            </div>

            {/* Innervation */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Innervation</span>
                </span>
                <span dir="rtl" className="text-[11px] text-amber-200/90">
                  التغذية العصبية
                </span>
              </div>
              <p className="mt-1 text-xs leading-snug text-zinc-200">
                {medicalProfile.innervation}
              </p>
            </div>
          </div>
        </section>

        {/* Clinical & Pathological Significance Box */}
        <section aria-label="Clinical and Pathological Notes">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            <Stethoscope className="h-3 w-3 text-emerald-400" />
            <span>
              {isArabic
                ? 'الأهمية السريرية والمرضية'
                : 'Clinical & Pathological Significance'}
            </span>
          </div>

          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-xs leading-relaxed text-zinc-200"
          >
            {isArabic
              ? medicalProfile.clinicalNotesAr
              : medicalProfile.clinicalNotesEn}
          </div>
        </section>
      </div>

      {/* Verified Scientific References Footer */}
      <footer
        className={cn(
          'shrink-0 border-t border-white/10 bg-black/40 px-4 py-2.5 md:block',
          isPeekMode && 'hidden'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-1 uppercase tracking-wider text-zinc-500">
            <Globe className="h-3 w-3" />
            <span>References</span>
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {medicalProfile.textbookRefCitation && (
              <button
                type="button"
                onClick={() =>
                  openTextbookReference({
                    query: medicalProfile.cleanNameEn,
                    citationLabel: medicalProfile.textbookRefCitation,
                    netterPlates: medicalProfile.netterPlates,
                  })
                }
                title={`Open in Reference Books (PDF): ${medicalProfile.textbookRefCitation}`}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-emerald-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/25 hover:text-white active:scale-95"
              >
                <span>📘 Textbook Ref</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            )}
            <a
              href={enWikiReferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-200 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white"
            >
              <span>EN Wiki</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={arWikiReferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-200 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white"
            >
              <span>AR Wiki</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={wikidataReferenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-zinc-200 transition-colors hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-white"
            >
              <span>TA98 / Wikidata</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </footer>
    </aside>
  );
};
