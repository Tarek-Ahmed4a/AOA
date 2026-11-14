import * as THREE from 'three';
import type {
  AnatomicalSystem,
  OfficialAtlasPresetId,
} from '../store/useAnatomyStore';

export type AnatomicalSide = 'left' | 'right' | 'center';

export type ExplodeClusterId =
  // Skeletal
  | 'skeletal_axial'
  | 'skeletal_rib_left'
  | 'skeletal_rib_right'
  | 'skeletal_upper_limb_left'
  | 'skeletal_upper_limb_right'
  | 'skeletal_lower_limb_left'
  | 'skeletal_lower_limb_right'
  // Muscular
  | 'muscular_head_neck_left'
  | 'muscular_head_neck_right'
  | 'muscular_anterior_torso_left'
  | 'muscular_anterior_torso_right'
  | 'muscular_posterior_torso_left'
  | 'muscular_posterior_torso_right'
  | 'muscular_upper_limb_left'
  | 'muscular_upper_limb_right'
  | 'muscular_lower_limb_left'
  | 'muscular_lower_limb_right'
  // Visceral
  | 'visceral_upper_airway'
  | 'visceral_lung_right'
  | 'visceral_lung_left'
  | 'visceral_liver_gallbladder'
  | 'visceral_stomach_spleen_pancreas'
  | 'visceral_intestines'
  | 'visceral_kidneys_ureters_left'
  | 'visceral_kidneys_ureters_right'
  | 'visceral_pelvic_urogenital'
  | 'visceral_mammary_left'
  | 'visceral_mammary_right'
  // Cardiovascular / Nervous / Integumentary
  | 'cardiovascular_tree'
  | 'nervous_tree'
  | 'integumentary_left_anterior'
  | 'integumentary_right_anterior'
  | 'integumentary_left_posterior'
  | 'integumentary_right_posterior';

export interface ExplodeDisplayContext {
  activeAtlasPreset: OfficialAtlasPresetId;
  activeSystems: Record<AnatomicalSystem, boolean>;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./():;,[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveExplodeSide(
  rawName: string,
  worldCenter: THREE.Vector3
): AnatomicalSide {
  const norm = normalizeText(rawName);
  const hasLeft = /\bleft\b|\bsinist|\bl\s/.test(norm);
  const hasRight = /\bright\b|\bdext|\br\s/.test(norm);
  if (hasLeft && !hasRight) return 'left';
  if (hasRight && !hasLeft) return 'right';
  if (worldCenter.x > 0.015) return 'left';
  if (worldCenter.x < -0.015) return 'right';
  return 'center';
}

function resolveLeftOrRight(
  rawName: string,
  worldCenter: THREE.Vector3
): 'left' | 'right' {
  const side = resolveExplodeSide(rawName, worldCenter);
  if (side === 'left' || side === 'right') return side;
  return worldCenter.x >= 0 ? 'left' : 'right';
}

const SKELETAL_AXIAL_REGEX =
  /\b(skull|cranium|frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|maxilla|mandible|zygomatic|nasal bone|lacrimal|palatine|vomer|hyoid|ossicle|malleus|incus|stapes|suture|fontanelle|tooth|teeth|incisor|canine|premolar|molar|vertebr[a-z]*|atlas|axis|sacrum|sacral|coccyx|coccygeal|intervertebr[a-z]*|sternum|manubrium|xiphoid|hip bone|ilium|ischium|pubis|pubic|pelvis|pelvic girdle|clavicle|scapula|acromion|coracoid|glenoid|spinal column|thoracic cage)\b/i;

const SKELETAL_RIB_REGEX =
  /\b(rib|ribs|costal cartilage|costovertebral|costotransverse|costochondral)\b/i;

const SKELETAL_UPPER_LIMB_REGEX =
  /\b(humer[a-z]*|radius|radial|ulna|ulnar|carpal[a-z]*|scaphoid|lunate|triquetr[a-z]*|pisiform|trapezium|trapezoid|capitate|hamate|metacarp[a-z]*|manus|hand|wrist|elbow|radioulnar|thumb|pollex|pollicis|indicis|interosseous membrane of forearm|finger(?! of foot))\b/i;

const SKELETAL_LOWER_LIMB_REGEX =
  /\b(femur|femoral|patella|tibia|tibial|fibula|fibular|tarsal[a-z]*|calcane[a-z]*|talus|navicular|cuboid|cuneiform|metatars[a-z]*|foot|of foot|pedis|ankle|knee|toe|toes|hallux|hallucis|plantar|meniscus|tibiofibular|interosseous membrane of leg)\b/i;

const MUSCULAR_HEAD_NECK_REGEX =
  /\b(sternocleidomastoid|scalene|scalenus|platysma|omohyoid|sternohyoid|thyrohyoid|sternothyroid|stylohyoid|digastric|mylohyoid|geniohyoid|geniogloss[a-z]*|hyoglossus|styloglossus|palatoglossus|masseter|temporalis|pterygoid|buccinator|orbicularis|zygomaticus|risorius|mentalis|depressor labii|depressor anguli|levator labii|levator anguli|nasalis|procerus|corrugator|frontalis|occipitofrontalis|epicrani[a-z]*|auricular|arytenoid|cricoarytenoid|cricothyroid|thyroarytenoid|vocalis|pharynge[a-z]*|cricopharynge[a-z]*|palatopharynge[a-z]*|stylopharynge[a-z]*|salpingopharynge[a-z]*|tensor veli|levator veli|uvulae|superior oblique muscle|inferior oblique muscle|trochlea of superior oblique|rectus muscle of eye|levator palpebrae|longus colli|longus capitis|rectus capitis|obliquus capitis|obliquus.*capitis|suprahyoid|infrahyoid|lingual|facial|temporoparietal)\b/i;

const MUSCULAR_UPPER_LIMB_REGEX =
  /\b(deltoid|supraspinat[a-z]*|infraspinat[a-z]*|teres major|teres minor|subscapular[a-z]*|coracobrachial[a-z]*|biceps brach[a-z]*|brachialis|brachioradialis|triceps brach[a-z]*|anconeus|pronator|supinator|flexor carpi|extensor carpi|palmaris[a-z]*|flexor digitorum superficialis|flexor digitorum profundus|extensor digitorum(?! (?:longus|brevis))|extensor indicis|pollicis|thenar|hypothenar|opponens|palmar aponeurosis|palmar interossei|dorsal interossei of hand|lumbrical.*hand|bicipital|acromioclavicular|glenohumeral|coracoacromial|coracoclavicular|olecranon|subacromial|subdeltoid|cubital|annular ligament of radius|ulnar collateral|radial collateral|interosseous membrane of forearm|wrist|hand|forearm|antebrachial|brachial|finger(?! of foot)|thumb)\b/i;

const MUSCULAR_LOWER_LIMB_REGEX =
  /\b(quadricep[a-z]*|rectus femoris|vastus|sartorius|gracilis|pectineus|adductor longus|adductor brevis|adductor magnus|adductor minimus|adductor hallucis|iliopsoas|psoas|iliacus|iliopectineal|biceps femoris|semitendinosus|semimembranosus|popliteus|popliteal|gastrocnemius|soleus|triceps surae|surae|plantaris|tibialis|fibularis|peroneus|extensor digitorum longus|extensor digitorum brevis|flexor digitorum longus|flexor digitorum brevis|hallucis|of foot|plantar|iliotibial|patellar|suprapatellar|prepatellar|infrapatellar|calcane[a-z]*|achilles|crural|talar|tarsal[a-z]*|ankle|knee|iliofemoral|pubofemoral|ischiofemoral|cruciate|fibular collateral|tibial collateral|subtalar|obturator membrane|sacrotuberous|fibula|tibia|femoral)\b/i;

const MUSCULAR_POSTERIOR_TORSO_REGEX =
  /\b(trapezius|latissimus|rhomboid[a-z]*|levator scapulae|serratus posterior|erector spinae|iliocostalis|longissimus|spinalis|splenius|semispinalis|multifidus|rotatores|interspin[a-z]*|intertransvers[a-z]*|quadratus lumborum|gluteus|gluteal|tensor fasciae latae|piriformis|gemellus|obturator internus|obturator externus|quadratus femoris|levator ani|coccygeus|thoracolumbar|trochanteric bursa|sciatic bursa|sacrospinous|perineal|bulbospongiosus|ischiocavernosus|sphincter ani)\b/i;

const MUSCULAR_ANTERIOR_TORSO_REGEX =
  /\b(pectoralis|pectoral|clavipectoral|subclavius|serratus anterior|rectus abdominis|pyramidalis|external oblique|internal oblique|transversus abdominis|obliquus.*abdomin[a-z]*|linea alba|rectus sheath|tendinous intersection|inguinal|cremaster|intercostal|subcostal|transversus thoracis|levatores costarum|conjoint tendon)\b/i;

/**
 * Classifies any mesh (including muscles, white tendons, aponeuroses, ligaments,
 * small hand/foot bones, and multi-primitive organ pieces) into a cohesive rigid
 * Anatomical Macro-Unit so related structures move together as intact assemblies.
 */
export function resolveExplodeClusterId(
  rawHierarchyName: string,
  system: AnatomicalSystem,
  worldCenter: THREE.Vector3
): ExplodeClusterId {
  const text = normalizeText(rawHierarchyName);
  const lr = resolveLeftOrRight(rawHierarchyName, worldCenter);

  if (system === 'cardiovascular') {
    return 'cardiovascular_tree';
  }
  if (system === 'nervous') {
    return 'nervous_tree';
  }
  if (system === 'integumentary') {
    const ap = worldCenter.z >= 0 ? 'anterior' : 'posterior';
    return `integumentary_${lr}_${ap}` as ExplodeClusterId;
  }

  if (system === 'skeletal') {
    if (SKELETAL_LOWER_LIMB_REGEX.test(text)) {
      return `skeletal_lower_limb_${lr}`;
    }
    if (SKELETAL_UPPER_LIMB_REGEX.test(text)) {
      return `skeletal_upper_limb_${lr}`;
    }
    if (/\bphalang|phalanx\b/i.test(text)) {
      return worldCenter.y > 0.45 && Math.abs(worldCenter.x) > 0.14
        ? `skeletal_upper_limb_${lr}`
        : `skeletal_lower_limb_${lr}`;
    }
    if (SKELETAL_RIB_REGEX.test(text) && !/\bsternum|manubrium\b/i.test(text)) {
      return `skeletal_rib_${lr}`;
    }
    if (SKELETAL_AXIAL_REGEX.test(text)) {
      return 'skeletal_axial';
    }
    // Spatial fallback for generic skeletal bones/joints
    if (worldCenter.y < 0.72 && Math.abs(worldCenter.x) < 0.2) {
      return `skeletal_lower_limb_${lr}`;
    }
    if (
      worldCenter.y >= 0.52 &&
      worldCenter.y <= 1.48 &&
      Math.abs(worldCenter.x) > 0.22
    ) {
      return `skeletal_upper_limb_${lr}`;
    }
    return 'skeletal_axial';
  }

  if (system === 'visceral') {
    if (/\b(mammary|breast|nipple|areola|mamma)\b/i.test(text)) {
      return `visceral_mammary_${lr}`;
    }
    if (/\b(kidney|renal|ureter|suprarenal|adrenal)\b/i.test(text)) {
      return `visceral_kidneys_ureters_${lr}`;
    }
    if (
      /\b(lung|bronchus|bronchi|lingular|lobe of right lung|lobe of left lung|pleura)\b/i.test(
        text
      )
    ) {
      return `visceral_lung_${lr}`;
    }
    if (
      /\b(liver|segment of liver|gallbladder|bile duct|cystic duct|hepatic duct)\b/i.test(
        text
      )
    ) {
      return 'visceral_liver_gallbladder';
    }
    if (
      /\b(stomach|gastric|pylor|spleen|splenic|pancreas|pancreatic|lesser omentum)\b/i.test(
        text
      )
    ) {
      return 'visceral_stomach_spleen_pancreas';
    }
    if (
      /\b(duodenum|jejunum|ileum|small intestine|colon|caecum|cecum|appendix|taenia|mesocolon|meso appendix|rectum|anal|greater omentum|intestin)\b/i.test(
        text
      )
    ) {
      return 'visceral_intestines';
    }
    if (
      /\b(urinary bladder|bladder|urethra|uterus|uterine tube|fallopian|ovary|ovarian|vagina|prostate|seminal|testis|epididymis|ductus deferens|ejaculatory|penis|clitoris|perineum|broad ligament|round ligament of uterus)\b/i.test(
        text
      )
    ) {
      return 'visceral_pelvic_urogenital';
    }
    if (
      /\b(pharynx|nasopharynx|oropharynx|laryngopharynx|larynx|epiglottis|trachea|thyroid|parathyroid|oesophagus|esophagus|tongue|palate|uvula|gingiva|parotid|submandibular|sublingual|salivary|nasal|pineal|hypophysis|pituitary)\b/i.test(
        text
      )
    ) {
      return 'visceral_upper_airway';
    }
    // Spatial fallback for any unlabelled visceral mesh
    if (worldCenter.y >= 1.38) return 'visceral_upper_airway';
    if (worldCenter.y >= 1.12) return `visceral_lung_${lr}`;
    if (worldCenter.y >= 0.98) {
      return worldCenter.x < 0
        ? 'visceral_liver_gallbladder'
        : 'visceral_stomach_spleen_pancreas';
    }
    if (worldCenter.y >= 0.85) return 'visceral_intestines';
    return 'visceral_pelvic_urogenital';
  }

  // Muscular (bellies, tendons, tendon sheaths, aponeuroses, retinacula, bursae, joint capsules)
  if (/\bdiaphragm\b/i.test(text) && !/\bpelvic|urogenital\b/i.test(text)) {
    return 'skeletal_axial';
  }
  if (MUSCULAR_LOWER_LIMB_REGEX.test(text)) {
    return `muscular_lower_limb_${lr}`;
  }
  if (MUSCULAR_UPPER_LIMB_REGEX.test(text)) {
    return `muscular_upper_limb_${lr}`;
  }
  if (MUSCULAR_HEAD_NECK_REGEX.test(text)) {
    return `muscular_head_neck_${lr}`;
  }
  // Ambiguous hand/foot finger/toe flexors & extensors without explicit suffix: use height
  if (/\b(extensor digitorum|extensor digiti|abductor digiti|flexor digiti|lumbrical|interossei|flexor retinaculum|extensor retinaculum)\b/i.test(text)) {
    return worldCenter.y < 0.55
      ? `muscular_lower_limb_${lr}`
      : `muscular_upper_limb_${lr}`;
  }
  if (MUSCULAR_POSTERIOR_TORSO_REGEX.test(text)) {
    return `muscular_posterior_torso_${lr}`;
  }
  if (MUSCULAR_ANTERIOR_TORSO_REGEX.test(text)) {
    return `muscular_anterior_torso_${lr}`;
  }

  // Coordinate-based fallback for unlabeled or minor muscular structures
  if (worldCenter.y > 1.44) {
    return `muscular_head_neck_${lr}`;
  }
  if (worldCenter.y >= 0.56 && worldCenter.y <= 1.48 && Math.abs(worldCenter.x) > 0.19) {
    return `muscular_upper_limb_${lr}`;
  }
  if (worldCenter.y < 0.78) {
    return `muscular_lower_limb_${lr}`;
  }
  return worldCenter.z >= 0
    ? `muscular_anterior_torso_${lr}`
    : `muscular_posterior_torso_${lr}`;
}

const ZERO_OFFSET = new THREE.Vector3(0, 0, 0);

const CLUSTER_OFFSET_TABLE: Record<ExplodeClusterId, THREE.Vector3> = {
  skeletal_axial: new THREE.Vector3(0, 0, 0),
  skeletal_rib_left: new THREE.Vector3(0.12, 0, 0),
  skeletal_rib_right: new THREE.Vector3(-0.12, 0, 0),
  skeletal_upper_limb_left: new THREE.Vector3(0.14, 0, 0),
  skeletal_upper_limb_right: new THREE.Vector3(-0.14, 0, 0),
  skeletal_lower_limb_left: new THREE.Vector3(0.08, 0, 0),
  skeletal_lower_limb_right: new THREE.Vector3(-0.08, 0, 0),

  muscular_head_neck_left: new THREE.Vector3(0.12, 0.04, 0.06),
  muscular_head_neck_right: new THREE.Vector3(-0.12, 0.04, 0.06),
  muscular_anterior_torso_left: new THREE.Vector3(0.22, 0, 0.18),
  muscular_anterior_torso_right: new THREE.Vector3(-0.22, 0, 0.18),
  muscular_posterior_torso_left: new THREE.Vector3(0.22, 0, -0.18),
  muscular_posterior_torso_right: new THREE.Vector3(-0.22, 0, -0.18),
  muscular_upper_limb_left: new THREE.Vector3(0.32, 0, 0.05),
  muscular_upper_limb_right: new THREE.Vector3(-0.32, 0, 0.05),
  muscular_lower_limb_left: new THREE.Vector3(0.2, 0, 0.05),
  muscular_lower_limb_right: new THREE.Vector3(-0.2, 0, 0.05),

  visceral_upper_airway: new THREE.Vector3(0, 0.03, 0.16),
  visceral_lung_right: new THREE.Vector3(-0.16, 0, 0.16),
  visceral_lung_left: new THREE.Vector3(0.16, 0, 0.16),
  visceral_liver_gallbladder: new THREE.Vector3(-0.18, -0.02, 0.24),
  visceral_stomach_spleen_pancreas: new THREE.Vector3(0.18, -0.02, 0.24),
  visceral_intestines: new THREE.Vector3(0, -0.04, 0.28),
  visceral_kidneys_ureters_left: new THREE.Vector3(0.14, 0, -0.12),
  visceral_kidneys_ureters_right: new THREE.Vector3(-0.14, 0, -0.12),
  visceral_pelvic_urogenital: new THREE.Vector3(0, -0.05, 0.2),
  visceral_mammary_left: new THREE.Vector3(0.24, 0, 0.26),
  visceral_mammary_right: new THREE.Vector3(-0.24, 0, 0.26),

  cardiovascular_tree: new THREE.Vector3(-0.42, 0, 0.12),
  nervous_tree: new THREE.Vector3(0.42, 0, 0.12),

  integumentary_left_anterior: new THREE.Vector3(0.34, 0, 0.18),
  integumentary_right_anterior: new THREE.Vector3(-0.34, 0, 0.18),
  integumentary_left_posterior: new THREE.Vector3(0.34, 0, -0.18),
  integumentary_right_posterior: new THREE.Vector3(-0.34, 0, -0.18),
};

function isSoloSkeletalView(ctx?: ExplodeDisplayContext): boolean {
  if (!ctx) return false;
  if (ctx.activeAtlasPreset === 'zanatomy-skeletal') return true;
  const { skeletal, muscular, visceral, cardiovascular, nervous, integumentary } =
    ctx.activeSystems;
  return (
    skeletal &&
    !muscular &&
    !visceral &&
    !cardiovascular &&
    !nervous &&
    !integumentary
  );
}

function isSoloSystemView(
  system: 'cardiovascular' | 'nervous' | 'integumentary',
  ctx?: ExplodeDisplayContext
): boolean {
  if (!ctx) return false;
  if (system === 'cardiovascular' && ctx.activeAtlasPreset === 'zanatomy-cardiovascular') {
    return true;
  }
  if (system === 'nervous' && ctx.activeAtlasPreset === 'zanatomy-nervous') {
    return true;
  }
  if (system === 'integumentary' && ctx.activeAtlasPreset === 'zanatomy-integumentary') {
    return true;
  }
  const activeCount = Object.values(ctx.activeSystems).filter(Boolean).length;
  return activeCount === 1 && ctx.activeSystems[system];
}

/**
 * Returns the rigid world-space displacement vector (at `explodeFactor = 1.0`,
 * in meters) for the given anatomical macro-unit.
 */
export function getExplodeClusterWorldOffset(
  clusterId: ExplodeClusterId,
  ctx?: ExplodeDisplayContext
): THREE.Vector3 {
  if (clusterId === 'skeletal_rib_left' || clusterId === 'skeletal_rib_right') {
    return isSoloSkeletalView(ctx) ? CLUSTER_OFFSET_TABLE[clusterId] : ZERO_OFFSET;
  }
  if (clusterId === 'cardiovascular_tree' && isSoloSystemView('cardiovascular', ctx)) {
    return ZERO_OFFSET;
  }
  if (clusterId === 'nervous_tree' && isSoloSystemView('nervous', ctx)) {
    return ZERO_OFFSET;
  }
  if (
    clusterId.startsWith('integumentary_') &&
    isSoloSystemView('integumentary', ctx)
  ) {
    return ZERO_OFFSET;
  }
  return CLUSTER_OFFSET_TABLE[clusterId] ?? ZERO_OFFSET;
}

const _tempBaseLocal = new THREE.Vector3();
const _tempScaledWorldDelta = new THREE.Vector3();
const _tempWorldAtBase = new THREE.Vector3();
const _tempWorldTarget = new THREE.Vector3();

/**
 * Applies a world-space displacement (`worldDelta * explodeFactor`) onto `mesh.position`
 * accurately relative to `restPosition + baseLocalOffset` by transforming through
 * `mesh.parent.matrixWorld`. Strictly restores `restPosition + baseLocalOffset` when
 * `explodeFactor === 0`. Assumes ancestor world matrices are already updated once.
 */
export function applyRigidMacroExplodeOffset(
  mesh: THREE.Mesh,
  clusterId: ExplodeClusterId | undefined,
  explodeFactor: number,
  restPosition: THREE.Vector3,
  ctx?: ExplodeDisplayContext,
  baseLocalOffset?: THREE.Vector3
): void {
  _tempBaseLocal.copy(restPosition);
  if (baseLocalOffset) {
    _tempBaseLocal.add(baseLocalOffset);
  }

  if (explodeFactor <= 1e-5 || !clusterId) {
    mesh.position.copy(_tempBaseLocal);
    return;
  }

  const worldOffset = getExplodeClusterWorldOffset(clusterId, ctx);
  if (worldOffset.lengthSq() < 1e-10) {
    mesh.position.copy(_tempBaseLocal);
    return;
  }

  _tempScaledWorldDelta.copy(worldOffset).multiplyScalar(explodeFactor);

  if (mesh.parent) {
    _tempWorldAtBase
      .copy(_tempBaseLocal)
      .applyMatrix4(mesh.parent.matrixWorld);
    _tempWorldTarget.copy(_tempWorldAtBase).add(_tempScaledWorldDelta);
    mesh.parent.worldToLocal(_tempWorldTarget);
    mesh.position.copy(_tempWorldTarget);
  } else {
    mesh.position.copy(_tempBaseLocal).add(_tempScaledWorldDelta);
  }
}
