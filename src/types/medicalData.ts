import type { AnatomicalSystem, BiologicalSex } from '../store/useAnatomyStore';

export type MedicalDataSource =
  | 'textbook-primary'
  | 'live-api'
  | 'cached'
  | 'clinical-baseline';
export type AnatomicalSexRelevance = BiologicalSex | 'both';

export interface AnatomicalClinicalProfile {
  id: string;
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  ta98Code: string;
  fmaId?: string;
  system: AnatomicalSystem;
  laterality: string;
  sexRelevance?: AnatomicalSexRelevance;
  region?: string;
  muscleGroup?: string;
  summaryEn: string;
  summaryAr: string;
  primaryFunctionEn: string;
  primaryFunctionAr: string;
  origin?: string;
  insertion?: string;
  action?: string;
  relationsEn?: string;
  relationsAr?: string;
  arterialSupply: string;
  venousDrainage: string;
  innervation: string;
  clinicalNotesEn: string;
  clinicalNotesAr: string;
  bookSourceLabel?: string;
  textbookRefCitation?: string;
  netterPlates?: string[];
  secondaryWikiSummaryEn?: string;
  secondaryWikiSummaryAr?: string;
  wikipediaUrlEn?: string;
  wikipediaUrlAr?: string;
  wikidataUrl?: string;
  thumbnailUrl?: string;
  source: MedicalDataSource;
}
