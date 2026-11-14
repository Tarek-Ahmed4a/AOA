import type { AnatomicalSystem, BiologicalSex } from '../store/useAnatomyStore';

export type AnatomicalLaterality = 'Left' | 'Right' | 'Median / Unpaired';

export interface SpatialCoordsInput {
  nx: number;
  ny: number;
  nz: number;
  /** 'normalized' = [-1.0..+1.0] (default), 'standing' = [0..1.8], 'centered' = [-0.9..0.9], 'auto' infers */
  frame?: 'normalized' | 'standing' | 'centered' | 'auto';
}

export interface ResolvedSpatialStructure {
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  ta98Code: string;
  region: string;
  system: AnatomicalSystem;
  laterality: AnatomicalLaterality;
  confidence: 'material-exact' | 'spatial-landmark' | 'book1-regional-fallback';
}

const GENERIC_PREFIX_TOKENS_REGEX =
  /\b(?:object|mesh|primitive|node|part|submesh|group|default|material|defaultmaterial|muscular|skeletal|visceral|nervous|cardiovascular|untitled|model|scene|rootnode|root|geom|geometry|surface|poly|polysurface|shape|segment|piece|cube|plane|sphere|cylinder|mat|lambert|phong|blinn|standard|unnamed|anatomical|structure)\b/gi;

const GENERIC_NODE_REGEX =
  /^(?:object|mesh|node|group|primitive|part|submesh|cube|plane|sphere|poly|shape|geom|surface|untitled|model|default|material|muscular|skeletal|visceral|nervous|cardiovascular)(?:[\s_.\-#]*\d+)*$/i;

const GENERIC_PHRASE_REGEX =
  /(?:^|\b)(?:part|segment|piece|mesh|object|primitive|node|group|submesh)\s*#?\d+\b|(?:—|-)\s*part\b|الجزء/i;

export function isGenericOrPartFallbackName(raw?: string | null): boolean {
  if (!raw) return true;
  const trimmed = raw
    .replace(/\.(glb|gltf|obj|fbx)(?:\.\d+)?$/i, '')
    .trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (GENERIC_NODE_REGEX.test(trimmed) || GENERIC_PHRASE_REGEX.test(trimmed)) {
    return true;
  }

  // If the string contains genuine Arabic anatomical characters (beyond generic "الجزء"), preserve it.
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    const arRemainder = trimmed
      .replace(/الجزء|جزء|قسم|قطعة/g, '')
      .replace(/[^\u0600-\u06FF]/g, '');
    if (arRemainder.length >= 2) return false;
  }

  // Strip generic prefixes, digits, and punctuation; treat as generic if < 3 alphabetical letters remain.
  const tokenized = trimmed
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z]+/g, ' ');
  const alphaOnly = tokenized
    .replace(GENERIC_PREFIX_TOKENS_REGEX, ' ')
    .replace(/[^a-zA-Z]/g, '');
  return alphaOnly.length < 3;
}

/**
 * Normalize raw mesh center coordinates into normalized body height space `[-1.0 .. +1.0]`
 * (`nx` mediolateral, `ny` from `-1.0` feet to `+1.0` cranium, `nz` anteroposterior).
 */
function toNormalizedCoords(coords: SpatialCoordsInput): {
  x: number;
  y: number;
  z: number;
} {
  const { nx, ny, nz, frame = 'normalized' } = coords;
  let normY: number;
  if (frame === 'standing') {
    normY = (ny - 0.9) / 0.9;
  } else if (frame === 'centered') {
    normY = ny / 0.9;
  } else if (frame === 'auto') {
    normY = ny < 0 ? ny / 0.9 : (ny - 0.9) / 0.9;
  } else {
    normY = ny > 1.05 || ny < -1.05 ? (ny - 0.9) / 0.9 : ny;
  }
  return {
    x: nx,
    y: Math.max(-1.0, Math.min(1.0, normY)),
    z: nz,
  };
}

function inferSideFromX(x: number, threshold = 0.032): AnatomicalLaterality {
  if (x > threshold) return 'Left';
  if (x < -threshold) return 'Right';
  return 'Median / Unpaired';
}

const ARABIC_SIDE_MASCULINE: Record<AnatomicalLaterality, string> = {
  Left: 'الأيسر',
  Right: 'الأيمن',
  'Median / Unpaired': '',
};

const ARABIC_SIDE_FEMININE: Record<AnatomicalLaterality, string> = {
  Left: 'اليسرى',
  Right: 'اليمنى',
  'Median / Unpaired': '',
};

function formatBilateralName(
  enBase: string,
  arBase: string,
  side: AnatomicalLaterality
): { en: string; ar: string } {
  if (side === 'Median / Unpaired') {
    return { en: enBase, ar: arBase };
  }
  const isFeminineAr = /^(?:العضلة|عضل|الغدة|الكلية|الرئة|الشظية|الرضفة)/.test(
    arBase
  );
  const arSuffix = isFeminineAr
    ? ARABIC_SIDE_FEMININE[side]
    : ARABIC_SIDE_MASCULINE[side];
  return {
    en: `${side} ${enBase}`,
    ar: `${arBase} ${arSuffix}`,
  };
}

/**
 * Material-name disambiguation table (critical for multi-organ Sketchfab GLBs
 * like `female_pelvis_viscera.glb`, `female_muscular.glb`, `female_skeletal.glb` where
 * nodes are generically named `Object_2..Object_48`).
 */
const MATERIAL_STRUCTURE_MAP: Array<{
  regex: RegExp;
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  ta98Code: string;
  region: string;
  system: AnatomicalSystem;
  bilateral?: boolean;
}> = [
  {
    regex: /uterus/i,
    cleanNameEn: 'Uterus',
    cleanNameAr: 'الرحم',
    latinName: 'Uterus',
    ta98Code: 'A09.1.03.001',
    region: 'Pelvis and Perineum',
    system: 'visceral',
  },
  {
    regex: /fallopian|uterine[_\s]?tube/i,
    cleanNameEn: 'Uterine (Fallopian) Tube',
    cleanNameAr: 'قناة فالوب (البوق الرحمي)',
    latinName: 'Tuba uterina',
    ta98Code: 'A09.1.02.001',
    region: 'Pelvis and Perineum',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /ovarian[_\s]?ligament/i,
    cleanNameEn: 'Ligament of Ovary',
    cleanNameAr: 'الرباط المبيضي',
    latinName: 'Ligamentum ovarii proprium',
    ta98Code: 'A09.1.01.008',
    region: 'Pelvis and Perineum',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /ovary/i,
    cleanNameEn: 'Ovary',
    cleanNameAr: 'المبيض',
    latinName: 'Ovarium',
    ta98Code: 'A09.1.01.001',
    region: 'Pelvis and Perineum',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /bladder/i,
    cleanNameEn: 'Urinary Bladder',
    cleanNameAr: 'المثانة البولية',
    latinName: 'Vesica urinaria',
    ta98Code: 'A08.3.01.001',
    region: 'Pelvis and Perineum',
    system: 'visceral',
  },
  {
    regex: /adrenal|suprarenal/i,
    cleanNameEn: 'Suprarenal (Adrenal) Gland',
    cleanNameAr: 'الغدة الكظرية',
    latinName: 'Glandula suprarenalis',
    ta98Code: 'A11.5.00.001',
    region: 'Abdomen',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /kidney/i,
    cleanNameEn: 'Kidney',
    cleanNameAr: 'الكلية',
    latinName: 'Ren',
    ta98Code: 'A08.1.01.001',
    region: 'Abdomen',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /ureter/i,
    cleanNameEn: 'Ureter',
    cleanNameAr: 'الحالب',
    latinName: 'Ureter',
    ta98Code: 'A08.2.01.001',
    region: 'Abdomen',
    system: 'visceral',
    bilateral: true,
  },
  {
    regex: /female[_\s]?coccyx|coccyx/i,
    cleanNameEn: 'Coccyx',
    cleanNameAr: 'العصعص',
    latinName: 'Os coccygis',
    ta98Code: 'A02.2.06.001',
    region: 'Pelvis and Perineum',
    system: 'skeletal',
  },
  {
    regex: /female[_\s]?sacrum|sacrum/i,
    cleanNameEn: 'Sacrum',
    cleanNameAr: 'العجز (العظم العجزي)',
    latinName: 'Os sacrum',
    ta98Code: 'A02.2.05.001',
    region: 'Pelvis and Perineum',
    system: 'skeletal',
  },
  {
    regex: /female[_\s]?pelvis|pelvis/i,
    cleanNameEn: 'Female Pelvic Girdle (Hip Bone)',
    cleanNameAr: 'الحوض الأنثوي (عظم الورك)',
    latinName: 'Cingulum pelvicum feminae',
    ta98Code: 'A02.5.01.001',
    region: 'Pelvis and Perineum',
    system: 'skeletal',
  },
  {
    regex: /\b(?:cornea|sclera)\b/i,
    cleanNameEn: 'Ocular Tunics (Sclera & Cornea)',
    cleanNameAr: 'صلبة وقرنية العين',
    latinName: 'Tunica fibrosa bulbi',
    ta98Code: 'A15.2.02.001',
    region: 'Head and Neck',
    system: 'nervous',
    bilateral: true,
  },
  {
    regex: /\bteeth\b/i,
    cleanNameEn: 'Permanent Dentition',
    cleanNameAr: 'الأسنان الدائمة',
    latinName: 'Dentes permanentes',
    ta98Code: 'A05.1.03.001',
    region: 'Head and Neck',
    system: 'skeletal',
  },
  {
    regex: /mammary|breast/i,
    cleanNameEn: 'Mammary Gland',
    cleanNameAr: 'الغدة الثديية',
    latinName: 'Glandula mammaria',
    ta98Code: 'A16.0.02.007',
    region: 'Thorax',
    system: 'integumentary',
    bilateral: true,
  },
];

interface MatrixZoneSpec {
  region: string;
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  ta98Code: string;
  bilateral?: boolean;
}

function inferBodyRegionFromNormalizedY(x: number, ny: number, z: number): string {
  if (ny >= 0.62) return 'Head and Neck';
  if (Math.abs(x) >= 0.22 && ny >= -0.24 && ny <= 0.62) return 'Upper Limb';
  if (ny >= 0.12) return z < -0.04 ? 'Back and Spinal Cord' : 'Thorax';
  if (ny >= -0.06) return z < -0.04 ? 'Back and Spinal Cord' : 'Abdomen';
  if (ny >= -0.24) return 'Pelvis and Perineum';
  return 'Lower Limb';
}

/**
 * Complete 6-System Normalized Coordinate Lookup Matrix (`[-1.0, +1.0]` body height):
 * Zero fallback to "Part XXX" / "الجزء" anywhere on the body across all 6 systems.
 */
function resolveNormalizedSixSystemZone(
  nx: number,
  ny: number,
  nz: number,
  system: AnatomicalSystem,
  matLower: string,
  sex: BiologicalSex
): MatrixZoneSpec {
  const ax = Math.abs(nx);

  if (system === 'integumentary') {
    if (ny > 0.72) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cranial Scalp & Facial Integument',
        cleanNameAr: 'جلد الرأس وفروة الرأس والوجه',
        latinName: 'Cutis capitis et faciei',
        ta98Code: 'A16.0.00.002',
      };
    }
    if (ny >= 0.62) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cervical Integument (Neck Skin)',
        cleanNameAr: 'جلد العنق',
        latinName: 'Cutis colli',
        ta98Code: 'A16.0.00.003',
      };
    }
    if (ny >= 0.12 && ax > 0.22) {
      return {
        region: 'Upper Limb',
        cleanNameEn: 'Upper Limb & Shoulder Integument',
        cleanNameAr: 'جلد الطرف العلوي والكتف',
        latinName: 'Cutis membri superioris',
        ta98Code: 'A16.0.00.004',
        bilateral: true,
      };
    }
    if (ny >= -0.24 && ax > 0.24) {
      return {
        region: 'Upper Limb',
        cleanNameEn: 'Forearm & Hand Integument',
        cleanNameAr: 'جلد الساعد واليد',
        latinName: 'Cutis antebrachii et manus',
        ta98Code: 'A16.0.00.005',
        bilateral: true,
      };
    }
    if (ny >= -0.24) {
      return {
        region: ny >= 0.12 ? 'Thorax' : ny >= -0.06 ? 'Abdomen' : 'Pelvis and Perineum',
        cleanNameEn:
          sex === 'female' && ny >= 0.22 && nz > 0.03
            ? 'Thoracic & Mammary Integument'
            : 'Thoracic, Abdominal & Pelvic Integument',
        cleanNameAr:
          sex === 'female' && ny >= 0.22 && nz > 0.03
            ? 'جلد الصدر والناحية الثديية'
            : 'جلد الجذع والصدر والبطن والحوض',
        latinName: 'Cutis trunci',
        ta98Code: 'A16.0.00.006',
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Lower Limb & Pedal Integument',
      cleanNameAr: 'جلد الطرف السفلي والقدم',
      latinName: 'Cutis membri inferioris',
      ta98Code: 'A16.0.00.007',
      bilateral: true,
    };
  }

  if (system === 'skeletal') {
    if (ny > 0.84) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cranium (Neurocranium & Calvaria)',
        cleanNameAr: 'القحف (الجمجمة العصبية)',
        latinName: 'Cranium',
        ta98Code: 'A02.1.00.001',
      };
    }
    if (ny > 0.72) {
      if (nz > 0.03 && ny < 0.78) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Mandible',
          cleanNameAr: 'الفك السفلي',
          latinName: 'Mandibula',
          ta98Code: 'A02.1.15.001',
        };
      }
      if (nz > 0.02) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Facial Skeleton (Viscerocranium)',
          cleanNameAr: 'عظام الوجه (الجمجمة الحشوية)',
          latinName: 'Viscerocranium',
          ta98Code: 'A02.1.00.008',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Occipital & Temporal Bone',
        cleanNameAr: 'العظم القذالي والصدغي',
        latinName: 'Os occipitale et temporale',
        ta98Code: 'A02.1.04.001',
      };
    }
    if (ny >= 0.62) {
      if (nz > 0.02) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Hyoid Bone & Laryngeal Cartilage',
          cleanNameAr: 'العظم اللامي وغضاريف الحنجرة',
          latinName: 'Os hyoideum et cartilago laryngis',
          ta98Code: 'A02.1.16.001',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cervical Vertebrae (C1–C7)',
        cleanNameAr: 'الفقرات العنقية',
        latinName: 'Vertebrae cervicales',
        ta98Code: 'A02.2.02.001',
      };
    }
    if (ny >= 0.32) {
      if (ax > 0.22) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Humerus',
          cleanNameAr: 'عظم العضد',
          latinName: 'Humerus',
          ta98Code: 'A02.4.04.001',
          bilateral: true,
        };
      }
      if (ny > 0.54 && ax > 0.05 && nz > -0.02) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Clavicle',
          cleanNameAr: 'عظم الترقوة',
          latinName: 'Clavicula',
          ta98Code: 'A02.4.02.001',
          bilateral: true,
        };
      }
      if (nz < -0.04 && ax > 0.06) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Scapula',
          cleanNameAr: 'عظم لوح الكتف',
          latinName: 'Scapula',
          ta98Code: 'A02.4.01.001',
          bilateral: true,
        };
      }
      if (ax < 0.05 && nz > 0.03) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Sternum',
          cleanNameAr: 'عظم القص',
          latinName: 'Sternum',
          ta98Code: 'A02.3.03.001',
        };
      }
      if (ax < 0.05 && nz <= 0) {
        return {
          region: 'Back and Spinal Cord',
          cleanNameEn: 'Thoracic Vertebrae (T1–T12)',
          cleanNameAr: 'الفقرات الصدرية',
          latinName: 'Vertebrae thoracicae',
          ta98Code: 'A02.2.03.001',
        };
      }
      return {
        region: 'Thorax',
        cleanNameEn: 'Thoracic Rib Cage & Costal Cartilages',
        cleanNameAr: 'الأضلاع والغضاريف الضلعية',
        latinName: 'Costae et cartilagines costales',
        ta98Code: 'A02.3.02.001',
        bilateral: true,
      };
    }
    if (ny >= 0.12) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Radius & Ulna',
          cleanNameAr: 'الكعبرة والزند',
          latinName: 'Radius et ulna',
          ta98Code: 'A02.4.05.001',
          bilateral: true,
        };
      }
      if (ax < 0.06 && nz < 0) {
        return {
          region: 'Back and Spinal Cord',
          cleanNameEn: 'Thoracolumbar Vertebrae',
          cleanNameAr: 'الفقرات الصدرية القطنية',
          latinName: 'Columna vertebralis',
          ta98Code: 'A02.2.00.001',
        };
      }
      return {
        region: 'Thorax',
        cleanNameEn: 'Lower Thoracic Cage (Ribs 8–12)',
        cleanNameAr: 'الأضلاع السفلية',
        latinName: 'Costae spuriae',
        ta98Code: 'A02.3.02.007',
        bilateral: true,
      };
    }
    if (ny >= -0.06) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Radius & Ulna (Distal Forearm)',
          cleanNameAr: 'عظما الساعد (الكعبرة والزند)',
          latinName: 'Radius et ulna',
          ta98Code: 'A02.4.05.001',
          bilateral: true,
        };
      }
      return {
        region: 'Back and Spinal Cord',
        cleanNameEn: 'Lumbar Vertebrae (L1–L5)',
        cleanNameAr: 'الفقرات القطنية',
        latinName: 'Vertebrae lumbales',
        ta98Code: 'A02.2.04.001',
      };
    }
    if (ny >= -0.24) {
      if (ax > 0.32) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Carpals, Metacarpals & Phalanges',
          cleanNameAr: 'عظام الرسغ والمشط والسلاميات',
          latinName: 'Ossa manus',
          ta98Code: 'A02.4.08.001',
          bilateral: true,
        };
      }
      if (ax < 0.06 && nz < -0.01) {
        return {
          region: 'Pelvis and Perineum',
          cleanNameEn: 'Sacrum & Coccyx',
          cleanNameAr: 'العجز والعصعص',
          latinName: 'Os sacrum et coccyx',
          ta98Code: 'A02.2.05.001',
        };
      }
      return {
        region: 'Pelvis and Perineum',
        cleanNameEn: 'Pelvic Girdle (Ilium, Ischium, Pubis)',
        cleanNameAr: 'عظم الحوض (الحرقفة والورك والعانة)',
        latinName: 'Cingulum pelvicum',
        ta98Code: 'A02.5.01.001',
        bilateral: true,
      };
    }
    if (ny >= -0.58) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Femur',
        cleanNameAr: 'عظم الفخذ',
        latinName: 'Femur',
        ta98Code: 'A02.5.04.001',
        bilateral: true,
      };
    }
    if (ny >= -0.66) {
      if (nz > 0.02) {
        return {
          region: 'Lower Limb',
          cleanNameEn: 'Patella',
          cleanNameAr: 'عظم الرضفة',
          latinName: 'Patella',
          ta98Code: 'A02.5.05.001',
          bilateral: true,
        };
      }
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Knee Joint & Femoral-Tibial Condyles',
        cleanNameAr: 'مفصل الركبة ولقم الفخذ والظنبوب',
        latinName: 'Articulatio genus',
        ta98Code: 'A03.6.08.001',
        bilateral: true,
      };
    }
    if (ny >= -0.90) {
      if (ax > 0.10) {
        return {
          region: 'Lower Limb',
          cleanNameEn: 'Fibula',
          cleanNameAr: 'عظم الشظية',
          latinName: 'Fibula',
          ta98Code: 'A02.5.07.001',
          bilateral: true,
        };
      }
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Tibia',
        cleanNameAr: 'عظم الظنبوب',
        latinName: 'Tibia',
        ta98Code: 'A02.5.06.001',
        bilateral: true,
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Tarsals, Metatarsals & Foot Phalanges',
      cleanNameAr: 'عظام الكاحل والمشط وأصابع القدم',
      latinName: 'Ossa pedis',
      ta98Code: 'A02.5.08.001',
      bilateral: true,
    };
  }

  if (system === 'visceral') {
    if (ny > 0.72) {
      if (nz > 0.03) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Nasal Cavity & Oral Pharynx',
          cleanNameAr: 'التجويف الأنفي والبلعوم الفموي',
          latinName: 'Cavitas nasi et pharynx',
          ta98Code: 'A06.1.02.001',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Pharynx & Salivary Glands',
        cleanNameAr: 'البلعوم والغدد اللعابية',
        latinName: 'Pharynx et glandulae salivariae',
        ta98Code: 'A05.3.01.001',
      };
    }
    if (ny >= 0.62) {
      if (ny < 0.67 && ax < 0.04 && nz > 0.01) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Thyroid Gland',
          cleanNameAr: 'الغدة الدرقية',
          latinName: 'Glandula thyroidea',
          ta98Code: 'A11.3.00.001',
        };
      }
      if (nz > 0.01) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Larynx & Upper Trachea',
          cleanNameAr: 'الحنجرة وأعلى القصبة الهوائية',
          latinName: 'Larynx et trachea',
          ta98Code: 'A06.2.01.001',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cervical Esophagus',
        cleanNameAr: 'المريء العنقي',
        latinName: 'Pars cervicalis oesophagi',
        ta98Code: 'A05.4.01.002',
      };
    }
    if (ny >= 0.32) {
      if (ax > 0.045) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Lungs (Pulmonary Lobes)',
          cleanNameAr: 'الرئة',
          latinName: 'Pulmones',
          ta98Code: 'A06.5.01.001',
          bilateral: true,
        };
      }
      if (ny > 0.50 && nz >= 0) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Trachea & Primary Bronchi',
          cleanNameAr: 'القصبة الهوائية والشعب الرئيسية',
          latinName: 'Trachea et bronchi principales',
          ta98Code: 'A06.3.01.001',
        };
      }
      if (nz < -0.02) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Thoracic Esophagus',
          cleanNameAr: 'المريء الصدري',
          latinName: 'Pars thoracica oesophagi',
          ta98Code: 'A05.4.01.003',
        };
      }
      return {
        region: 'Thorax',
        cleanNameEn: 'Thymus & Mediastinal Viscera',
        cleanNameAr: 'الغدة الزعترية والمنصف',
        latinName: 'Thymus et mediastinum',
        ta98Code: 'A13.1.02.001',
      };
    }
    if (ny >= 0.12) {
      if (ny > 0.25 && ax > 0.05) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Lung Bases & Diaphragmatic Pleura',
          cleanNameAr: 'قاعدة الرئة والجنبة الحجابية',
          latinName: 'Basis pulmonis',
          ta98Code: 'A06.5.01.011',
          bilateral: true,
        };
      }
      if (nx < -0.015) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Liver & Gallbladder',
          cleanNameAr: 'الكبد والمرارة',
          latinName: 'Hepar et vesica biliaris',
          ta98Code: 'A05.8.01.001',
        };
      }
      if (nx > 0.065) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Spleen',
          cleanNameAr: 'الطحال',
          latinName: 'Splen',
          ta98Code: 'A13.2.01.001',
        };
      }
      if (nz > 0) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Stomach & Duodenum',
          cleanNameAr: 'المعدة والاثنا عشر',
          latinName: 'Gaster et duodenum',
          ta98Code: 'A05.5.01.001',
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Pancreas & Suprarenal Glands',
        cleanNameAr: 'البنكرياس والغدد الكظرية',
        latinName: 'Pancreas et glandulae suprarenales',
        ta98Code: 'A05.9.01.001',
      };
    }
    if (ny >= -0.06) {
      if (ax > 0.05 && nz <= 0.01) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Kidney & Ureter',
          cleanNameAr: 'الكلية والحالب',
          latinName: 'Ren et ureter',
          ta98Code: 'A08.1.01.001',
          bilateral: true,
        };
      }
      if (ax > 0.065 || ny > 0.06) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Large Intestine (Colon)',
          cleanNameAr: 'الأمعاء الغليظة (القولون)',
          latinName: 'Intestinum crassum',
          ta98Code: 'A05.7.03.001',
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Small Intestine (Jejunum & Ileum)',
        cleanNameAr: 'الأمعاء الدقيقة (الصائم واللفائفي)',
        latinName: 'Intestinum tenue',
        ta98Code: 'A05.6.01.001',
      };
    }
    if (ny >= -0.24) {
      if (nz > 0.02) {
        return {
          region: 'Pelvis and Perineum',
          cleanNameEn: 'Urinary Bladder',
          cleanNameAr: 'المثانة البولية',
          latinName: 'Vesica urinaria',
          ta98Code: 'A08.3.01.001',
        };
      }
      if (nz < -0.02) {
        return {
          region: 'Pelvis and Perineum',
          cleanNameEn: 'Rectum & Sigmoid Colon',
          cleanNameAr: 'المستقيم والقولون السيني',
          latinName: 'Rectum et colon sigmoideum',
          ta98Code: 'A05.7.04.001',
        };
      }
      if (sex === 'female') {
        return {
          region: 'Pelvis and Perineum',
          cleanNameEn: 'Uterus, Ovaries & Fallopian Tubes',
          cleanNameAr: 'الرحم والمبيضان وقناتا فالوب',
          latinName: 'Uterus et ovaria',
          ta98Code: 'A09.1.03.001',
        };
      }
      return {
        region: 'Pelvis and Perineum',
        cleanNameEn: 'Pelvic Viscera',
        cleanNameAr: 'أحشاء الحوض',
        latinName: 'Viscera pelvica',
        ta98Code: 'A09.0.00.001',
      };
    }
    return {
      region: 'Pelvis and Perineum',
      cleanNameEn: 'Perineal & Pelvic Floor Fascia',
      cleanNameAr: 'أرضية الحوض والعجان',
      latinName: 'Diaphragma pelvis',
      ta98Code: 'A04.5.04.001',
    };
  }

  if (system === 'cardiovascular') {
    const isVein = /\b(?:vein|vena|venous|sinus)\b/i.test(matLower);
    if (ny > 0.72) {
      return isVein
        ? {
            region: 'Head and Neck',
            cleanNameEn: 'Cerebral Dural Sinuses & Jugular Venous System',
            cleanNameAr: 'الجيوب الوريدية الدماغية',
            latinName: 'Sinus durae matris',
            ta98Code: 'A12.3.05.101',
          }
        : {
            region: 'Head and Neck',
            cleanNameEn: 'Cerebral & Facial Arteries (Circle of Willis)',
            cleanNameAr: 'الشرايين الدماغية والوجهية',
            latinName: 'Circulus arteriosus cerebri',
            ta98Code: 'A12.2.07.081',
          };
    }
    if (ny >= 0.62) {
      return isVein
        ? {
            region: 'Head and Neck',
            cleanNameEn: 'Internal & External Jugular Vein',
            cleanNameAr: 'الوريد الوداجي الباطن والظاهر',
            latinName: 'Vena jugularis',
            ta98Code: 'A12.3.05.001',
            bilateral: true,
          }
        : {
            region: 'Head and Neck',
            cleanNameEn: 'Common & Internal Carotid Artery',
            cleanNameAr: 'الشريان السباتي الأصلي والباطن',
            latinName: 'Arteria carotis',
            ta98Code: 'A12.2.04.006',
            bilateral: true,
          };
    }
    if (ny >= 0.32) {
      if (ax > 0.22) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Brachial Artery & Basilic/Cephalic Veins',
          cleanNameAr: 'الشريان العضدي وأوردة الذراع',
          latinName: 'Arteria brachialis et venae brachii',
          ta98Code: 'A12.2.09.018',
          bilateral: true,
        };
      }
      if (ax < 0.08 && ny < 0.48 && nz > -0.01) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Heart & Coronary Vessels',
          cleanNameAr: 'القلب والأوعية التاجية',
          latinName: 'Cor et vasa coronaria',
          ta98Code: 'A12.1.00.001',
        };
      }
      if (isVein) {
        return {
          region: 'Thorax',
          cleanNameEn: 'Superior Vena Cava & Brachiocephalic Veins',
          cleanNameAr: 'الوريد الأجوف العلوي والأوردة العضدية الرأسية',
          latinName: 'Vena cava superior',
          ta98Code: 'A12.3.03.001',
        };
      }
      return {
        region: 'Thorax',
        cleanNameEn: 'Thoracic Aorta & Great Vessels',
        cleanNameAr: 'قوس الأبهر والأبهر الصدري',
        latinName: 'Arcus aortae et aorta thoracica',
        ta98Code: 'A12.2.04.001',
      };
    }
    if (ny >= 0.12) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Brachial, Radial & Ulnar Vessels',
          cleanNameAr: 'الشريان العضدي والكعبري والزندي',
          latinName: 'Arteriae brachialis, radialis et ulnaris',
          ta98Code: 'A12.2.09.027',
          bilateral: true,
        };
      }
      if (nx < 0 || isVein) {
        return {
          region: 'Abdomen',
          cleanNameEn: 'Inferior Vena Cava & Hepatic Portal System',
          cleanNameAr: 'الوريد الأجوف السفلي والوريد البابي',
          latinName: 'Vena cava inferior et vena portae',
          ta98Code: 'A12.3.09.001',
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Abdominal Aorta & Celiac Trunk',
        cleanNameAr: 'الأبهر البطني والجذع البطني',
        latinName: 'Aorta abdominalis et truncus coeliacus',
        ta98Code: 'A12.2.12.001',
      };
    }
    if (ny >= -0.06) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Radial & Ulnar Arteries and Veins',
          cleanNameAr: 'الشريانان والأوردة الكعبرية والزندية',
          latinName: 'Arteriae radialis et ulnaris',
          ta98Code: 'A12.2.09.027',
          bilateral: true,
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Abdominal Aorta, Renal & Mesenteric Vessels',
        cleanNameAr: 'الأبهر البطني والأوعية الكلوية والمساريقية',
        latinName: 'Aorta abdominalis et vasa renalia',
        ta98Code: 'A12.2.12.053',
      };
    }
    if (ny >= -0.24) {
      if (ax > 0.32) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Palmar Arches & Digital Vessels',
          cleanNameAr: 'الأقواس الشريانية والوريدية الراحية',
          latinName: 'Arcus palmaris et vasa digitalia',
          ta98Code: 'A12.2.09.055',
          bilateral: true,
        };
      }
      return {
        region: 'Pelvis and Perineum',
        cleanNameEn: 'Common, External & Internal Iliac Vessels',
        cleanNameAr: 'الأوعية الحرقفية الأصلية والظاهرة والباطنة',
        latinName: 'Vasa iliaca communia, externa et interna',
        ta98Code: 'A12.2.14.001',
        bilateral: true,
      };
    }
    if (ny >= -0.58) {
      if (ax > 0.06 && nz > 0.01) {
        return {
          region: 'Lower Limb',
          cleanNameEn: 'Femoral Artery & Great Saphenous Vein',
          cleanNameAr: 'الشريان الفخذي والوريد الصافن الكبير',
          latinName: 'Arteria femoralis et vena saphena magna',
          ta98Code: 'A12.2.16.010',
          bilateral: true,
        };
      }
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Deep Femoral (Profunda Femoris) Vessels',
        cleanNameAr: 'الأوعية الفخذية العميقة',
        latinName: 'Arteria profunda femoris',
        ta98Code: 'A12.2.16.020',
        bilateral: true,
      };
    }
    if (ny >= -0.66) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Popliteal Artery & Vein',
        cleanNameAr: 'الشريان والوريد المأبضي',
        latinName: 'Vasa poplitea',
        ta98Code: 'A12.2.16.033',
        bilateral: true,
      };
    }
    if (ny >= -0.90) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Tibial & Fibular Arteries and Veins',
        cleanNameAr: 'الشرايين والأوردة الظنبوبية والشظوية',
        latinName: 'Vasa tibialia et fibularia',
        ta98Code: 'A12.2.16.042',
        bilateral: true,
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Dorsalis Pedis & Plantar Vascular Arch',
      cleanNameAr: 'شريان ظهر القدم والقوس الأخمصي',
      latinName: 'Arteria dorsalis pedis et arcus plantaris',
      ta98Code: 'A12.2.16.048',
      bilateral: true,
    };
  }

  if (system === 'nervous') {
    if (ny > 0.72) {
      if (ny > 0.80 && ax < 0.08 && nz > -0.09) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Cerebrum (Cerebral Cortex & White Matter)',
          cleanNameAr: 'المخ (القشرة المخية والمادة البيضاء)',
          latinName: 'Cerebrum',
          ta98Code: 'A14.1.09.001',
        };
      }
      if (nz < -0.02 && ny <= 0.82) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Cerebellum & Brainstem',
          cleanNameAr: 'المخيخ وجذع الدماغ',
          latinName: 'Cerebellum et truncus encephali',
          ta98Code: 'A14.1.07.001',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cranial Nerves & Trigeminal Branches',
        cleanNameAr: 'الأعصاب القحفية والعصب مثلث التوائم',
        latinName: 'Nervi craniales',
        ta98Code: 'A14.2.01.001',
        bilateral: true,
      };
    }
    if (ny >= 0.62) {
      if (ax < 0.04) {
        return {
          region: 'Head and Neck',
          cleanNameEn: 'Cervical Spinal Cord (C1–C8)',
          cleanNameAr: 'الحبل الشوكي العنقي',
          latinName: 'Medulla spinalis cervicalis',
          ta98Code: 'A14.1.02.001',
        };
      }
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Cervical Plexus & Vagus / Phrenic Nerves',
        cleanNameAr: 'الضفيرة العنقية والعصب المبهم والحجابي',
        latinName: 'Plexus cervicalis et nervus vagus',
        ta98Code: 'A14.2.02.001',
        bilateral: true,
      };
    }
    if (ny >= 0.32) {
      if (ax > 0.14) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Brachial Plexus & Median/Ulnar/Radial Nerves',
          cleanNameAr: 'الضفيرة العضدية وأعصاب الذراع',
          latinName: 'Plexus brachialis',
          ta98Code: 'A14.2.03.001',
          bilateral: true,
        };
      }
      if (ax < 0.045) {
        return {
          region: 'Back and Spinal Cord',
          cleanNameEn: 'Thoracic Spinal Cord & Sympathetic Trunk',
          cleanNameAr: 'الحبل الشوكي الصدري والجذع الودي',
          latinName: 'Medulla spinalis thoracica',
          ta98Code: 'A14.1.02.002',
        };
      }
      return {
        region: 'Thorax',
        cleanNameEn: 'Intercostal Nerves (T1–T11)',
        cleanNameAr: 'الأعصاب الوربية',
        latinName: 'Nervi intercostales',
        ta98Code: 'A14.2.04.001',
        bilateral: true,
      };
    }
    if (ny >= 0.12) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Median, Ulnar & Radial Nerves (Arm)',
          cleanNameAr: 'العصب المتوسط والزندي والكعبري (العضد)',
          latinName: 'Nervi medianus, ulnaris et radialis',
          ta98Code: 'A14.2.03.031',
          bilateral: true,
        };
      }
      if (ax < 0.045) {
        return {
          region: 'Back and Spinal Cord',
          cleanNameEn: 'Spinal Cord (Conus Medullaris) & Splanchnic Nerves',
          cleanNameAr: 'المخروط النخاعي والأعصاب الحشوية',
          latinName: 'Conus medullaris',
          ta98Code: 'A14.1.02.007',
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Thoracoabdominal & Subcostal Nerves',
        cleanNameAr: 'الأعصاب الصدرية البطنية',
        latinName: 'Nervi thoracoabdominales',
        ta98Code: 'A14.2.04.007',
        bilateral: true,
      };
    }
    if (ny >= -0.06) {
      if (ax > 0.24) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Forearm & Cutaneous Nerves',
          cleanNameAr: 'أعصاب الساعد الحسية والحركية',
          latinName: 'Nervi cutanei et interossei antebrachii',
          ta98Code: 'A14.2.03.038',
          bilateral: true,
        };
      }
      if (ax < 0.045) {
        return {
          region: 'Back and Spinal Cord',
          cleanNameEn: 'Cauda Equina & Lumbar Plexus',
          cleanNameAr: 'ذيل الفرس والضفيرة القطنية',
          latinName: 'Cauda equina et plexus lumbalis',
          ta98Code: 'A14.1.02.012',
        };
      }
      return {
        region: 'Abdomen',
        cleanNameEn: 'Lumbar Plexus Branches (Iliohypogastric / Ilioinguinal)',
        cleanNameAr: 'فروع الضفيرة القطنية',
        latinName: 'Plexus lumbalis',
        ta98Code: 'A14.2.07.002',
        bilateral: true,
      };
    }
    if (ny >= -0.24) {
      if (ax > 0.32) {
        return {
          region: 'Upper Limb',
          cleanNameEn: 'Palmar & Digital Nerves of Hand',
          cleanNameAr: 'الأعصاب الإصبعية لليد',
          latinName: 'Nervi digitales manus',
          ta98Code: 'A14.2.03.040',
          bilateral: true,
        };
      }
      return {
        region: 'Pelvis and Perineum',
        cleanNameEn: 'Sacral & Pudendal Plexus',
        cleanNameAr: 'الضفيرة العجزية والفرجية',
        latinName: 'Plexus sacralis',
        ta98Code: 'A14.2.07.027',
        bilateral: true,
      };
    }
    if (ny >= -0.58) {
      if (nz > 0.01) {
        return {
          region: 'Lower Limb',
          cleanNameEn: 'Femoral & Obturator Nerves',
          cleanNameAr: 'العصب الفخذي والسدادي',
          latinName: 'Nervus femoralis et obturatorius',
          ta98Code: 'A14.2.07.020',
          bilateral: true,
        };
      }
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Sciatic Nerve (Nervus Ischiadicus)',
        cleanNameAr: 'العصب الوركي',
        latinName: 'Nervus ischiadicus',
        ta98Code: 'A14.2.07.046',
        bilateral: true,
      };
    }
    if (ny >= -0.66) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Tibial & Common Fibular Nerves (Popliteal)',
        cleanNameAr: 'العصب الظنبوبي والشظوي المشترك',
        latinName: 'Nervus tibialis et fibularis communis',
        ta98Code: 'A14.2.07.047',
        bilateral: true,
      };
    }
    if (ny >= -0.90) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Tibial, Deep & Superficial Fibular Nerves',
        cleanNameAr: 'العصب الظنبوبي والشظوي السطحي والعميق',
        latinName: 'Nervi tibialis et fibularis',
        ta98Code: 'A14.2.07.056',
        bilateral: true,
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Plantar & Dorsal Digital Nerves of Foot',
      cleanNameAr: 'الأعصاب الأخمصية والظهرية للقدم',
      latinName: 'Nervi plantares et digitales pedis',
      ta98Code: 'A14.2.07.064',
      bilateral: true,
    };
  }

  // Default / Muscular system (`system === 'muscular'` and any fallback):
  // Exact 10-band anatomical matrix across normalized body height [-1.0 .. +1.0]
  if (ny > 0.74) {
    if (ny > 0.84) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Occipitofrontalis (Epicranius)',
        cleanNameAr: 'العضلة القذالية الجبهية',
        latinName: 'Musculus occipitofrontalis',
        ta98Code: 'A04.1.03.003',
      };
    }
    if (ax > 0.055) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Temporalis Muscle',
        cleanNameAr: 'العضلة الصدغية',
        latinName: 'Musculus temporalis',
        ta98Code: 'A04.1.04.005',
        bilateral: true,
      };
    }
    if (nz > 0.04) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Orbicularis Oris & Facial Muscles',
        cleanNameAr: 'العضلة الدويرية الفموية وعضلات الوجه',
        latinName: 'Musculus orbicularis oris',
        ta98Code: 'A04.1.03.023',
      };
    }
    return {
      region: 'Head and Neck',
      cleanNameEn: 'Masseter Muscle',
      cleanNameAr: 'العضلة الماضغة',
      latinName: 'Musculus masseter',
      ta98Code: 'A04.1.04.002',
      bilateral: true,
    };
  }

  if (ny >= 0.62) {
    if (nz > 0.03) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Infrahyoid & Platysma Muscles',
        cleanNameAr: 'العضلات تحت اللامية والعضلة الجلدية للعنق',
        latinName: 'Musculi infrahyoidei et platysma',
        ta98Code: 'A04.2.04.001',
      };
    }
    if (ax > 0.035 && nz > -0.02) {
      return {
        region: 'Head and Neck',
        cleanNameEn: 'Sternocleidomastoid Muscle',
        cleanNameAr: 'العضلة القصية الترقوية الخشائية',
        latinName: 'Musculus sternocleidomastoideus',
        ta98Code: 'A04.2.01.008',
        bilateral: true,
      };
    }
    return {
      region: 'Head and Neck',
      cleanNameEn: 'Trapezius (Upper) & Deep Cervical Muscles',
      cleanNameAr: 'العضلة شبه المنحرفة وعضلات العنق العميقة',
      latinName: 'Musculus trapezius (pars descendens)',
      ta98Code: 'A04.3.01.001',
    };
  }

  if (ny >= 0.32) {
    if (ax > 0.22) {
      return {
        region: 'Upper Limb',
        cleanNameEn: 'Deltoid & Shoulder Musculature',
        cleanNameAr: 'العضلة الدالية وعضلات الكتف',
        latinName: 'Musculus deltoideus',
        ta98Code: 'A04.6.02.002',
        bilateral: true,
      };
    }
    if (nz > 0.04) {
      return {
        region: 'Thorax',
        cleanNameEn: 'Pectoralis Major',
        cleanNameAr: 'العضلة الصدرية الكبيرة',
        latinName: 'Musculus pectoralis major',
        ta98Code: 'A04.4.01.002',
        bilateral: true,
      };
    }
    if (nz < -0.04) {
      return {
        region: 'Back and Spinal Cord',
        cleanNameEn: 'Trapezius & Latissimus Dorsi',
        cleanNameAr: 'العضلة شبه المنحرفة والعريضة الظهرية',
        latinName: 'Musculus trapezius et latissimus dorsi',
        ta98Code: 'A04.3.01.006',
        bilateral: true,
      };
    }
    return {
      region: 'Thorax',
      cleanNameEn: 'Serratus Anterior & Intercostal Muscles',
      cleanNameAr: 'العضلة المنشارية الأمامية والعضلات الوربية',
      latinName: 'Musculus serratus anterior',
      ta98Code: 'A04.4.01.008',
      bilateral: true,
    };
  }

  if (ny >= 0.12) {
    if (ax > 0.24) {
      return nz >= 0
        ? {
            region: 'Upper Limb',
            cleanNameEn: 'Biceps Brachii & Brachialis',
            cleanNameAr: 'العضلة ذات الرأسين العضدية والعضدية',
            latinName: 'Musculus biceps brachii et brachialis',
            ta98Code: 'A04.6.02.013',
            bilateral: true,
          }
        : {
            region: 'Upper Limb',
            cleanNameEn: 'Triceps Brachii',
            cleanNameAr: 'العضلة ثلاثية الرؤوس العضدية',
            latinName: 'Musculus triceps brachii',
            ta98Code: 'A04.6.02.019',
            bilateral: true,
          };
    }
    if (nz > 0.04) {
      return {
        region: 'Abdomen',
        cleanNameEn: 'Rectus Abdominis (Upper)',
        cleanNameAr: 'العضلة المستقيمة البطنية (العلوية)',
        latinName: 'Musculus rectus abdominis',
        ta98Code: 'A04.5.01.001',
      };
    }
    if (nz < -0.03) {
      return {
        region: 'Back and Spinal Cord',
        cleanNameEn: 'Latissimus Dorsi & Erector Spinae',
        cleanNameAr: 'العضلة العريضة الظهرية وناصبة الفقار',
        latinName: 'Musculus latissimus dorsi et erector spinae',
        ta98Code: 'A04.3.02.002',
        bilateral: true,
      };
    }
    return {
      region: 'Abdomen',
      cleanNameEn: 'External Abdominal Oblique',
      cleanNameAr: 'العضلة المائلة البطنية الظاهرة',
      latinName: 'Musculus obliquus externus abdominis',
      ta98Code: 'A04.5.01.008',
      bilateral: true,
    };
  }

  if (ny >= -0.06) {
    if (ax > 0.24) {
      return {
        region: 'Upper Limb',
        cleanNameEn: 'Forearm Flexors & Extensors',
        cleanNameAr: 'عضلات الساعد القابضة والباسطة',
        latinName: 'Musculi flexores et extensores antebrachii',
        ta98Code: 'A04.6.02.025',
        bilateral: true,
      };
    }
    if (ax < 0.06 && nz > 0.04) {
      return {
        region: 'Abdomen',
        cleanNameEn: 'Rectus Abdominis',
        cleanNameAr: 'العضلة المستقيمة البطنية',
        latinName: 'Musculus rectus abdominis',
        ta98Code: 'A04.5.01.001',
      };
    }
    if (nz >= -0.02) {
      return {
        region: 'Abdomen',
        cleanNameEn: 'Abdominal Obliques & Transversus',
        cleanNameAr: 'العضلات المائلة والمستعرضة البطنية',
        latinName: 'Musculi obliqui et transversus abdominis',
        ta98Code: 'A04.5.01.019',
        bilateral: true,
      };
    }
    return {
      region: 'Back and Spinal Cord',
      cleanNameEn: 'Thoracolumbar Fascia & Erector Spinae',
      cleanNameAr: 'اللفافة الصدرية القطنية وناصبة الفقار',
      latinName: 'Fascia thoracolumbalis et erector spinae',
      ta98Code: 'A04.3.02.001',
    };
  }

  if (ny >= -0.24) {
    if (ax > 0.32) {
      return {
        region: 'Upper Limb',
        cleanNameEn: 'Hand Intrinsic Muscles (Thenar / Hypothenar)',
        cleanNameAr: 'عضلات اليد الداخلية (الرَّاحة وضرة الخنصر)',
        latinName: 'Musculi manus',
        ta98Code: 'A04.6.02.053',
        bilateral: true,
      };
    }
    if (nz > 0.02) {
      return {
        region: 'Pelvis and Perineum',
        cleanNameEn: 'Iliopsoas & Tensor Fasciae Latae',
        cleanNameAr: 'العضلة الحرقفية القطنية وموترة اللفافة العريضة',
        latinName: 'Musculus iliopsoas et tensor fasciae latae',
        ta98Code: 'A04.7.02.001',
        bilateral: true,
      };
    }
    return {
      region: 'Pelvis and Perineum',
      cleanNameEn: 'Gluteus Maximus & Gluteus Medius',
      cleanNameAr: 'العضلة الألوية الكبرى والوسطى',
      latinName: 'Musculus gluteus maximus et medius',
      ta98Code: 'A04.7.02.006',
      bilateral: true,
    };
  }

  if (ny >= -0.58) {
    if (ax < 0.07) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Adductor Magnus & Longus',
        cleanNameAr: 'العضلة المقربة الكبيرة والطويلة',
        latinName: 'Musculus adductor magnus et longus',
        ta98Code: 'A04.7.02.026',
        bilateral: true,
      };
    }
    if (nz > 0.015) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Quadriceps Femoris (Rectus Femoris / Vastus)',
        cleanNameAr: 'العضلة رباعية الرؤوس الفخذية',
        latinName: 'Musculus quadriceps femoris',
        ta98Code: 'A04.7.02.017',
        bilateral: true,
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Hamstrings (Biceps Femoris & Semitendinosus)',
      cleanNameAr: 'عضلات المأبض (ذات الرأسين الفخذية وشبه الوترية)',
      latinName: 'Musculi ischiocrurales (biceps femoris)',
      ta98Code: 'A04.7.02.032',
      bilateral: true,
    };
  }

  if (ny >= -0.66) {
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Patellar Tendon & Popliteal Musculature',
      cleanNameAr: 'الوتر الرضفي وعضلات الحفرة المأبضية',
      latinName: 'Ligamentum patellae et musculus popliteus',
      ta98Code: 'A04.7.02.050',
      bilateral: true,
    };
  }

  if (ny >= -0.90) {
    if (nz > 0.01) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Tibialis Anterior & Extensor Digitorum Longus',
        cleanNameAr: 'العضلة الظنبوبية الأمامية وباسطة الأصابع الطويلة',
        latinName: 'Musculus tibialis anterior',
        ta98Code: 'A04.7.02.037',
        bilateral: true,
      };
    }
    if (nz < -0.01) {
      return {
        region: 'Lower Limb',
        cleanNameEn: 'Gastrocnemius & Soleus',
        cleanNameAr: 'عضلة الساق (التوأمية الساقية والنعلية)',
        latinName: 'Musculus triceps surae',
        ta98Code: 'A04.7.02.044',
        bilateral: true,
      };
    }
    return {
      region: 'Lower Limb',
      cleanNameEn: 'Fibularis (Peroneus) Longus & Brevis',
      cleanNameAr: 'العضلة الشظوية الطويلة والقصيرة',
      latinName: 'Musculus fibularis longus et brevis',
      ta98Code: 'A04.7.02.041',
      bilateral: true,
    };
  }

  return {
    region: 'Lower Limb',
    cleanNameEn: 'Intrinsic Foot & Extensor Digitorum Brevis',
    cleanNameAr: 'عضلات القدم الداخلية وباسطة الأصابع القصيرة',
    latinName: 'Musculi pedis',
    ta98Code: 'A04.7.02.056',
    bilateral: true,
  };
}

/**
 * Resolves any generic/numbered mesh node (`Object_12`, `Mesh_004`, `Part 756`)
 * or material-tagged organ mesh into a verified anatomical structure using:
 * 1) Explicit GLB material identifiers (`Uterus_Whole`, `Ovary2`, `Bone__Female_Pelvis`, ...)
 * 2) Complete 6-system 3D normalized coordinate lookup matrix (`ny in [-1.0, +1.0]`, `nx`, `nz`)
 *    with exact English, Latin (TA2), Arabic (`cleanNameAr`), and `TA98` codes
 *    (zero "Part N" / "الجزء" strings ever emitted).
 */
export function resolveSpatialStructure(
  coords: SpatialCoordsInput,
  system: AnatomicalSystem,
  materialHint?: string,
  _partIndex = 0,
  sex: BiologicalSex = 'male'
): ResolvedSpatialStructure {
  const { x: nx, y: ny, z: nz } = toNormalizedCoords(coords);
  const side = inferSideFromX(nx);

  const mat = (materialHint || '')
    .replace(/[_.\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const matLower = mat.toLowerCase();
  if (mat) {
    for (const rule of MATERIAL_STRUCTURE_MAP) {
      if (rule.regex.test(mat)) {
        const { en, ar } = rule.bilateral
          ? formatBilateralName(rule.cleanNameEn, rule.cleanNameAr, side)
          : { en: rule.cleanNameEn, ar: rule.cleanNameAr };
        return {
          cleanNameEn: en,
          cleanNameAr: ar,
          latinName: rule.latinName,
          ta98Code: rule.ta98Code,
          region: rule.region,
          system: rule.system,
          laterality: rule.bilateral ? side : 'Median / Unpaired',
          confidence: 'material-exact',
        };
      }
    }
  }

  let effectiveSystem: AnatomicalSystem = system;
  if (/\b(?:bone|bones|cartilage|skull|teeth|suture)\b/i.test(matLower)) {
    effectiveSystem = 'skeletal';
  } else if (/\b(?:muscle|muscles|tendon|tendons|fascia)\b/i.test(matLower)) {
    effectiveSystem = 'muscular';
  } else if (/\b(?:skin|epiderm|dermis|cutis)\b/i.test(matLower)) {
    effectiveSystem = 'integumentary';
  } else if (/\b(?:artery|vein|aorta|cardiac|heart|vascular)\b/i.test(matLower)) {
    effectiveSystem = 'cardiovascular';
  } else if (/\b(?:nerve|nervus|brain|spinal|gangli|plexus)\b/i.test(matLower)) {
    effectiveSystem = 'nervous';
  }

  const matched = resolveNormalizedSixSystemZone(
    nx,
    ny,
    nz,
    effectiveSystem,
    matLower,
    sex
  );

  const { en, ar } = matched.bilateral
    ? formatBilateralName(matched.cleanNameEn, matched.cleanNameAr, side)
    : { en: matched.cleanNameEn, ar: matched.cleanNameAr };

  const region = matched.region || inferBodyRegionFromNormalizedY(nx, ny, nz);

  return {
    cleanNameEn: en,
    cleanNameAr: ar,
    latinName: matched.latinName,
    ta98Code: matched.ta98Code,
    region,
    system: effectiveSystem,
    laterality: matched.bilateral ? side : 'Median / Unpaired',
    confidence: 'spatial-landmark',
  };
}
