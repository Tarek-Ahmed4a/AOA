import textbookDataRaw from '../data/textbookKnowledge.json';
import type { AnatomicalSystem } from '../store/useAnatomyStore';

export interface TextbookEntryRecord {
  canonicalNameEn: string;
  system: AnatomicalSystem;
  region: string;
  muscleGroup?: string;
  summaryEn: string;
  primaryFunctionEn?: string;
  origin?: string;
  insertion?: string;
  action?: string;
  relationsEn?: string;
  arterialSupply?: string;
  venousDrainage?: string;
  innervation?: string;
  clinicalNotesEn?: string;
  netterPlates?: string[];
  netterRef?: string;
  grayRef?: string;
  sources: Array<'netter' | 'grays'>;
}

interface TextbookDataset {
  version: string;
  books: {
    book1: string;
    book2: string;
  };
  aliases: Record<string, string>;
  entries: Record<string, TextbookEntryRecord>;
}

const dataset = textbookDataRaw as unknown as TextbookDataset;

function normalizeLookupKey(raw: string): string {
  let s = String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(?:left|right|bilateral|anterior|posterior|superior|inferior|medial|lateral)\s+/gi, (m) => {
      // Only strip Left/Right/Bilateral blindly; preserve anatomical terms containing anterior/posterior etc. when part of noun
      return /^(?:left|right|bilateral)\b/i.test(m) ? '' : m;
    })
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/\bmuscle$/i.test(s) && s.split(' ').length <= 4) {
    s = s.replace(/\s+muscle$/i, '').trim();
  }
  return s;
}

function resolveKeyExact(candidate: string): TextbookEntryRecord | null {
  if (!candidate) return null;
  const canonical = dataset.aliases?.[candidate] || candidate;
  return dataset.entries?.[canonical] || null;
}

/**
 * Resolves any anatomical structure name against offline Book 1 (Netter 7e)
 * & Book 2 (Gray's Anatomy for Students 4e) indexed knowledge.
 */
export function resolveTextbookEntry(
  rawOrCleanName: string,
  latinName?: string,
  systemHint?: AnatomicalSystem
): {
  entry: TextbookEntryRecord;
  citationLabel: string;
  bookSourceLabel: string;
  hasSubstantiveTextbookContent: boolean;
} | null {
  const candidates: string[] = [];

  const pushVariants = (input?: string) => {
    if (!input) return;
    const lower = input.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const norm = normalizeLookupKey(input);
    const noLeftRight = lower.replace(/^(?:left|right)\s+|\s+(?:left|right)$/g, '').trim();
    const withoutOf = norm.replace(/\s+of\s+.*$/i, '').trim();

    for (const c of [
      norm,
      noLeftRight,
      lower,
      norm.replace(/\s+muscle$/i, '').trim(),
      `${norm} muscle`,
      norm.endsWith('s') && norm.length > 4 ? norm.slice(0, -1) : '',
      withoutOf,
    ]) {
      if (c && c.length >= 3 && !candidates.includes(c)) {
        candidates.push(c);
      }
    }
  };

  pushVariants(rawOrCleanName);
  pushVariants(latinName);

  // Also try parent phrase before " & " or " (" if composite spatial label
  if (rawOrCleanName.includes('&')) {
    const firstPart = rawOrCleanName.split('&')[0].trim();
    pushVariants(firstPart);
  }
  if (rawOrCleanName.includes(',')) {
    const firstPart = rawOrCleanName.split(',')[0].trim();
    pushVariants(firstPart);
  }

  let matched: TextbookEntryRecord | null = null;
  for (const cand of candidates) {
    const hit = resolveKeyExact(cand);
    if (hit) {
      matched = hit;
      break;
    }
  }

  // Fallback token-level search across remaining words (e.g. "Proximal phalanx of third finger of foot" -> "phalanx" / "phalanges")
  if (!matched && candidates.length > 0) {
    const words = candidates[0]
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !/^(right|left|upper|lower|region|system|muscle|structure|human)$/.test(w));
    for (const w of words) {
      const hit = resolveKeyExact(w) || (w.endsWith('s') ? resolveKeyExact(w.slice(0, -1)) : null);
      if (hit && (!systemHint || hit.system === systemHint)) {
        matched = hit;
        break;
      }
    }
  }

  if (!matched) return null;

  const isPlateOnlyStub =
    matched.sources.length === 1 &&
    matched.sources[0] === 'netter' &&
    !matched.origin &&
    !matched.insertion &&
    !matched.arterialSupply &&
    !matched.innervation &&
    !matched.clinicalNotesEn &&
    /^.*?—\s*Plate\s+/i.test(matched.summaryEn || '');

  const refs: string[] = [];
  if (matched.grayRef) refs.push(matched.grayRef);
  if (matched.netterRef) refs.push(matched.netterRef);
  const citationLabel = refs.join(' • ') || "Gray's 4e & Netter 7e";

  const bookSourceLabel =
    matched.sources.includes('grays') && matched.sources.includes('netter')
      ? "Gray's 4e + Netter 7e"
      : matched.sources.includes('grays')
        ? "Gray's 4e Textbook"
        : 'Netter 7e Atlas';

  return {
    entry: matched,
    citationLabel,
    bookSourceLabel,
    hasSubstantiveTextbookContent: !isPlateOnlyStub && (matched.summaryEn?.length ?? 0) > 40,
  };
}

export function getTextbookDatasetSummary(): {
  book1: string;
  book2: string;
  totalEntries: number;
} {
  return {
    book1: dataset.books.book1,
    book2: dataset.books.book2,
    totalEntries: Object.keys(dataset.entries || {}).length,
  };
}

export function getAllTextbookEntries(): TextbookEntryRecord[] {
  return Object.values(dataset.entries || {});
}
