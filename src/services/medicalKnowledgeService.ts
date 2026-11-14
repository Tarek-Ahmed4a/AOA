import {
  resolveClinicalBaseline,
  translateAnatomicalTermToArabic,
} from '../data/clinicalBaseline';
import type { AnatomicalClinicalProfile } from '../types/medicalData';
import type { AnatomicalPartInfo } from '../utils/anatomyParser';

const CACHE_KEY_PREFIX = 'anatomy_atlas_med_v4_';
const LEGACY_CACHE_PREFIXES = [
  'anatomy_atlas_med_v1_',
  'anatomy_atlas_med_v2_',
  'anatomy_atlas_med_v3_',
];
const API_TIMEOUT_MS = 4500;

function purgeLegacyMedicalCaches(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (LEGACY_CACHE_PREFIXES.some((prefix) => k.startsWith(prefix))) {
        keysToDelete.push(k);
        continue;
      }
      if (k.startsWith(CACHE_KEY_PREFIX)) {
        const val = window.localStorage.getItem(k) || '';
        if (/\bPart\s*\d+\b|الجزء/.test(val)) {
          keysToDelete.push(k);
        }
      }
    }
    for (const k of keysToDelete) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage quota/security errors
  }
}

purgeLegacyMedicalCaches();

interface WikiRestSummary {
  title?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

interface WikidataEntity {
  id?: string;
  missing?: string;
  labels?: Record<string, { value?: string }>;
  sitelinks?: Record<string, { title?: string }>;
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: {
          value?: string | { id?: string };
        };
      };
    }>
  >;
}

interface WikidataResponse {
  entities?: Record<string, WikidataEntity>;
}

interface WikiLanglinksResponse {
  query?: {
    pages?: Record<
      string,
      {
        langlinks?: Array<{
          lang?: string;
          '*'?: string;
        }>;
      }
    >;
  };
}

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title?: string;
    }>;
  };
}

function getCacheKey(cleanName: string): string {
  return `${CACHE_KEY_PREFIX}${cleanName.toLowerCase()}`;
}

function readCachedProfile(cleanName: string): AnatomicalClinicalProfile | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getCacheKey(cleanName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnatomicalClinicalProfile;
    if (!parsed || !parsed.cleanNameEn || !parsed.ta98Code) return null;
    return {
      ...parsed,
      source: 'cached',
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(
  cleanName: string,
  profile: AnatomicalClinicalProfile
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(getCacheKey(cleanName), JSON.stringify(profile));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

async function fetchJsonSafe<T>(
  url: string,
  signal: AbortSignal
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractClaimString(
  entity: WikidataEntity | undefined,
  propertyId: string
): string | undefined {
  const val = entity?.claims?.[propertyId]?.[0]?.mainsnak?.datavalue?.value;
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}

function isUsableSummary(text: string | undefined): text is string {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 40) return false;
  if (/may refer to:/i.test(trimmed)) return false;
  return true;
}

/**
 * Fetches bilingual anatomical documentation by combining an authoritative offline
 * clinical baseline with parallel live Wikipedia REST v1 + Wikidata API lookups and localStorage caching.
 */
export async function fetchMedicalProfile(
  part: AnatomicalPartInfo,
  externalSignal?: AbortSignal
): Promise<AnatomicalClinicalProfile> {
  const cached = readCachedProfile(part.cleanName);
  if (cached) {
    return {
      ...cached,
      id: part.rawName || part.meshUuid,
      laterality: part.laterality,
    };
  }

  const {
    profile: baseline,
    wikiSearchTerm,
    searchCandidates,
    fallbackArTitle,
  } = resolveClinicalBaseline(part);

  if (externalSignal?.aborted) {
    return baseline;
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  const handleExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', handleExternalAbort, { once: true });

  const queryTermSources = async (term: string) => {
    const enWikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      term.replace(/\s+/g, '_')
    )}`;
    const wikidataApiUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(
      term
    )}&props=claims|labels|sitelinks&languages=en|ar|la&format=json&origin=*`;
    const langlinksApiUrl = `https://en.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(
      term
    )}&prop=langlinks&lllang=ar&format=json&origin=*`;

    const [enSummary, wikidataRes, langlinksRes] = await Promise.all([
      fetchJsonSafe<WikiRestSummary>(enWikiUrl, controller.signal),
      fetchJsonSafe<WikidataResponse>(wikidataApiUrl, controller.signal),
      fetchJsonSafe<WikiLanglinksResponse>(langlinksApiUrl, controller.signal),
    ]);

    const entity = wikidataRes?.entities
      ? Object.values(wikidataRes.entities).find((e) => !e.missing)
      : undefined;

    const langlinkArTitle = langlinksRes?.query?.pages
      ? Object.values(langlinksRes.query.pages)[0]?.langlinks?.[0]?.['*']
      : undefined;

    return { enSummary, entity, langlinkArTitle };
  };

  try {
    const candidates =
      searchCandidates?.length > 0 ? searchCandidates : [wikiSearchTerm];

    let { enSummary, entity, langlinkArTitle } = await queryTermSources(
      candidates[0]
    );

    if (controller.signal.aborted) {
      return baseline;
    }

    if (!enSummary && !entity && candidates.length > 1) {
      const fallbackResult = await queryTermSources(candidates[1]);
      if (controller.signal.aborted) {
        return baseline;
      }
      enSummary = fallbackResult.enSummary ?? enSummary;
      entity = fallbackResult.entity ?? entity;
      langlinkArTitle = fallbackResult.langlinkArTitle ?? langlinkArTitle;
    }

    const wdArabic = entity?.labels?.ar?.value;
    let arArticleTitle =
      entity?.sitelinks?.arwiki?.title ?? langlinkArTitle ?? fallbackArTitle;

    if (!arArticleTitle) {
      const arSearchQuery =
        wdArabic ||
        baseline.cleanNameAr.replace(/\s*\([^)]*\)/g, '').trim() ||
        wikiSearchTerm;
      const arSearchUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        arSearchQuery
      )}&utf8=1&srlimit=1&format=json&origin=*`;
      const arSearchRes = await fetchJsonSafe<WikiSearchResponse>(
        arSearchUrl,
        controller.signal
      );
      if (controller.signal.aborted) {
        return baseline;
      }
      arArticleTitle = arSearchRes?.query?.search?.[0]?.title;
    }

    const arSummary = arArticleTitle
      ? await fetchJsonSafe<WikiRestSummary>(
          `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            arArticleTitle.replace(/\s+/g, '_')
          )}`,
          controller.signal
        )
      : null;

    if (controller.signal.aborted) {
      return baseline;
    }

    const hasLiveEnrichment = Boolean(enSummary || arSummary || entity);
    if (!hasLiveEnrichment) {
      return baseline;
    }

    const wdTa98 = extractClaimString(entity, 'P1323');
    const wdFmaRaw = extractClaimString(entity, 'P1402');
    const wdFma = wdFmaRaw
      ? wdFmaRaw.toUpperCase().startsWith('FMA:')
        ? wdFmaRaw.toUpperCase()
        : `FMA:${wdFmaRaw}`
      : undefined;
    const wdLatin = entity?.labels?.la?.value;
    const wdEntityUrl = entity?.id
      ? `https://www.wikidata.org/wiki/${entity.id}`
      : undefined;

    const baselineArWithoutVertebraCode = baseline.cleanNameAr.replace(
      /\((?:C\d+[-–]?[A-Z]?\d*|CN\s*[IVX]+|L\d+[-–]?S?\d*|T\d+[-–]?T?\d*)\)/gi,
      ''
    );
    const hasGenericBaselineAr =
      baseline.cleanNameAr.includes('—') ||
      /[A-Za-z]/.test(baselineArWithoutVertebraCode);

    let resolvedCleanNameAr = baseline.cleanNameAr.replace(/\s*—\s*/g, ' — ');
    if (hasGenericBaselineAr && wdArabic) {
      if (part.laterality === 'Left') resolvedCleanNameAr = `${wdArabic} (أيسر)`;
      else if (part.laterality === 'Right')
        resolvedCleanNameAr = `${wdArabic} (أيمن)`;
      else resolvedCleanNameAr = wdArabic;
    } else if (baseline.cleanNameAr.includes('—')) {
      resolvedCleanNameAr = translateAnatomicalTermToArabic(
        part.cleanName,
        part.laterality,
        part.system,
        wdArabic
      );
    }

    const fallbackArQuery = wdArabic || wikiSearchTerm;

    const hasAuthoritativeTextbookSummary =
      baseline.source === 'textbook-primary' &&
      Boolean(baseline.summaryEn) &&
      !/^.*—\s*Plate\s+/i.test(baseline.summaryEn);

    const wikiSummaryEn = isUsableSummary(enSummary?.extract)
      ? enSummary!.extract
      : undefined;
    const wikiSummaryAr = isUsableSummary(arSummary?.extract)
      ? arSummary!.extract
      : undefined;

    const merged: AnatomicalClinicalProfile = {
      ...baseline,
      cleanNameAr: resolvedCleanNameAr,
      latinName: baseline.latinName || wdLatin || part.latinName,
      ta98Code:
        baseline.ta98Code.includes('.0.00.') && wdTa98
          ? wdTa98
          : baseline.ta98Code,
      fmaId: baseline.fmaId ?? wdFma,
      // Primary Source Hierarchy: Authoritative Textbooks (Gray's 4e & Netter 7e) NEVER get overwritten by Wikipedia
      summaryEn: hasAuthoritativeTextbookSummary
        ? baseline.summaryEn
        : wikiSummaryEn ?? baseline.summaryEn,
      // Arabic summary stays authentic Arabic (baseline Arabic OR Arabic Wikipedia if baseline was generic)
      summaryAr:
        baseline.summaryAr &&
        !/يتم استجلاب الملخصات الموسوعية|يمكنك مراجعة المصادر المرجعية/.test(
          baseline.summaryAr
        )
          ? baseline.summaryAr
          : wikiSummaryAr ?? baseline.summaryAr,
      secondaryWikiSummaryEn: wikiSummaryEn,
      secondaryWikiSummaryAr: wikiSummaryAr,
      wikipediaUrlEn:
        enSummary?.content_urls?.desktop?.page ??
        baseline.wikipediaUrlEn ??
        `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(
          wikiSearchTerm
        )}`,
      wikipediaUrlAr:
        arSummary?.content_urls?.desktop?.page ??
        (arArticleTitle
          ? `https://ar.wikipedia.org/wiki/${encodeURIComponent(
              arArticleTitle.replace(/\s+/g, '_')
            )}`
          : baseline.wikipediaUrlAr ??
            `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
              fallbackArQuery
            )}`),
      wikidataUrl: wdEntityUrl,
      thumbnailUrl:
        enSummary?.thumbnail?.source ??
        arSummary?.thumbnail?.source ??
        baseline.thumbnailUrl,
      source: baseline.source === 'textbook-primary' ? 'textbook-primary' : 'live-api',
    };

    writeCachedProfile(part.cleanName, merged);
    return merged;
  } catch {
    return baseline;
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', handleExternalAbort);
  }
}
