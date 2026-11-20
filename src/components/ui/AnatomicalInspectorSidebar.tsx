import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Database,
  Dna,
  ExternalLink,
  EyeOff,
  Focus,
  GitBranch,
  Globe,
  HeartPulse,
  Loader2,
  Maximize2,
  Microscope,
  Ruler,
  Scissors,
  Stethoscope,
  X,
  Zap,
} from 'lucide-react';
import { ANATOMICAL_SYSTEMS } from '../../config/anatomicalSystems';
import { cn } from '../../lib/utils';
import {
  fetchHraClinicalEnrichment,
  getCachedHraSurgicalLandmarksSync,
  getHraSurgicalLandmarks,
  matchLandmarksForOrgan,
  type HraClinicalEnrichment,
  type HraSurgicalLandmarkGlb,
} from '../../services/hraClinicalService';
import {
  useAnatomyStore,
  useAppNavigationStore,
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
  const [hraEnrichment, setHraEnrichment] =
    useState<HraClinicalEnrichment | null>(null);
  const [isLoadingHra, setIsLoadingHra] = useState(false);
  const [activeFtuIndex, setActiveFtuIndex] = useState(0);
  const [ftuModalOpen, setFtuModalOpen] = useState(false);
  const [landmarksCatalog, setLandmarksCatalog] = useState<
    HraSurgicalLandmarkGlb[]
  >(() => getCachedHraSurgicalLandmarksSync());
  const dragStartYRef = useRef<number | null>(null);

  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const medicalProfile = useAnatomyStore((s) => s.medicalProfile);
  const isLoadingMedicalData = useAnatomyStore((s) => s.isLoadingMedicalData);
  const language = useAnatomyStore((s) => s.language);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const slicing = useAnatomyStore((s) => s.slicing);
  const mobileSheetSnap = useAnatomyStore((s) => s.mobileSheetSnap);
  const activeTab = useAppNavigationStore((s) => s.activeTab);
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );
  const showSurgicalLandmarks = useAnatomyStore(
    (s) => s.showSurgicalLandmarks
  );
  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const customGlbName = useAnatomyStore((s) => s.customGlbName);
  const setShowSurgicalLandmarks = useAnatomyStore(
    (s) => s.setShowSurgicalLandmarks
  );
  const setLandmarkFilterMode = useAnatomyStore(
    (s) => s.setLandmarkFilterMode
  );
  const activePartLandmarks = useAnatomyStore((s) => s.activePartLandmarks);
  const focusedLandmarkId = useAnatomyStore((s) => s.focusedLandmarkId);
  const setFocusedLandmarkId = useAnatomyStore((s) => s.setFocusedLandmarkId);
  const focusLandmarkPoint = useAnatomyStore((s) => s.focusLandmarkPoint);

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

  useEffect(() => {
    if (!selectedPart || activeTab === 'pdf-books' || activeTab === 'feedback') {
      setHraEnrichment(null);
      setIsLoadingHra(false);
      return;
    }
    let cancelled = false;
    setActiveFtuIndex(0);
    setFtuModalOpen(false);
    setIsLoadingHra(true);
    const isLandmarkPart = selectedPart.ta98Code === 'HRA-LMK';
    const parentLabelFromLandmark = isLandmarkPart
      ? selectedPart.latinName.split('•').pop()?.trim() || selectedPart.cleanName
      : selectedPart.cleanName;
    const enrichmentTargetPart = isLandmarkPart
      ? { ...selectedPart, cleanName: parentLabelFromLandmark }
      : selectedPart;
    void fetchHraClinicalEnrichment(enrichmentTargetPart)
      .then((res) => {
        if (!cancelled) {
          setHraEnrichment(res);
          setIsLoadingHra(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHraEnrichment(null);
          setIsLoadingHra(false);
        }
      });
    void getHraSurgicalLandmarks().then((items) => {
      if (!cancelled && items.length > 0) {
        setLandmarksCatalog(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    selectedPart?.meshUuid,
    selectedPart?.rawName,
    selectedPart?.cleanName,
    selectedPart?.system,
    activeTab,
  ]);

  const isSelectedFiducialLandmark =
    selectedPart?.ta98Code === 'HRA-LMK' ||
    Boolean(selectedPart?.organGroupId?.startsWith('landmark::'));

  const matchedOrganLandmarks = useMemo(() => {
    if (!selectedPart) return [];
    const landmarkParentKey =
      selectedPart.organGroupId?.startsWith('landmark::')
        ? selectedPart.organGroupId.split('::')[1]
        : undefined;
    const rawOrganLabel = isSelectedFiducialLandmark
      ? selectedPart.latinName.split('•').pop()?.trim() || selectedPart.cleanName
      : customGlbUrl && explorerOpenedModel?.kind === 'native'
        ? customGlbName ?? explorerOpenedModel.title
        : selectedPart.cleanName;

    return matchLandmarksForOrgan(
      {
        organKey:
          landmarkParentKey ??
          (customGlbUrl && explorerOpenedModel?.kind === 'native'
            ? explorerOpenedModel.key
            : undefined),
        organLabel: rawOrganLabel,
        ontologyId: hraEnrichment?.uberonId,
        glbUrl: customGlbUrl ?? explorerOpenedModel?.glbUrl,
        sex: biologicalSex,
      },
      landmarksCatalog
    );
  }, [
    selectedPart,
    isSelectedFiducialLandmark,
    customGlbUrl,
    customGlbName,
    explorerOpenedModel,
    hraEnrichment?.uberonId,
    biologicalSex,
    landmarksCatalog,
  ]);

  if (
    !selectedPart ||
    !medicalProfile ||
    activeTab === 'pdf-books' ||
    activeTab === 'feedback'
  ) {
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
      `${medicalProfile.cleanNameEn} anatomy`
    )}`;

  const arWikiReferenceUrl =
    medicalProfile.wikipediaUrlAr ||
    `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
      `${medicalProfile.cleanNameAr || medicalProfile.cleanNameEn} تشريح`
    )}`;

  const wikidataReferenceUrl =
    medicalProfile.wikidataUrl ??
    `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(
      medicalProfile.ta98Code &&
        !/0000|HRA|LMK/i.test(medicalProfile.ta98Code)
        ? `haswbstatement:P1323=${medicalProfile.ta98Code}`
        : `${medicalProfile.latinName || medicalProfile.cleanNameEn} anatomy`
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

        {selectedPart?.landmarkMeta && (() => {
          const lmkMeta = selectedPart.landmarkMeta;
          const parentPart =
            (lmkMeta.parentMeshUuid
              ? anatomicalCatalog.find(
                  (p) => p.meshUuid === lmkMeta.parentMeshUuid
                )
              : undefined) ??
            anatomicalCatalog.find((p) => {
              const tokens = lmkMeta.parentOrganLabel
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .split(/\s+/)
                .filter((w) => w.length >= 4);
              const hay = `${p.cleanName} ${p.organGroupId ?? ''}`.toLowerCase();
              return tokens.some((tok) => hay.includes(tok));
            });

          return (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300/90">
                  {isArabic ? 'العضو المرتبط (Parent Organ)' : 'Parent Structure Anchor'}
                </div>
                <div className="truncate text-[11px] font-medium text-amber-100">
                  {isArabic ? lmkMeta.parentOrganAr : lmkMeta.parentOrganLabel}
                </div>
              </div>
              {parentPart && (
                <button
                  type="button"
                  onClick={() => {
                    selectPart(parentPart);
                    focusSelectedPart();
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300/40 bg-amber-400/20 px-2 py-1 font-mono text-[9.5px] font-semibold text-amber-100 transition hover:bg-amber-400/35 active:scale-95"
                >
                  <Focus className="h-3 w-3" />
                  <span>{isArabic ? 'عرض العضو' : 'Inspect Parent'}</span>
                </button>
              )}
            </div>
          );
        })()}

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

        {/* Quick Landmarks Activation Prompt when hidden */}
        {!showSurgicalLandmarks && !selectedPart.landmarkMeta && (
          <button
            type="button"
            onClick={() => {
              setLandmarkFilterMode('selected');
              setShowSurgicalLandmarks(true);
            }}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2 text-left transition-colors hover:border-amber-400/50 hover:bg-amber-500/15"
          >
            <span className="font-mono text-[10.5px] font-semibold text-amber-200">
              🎯{' '}
              {isArabic
                ? 'إظهار المعالم التشريحية لهذا العضو'
                : 'Show Landmarks on This Structure'}
            </span>
            <kbd className="rounded border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">
              L
            </kbd>
          </button>
        )}

        {/* Interactive Anatomical Landmarks on This Structure */}
        {showSurgicalLandmarks && activePartLandmarks.length > 0 && (
          <section
            aria-label="Anatomical Landmarks on This Structure"
            className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              <span>
                🎯{' '}
                {isArabic
                  ? 'المعالم التشريحية للعضو'
                  : 'Anatomical Landmarks on This Structure'}
              </span>
              <span className="rounded border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-200">
                {activePartLandmarks.length}
              </span>
            </div>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {activePartLandmarks.map((lm) => {
                const isFocused = focusedLandmarkId === lm.id;
                const dotColor =
                  lm.variant === 'rose'
                    ? 'bg-rose-400'
                    : lm.variant === 'blue'
                    ? 'bg-blue-400'
                    : lm.variant === 'cyan'
                    ? 'bg-sky-400'
                    : lm.variant === 'emerald'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400';
                return (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => {
                      if (isFocused) {
                        setFocusedLandmarkId(null);
                      } else {
                        focusLandmarkPoint(lm.id, lm.worldPosition, 0.055);
                      }
                    }}
                    className={cn(
                      'w-full rounded-lg border px-2.5 py-2 text-left transition-colors',
                      isFocused
                        ? 'border-amber-400/70 bg-amber-500/20'
                        : 'border-white/10 bg-slate-900/70 hover:border-amber-400/40 hover:bg-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', dotColor)}
                      />
                      <span className="text-[11.5px] font-semibold leading-snug text-zinc-100">
                        {isArabic ? lm.nameAr : lm.nameEn}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-1 text-[10.5px] leading-relaxed text-zinc-400',
                        isArabic && 'text-right'
                      )}
                      dir={isArabic ? 'rtl' : 'ltr'}
                    >
                      {isArabic ? lm.significanceAr : lm.significanceEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* HRA Panel A: Microscopic Histology — Functional Tissue Units (FTU) */}
        {(isLoadingHra ||
          (hraEnrichment &&
            (hraEnrichment.ftus.length > 0 ||
              hraEnrichment.dimensionsBySex.male ||
              hraEnrichment.dimensionsBySex.female ||
              hraEnrichment.asctb))) && (
          <>
            {hraEnrichment && hraEnrichment.ftus.length > 0 && (
              <section aria-label="Microscopic Histology Functional Tissue Units">
                <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Microscope className="h-3.5 w-3.5 text-cyan-400" />
                    <span>
                      {isArabic
                        ? 'الأنسجة المجهرية (FTU)'
                        : 'Microscopic Histology (HRA FTU)'}
                    </span>
                  </span>
                  <span className="rounded border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
                    {hraEnrichment.ftus.length} Unit
                    {hraEnrichment.ftus.length > 1 ? 's' : ''}
                  </span>
                </div>

                {(() => {
                  const ftu =
                    hraEnrichment.ftus[activeFtuIndex] ??
                    hraEnrichment.ftus[0];
                  if (!ftu) return null;
                  const previewUrl = ftu.svgUrl || ftu.pngUrl;
                  return (
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.05] p-3">
                      {hraEnrichment.ftus.length > 1 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {hraEnrichment.ftus.map((item, idx) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveFtuIndex(idx)}
                              className={cn(
                                'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors',
                                idx === activeFtuIndex
                                  ? 'border-cyan-400/60 bg-cyan-500/25 text-white'
                                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
                              )}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="group relative overflow-hidden rounded-lg border border-white/15 bg-white/95 p-2">
                        <img
                          src={previewUrl}
                          alt={`${ftu.label} Functional Tissue Unit`}
                          loading="lazy"
                          className="mx-auto max-h-44 w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setFtuModalOpen(true)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                          <Maximize2 className="h-3 w-3 text-cyan-300" />
                          <span>Expand Full Histology View</span>
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10.5px]">
                        <span className="font-semibold capitalize text-white">
                          {ftu.label}
                        </span>
                        {ftu.uberonId && (
                          <span className="font-mono text-[9.5px] text-cyan-300">
                            {ftu.uberonId}
                          </span>
                        )}
                      </div>

                      {ftu.cellTypes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ftu.cellTypes.slice(0, 8).map((ct) => (
                            <span
                              key={ct.id + ct.label}
                              className="rounded border border-white/10 bg-black/35 px-1.5 py-0.5 text-[9.5px] text-zinc-200"
                              title={ct.id}
                            >
                              {ct.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* HRA Panel B: Physical Dimensions (mm), UBERON & ASCT+B Cellular/Biomarker Profile */}
            <section aria-label="HRA Morphometry and ASCT+B Biomarkers">
              <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Dna className="h-3.5 w-3.5 text-violet-400" />
                  <span>
                    {isArabic
                      ? 'الأبعاد المرجعية والخلايا (ASCT+B)'
                      : 'Morphometry & ASCT+B Profile'}
                  </span>
                </span>
                {hraEnrichment?.uberonId && (
                  <a
                    href={`http://purl.obolibrary.org/obo/${hraEnrichment.uberonId.replace(':', '_')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-violet-400/35 bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-200 hover:text-white"
                  >
                    <span>{hraEnrichment.uberonId}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>

              <div className="space-y-2.5 rounded-xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
                {isLoadingHra && !hraEnrichment ? (
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                    <span>Querying NIH HRA ASCT+B &amp; Morphometry...</span>
                  </div>
                ) : null}

                {(hraEnrichment?.dimensionsBySex.male ||
                  hraEnrichment?.dimensionsBySex.female) && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['male', 'female'] as const).map((sexKey) => {
                      const rec = hraEnrichment.dimensionsBySex[sexKey];
                      if (!rec) return null;
                      const isCurrentSex = biologicalSex === sexKey;
                      return (
                        <div
                          key={sexKey}
                          className={cn(
                            'rounded-lg border p-2',
                            isCurrentSex
                              ? 'border-sky-400/45 bg-sky-500/15'
                              : 'border-white/10 bg-black/30 opacity-80'
                          )}
                        >
                          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Ruler className="h-2.5 w-2.5 text-sky-300" />
                              <span>
                                {sexKey === 'male' ? '♂ Male Ref' : '♀ Female Ref'}
                              </span>
                            </span>
                            {rec.side !== 'Unpaired' && (
                              <span>{rec.side}</span>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[10.5px] font-semibold text-white">
                            {rec.dimensionsMm
                              .map((n) => n.toFixed(1))
                              .join(' × ')}{' '}
                            <span className="text-[9px] text-zinc-400">mm</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hraEnrichment?.asctb && (
                  <>
                    {hraEnrichment.asctb.cellTypes.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                          <span>Resident Cell Types (CL)</span>
                          <span className="text-zinc-500">
                            {hraEnrichment.asctb.cellTypes.length} types
                          </span>
                        </div>
                        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1">
                          {hraEnrichment.asctb.cellTypes
                            .slice(0, 18)
                            .map((ct) => (
                              <span
                                key={ct.id + ct.label}
                                title={ct.id}
                                className="rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] text-emerald-100"
                              >
                                {ct.label}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {hraEnrichment.asctb.biomarkers.length > 0 && (
                      <div>
                        <div className="mb-1 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-zinc-400">
                          <span>Key Gene / Protein Biomarkers</span>
                          <span className="text-zinc-500">
                            {hraEnrichment.asctb.biomarkers.length} markers
                          </span>
                        </div>
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                          {hraEnrichment.asctb.biomarkers
                            .slice(0, 20)
                            .map((bm) => (
                              <span
                                key={bm.id + bm.label}
                                title={`${bm.id} (${bm.biomarkerType})`}
                                className="rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9.5px] text-amber-200"
                              >
                                {bm.label}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {/* HRA Surgical & Anatomical 3D Fiducial Landmarks */}
        {(isSelectedFiducialLandmark || matchedOrganLandmarks.length > 0) && (
          <section
            aria-label="Surgical and Anatomical Landmarks"
            data-testid="inspector-landmarks-section"
            className="rounded-xl border border-amber-400/25 bg-gradient-to-b from-amber-500/[0.09] to-cyan-500/[0.04] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-xs leading-none">
                  🎯
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  {language === 'ar'
                    ? 'المعالم الجراحية والتشريحية (HRA)'
                    : 'Surgical & Anatomical Landmarks'}
                </span>
              </div>
              {matchedOrganLandmarks.length > 0 && (
                <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
                  {matchedOrganLandmarks.reduce(
                    (acc, item) => acc + item.subMeshes.length,
                    0
                  )}{' '}
                  Fiducials
                </span>
              )}
            </div>

            {isSelectedFiducialLandmark && (
              <div className="mb-2 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] text-cyan-100">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-cyan-300">
                  Selected Fiducial:{' '}
                </span>
                <span className="font-semibold text-white">
                  {selectedPart.cleanName}
                </span>
                <span className="text-zinc-300">
                  {' '}
                  •{' '}
                  {selectedPart.latinName.split('•').pop()?.trim() ??
                    selectedPart.rawName}
                </span>
              </div>
            )}

            {matchedOrganLandmarks.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1">
                {matchedOrganLandmarks
                  .flatMap((lm) =>
                    lm.subMeshes.map((sm) => ({
                      key: `${lm.id}::${sm.subNode || sm.label}`,
                      label: sm.label.replace(/\b\w/g, (c) => c.toUpperCase()),
                      subNode: sm.subNode,
                    }))
                  )
                  .slice(0, 18)
                  .map((fiducial) => {
                    const isActiveFiducial =
                      isSelectedFiducialLandmark &&
                      selectedPart.cleanName.toLowerCase() ===
                        fiducial.label.toLowerCase();
                    return (
                      <span
                        key={fiducial.key}
                        title={fiducial.subNode || fiducial.label}
                        className={cn(
                          'rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize',
                          isActiveFiducial
                            ? 'border-amber-400/70 bg-amber-500/25 text-white shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                            : 'border-white/10 bg-black/35 text-zinc-200'
                        )}
                      >
                        {fiducial.label}
                      </span>
                    );
                  })}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSurgicalLandmarks(!showSurgicalLandmarks)}
              data-testid="inspector-show-landmarks-btn"
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] font-semibold transition-all',
                showSurgicalLandmarks
                  ? 'border-cyan-400/55 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
                  : 'border-amber-400/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
              )}
            >
              <span aria-hidden="true">🎯</span>
              <span>
                {showSurgicalLandmarks
                  ? 'Hide 3D Landmarks on Organ [L]'
                  : 'Show 3D Landmarks on Organ'}
              </span>
            </button>
          </section>
        )}
      </div>

      {/* Expandable FTU Histology Lightbox Modal (portaled to document.body to escape backdrop-blur stacking) */}
      {ftuModalOpen &&
        typeof document !== 'undefined' &&
        hraEnrichment &&
        hraEnrichment.ftus.length > 0 &&
        (() => {
          const modalFtu =
            hraEnrichment.ftus[activeFtuIndex] ?? hraEnrichment.ftus[0];
          if (!modalFtu) return null;
          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Interactive Histology: ${modalFtu.label}`}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
              onClick={() => setFtuModalOpen(false)}
            >
              <div
                className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b10] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-300">
                      <Microscope className="h-3.5 w-3.5" />
                      <span>NIH HRA 2D Functional Tissue Unit</span>
                      {modalFtu.uberonId && <span>• {modalFtu.uberonId}</span>}
                    </div>
                    <h3 className="mt-0.5 text-base font-bold capitalize text-white">
                      {modalFtu.label} ({modalFtu.organLabel})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFtuModalOpen(false)}
                    aria-label="Close Histology View"
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-zinc-300 hover:bg-white/15 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-5">
                  <div className="flex items-center justify-center rounded-xl border border-white/15 bg-white p-4 md:col-span-3">
                    <img
                      src={modalFtu.svgUrl || modalFtu.pngUrl}
                      alt={modalFtu.label}
                      className="max-h-[62dvh] w-full object-contain"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      Mapped Cell Ontology Population (
                      {modalFtu.cellTypes.length})
                    </div>
                    <div className="max-h-[58dvh] space-y-1.5 overflow-y-auto pr-1">
                      {modalFtu.cellTypes.map((ct) => (
                        <div
                          key={ct.id + ct.label}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-100"
                        >
                          <span className="capitalize">{ct.label}</span>
                          <span className="shrink-0 font-mono text-[10px] text-cyan-300">
                            {ct.id.replace('_', ':')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

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
