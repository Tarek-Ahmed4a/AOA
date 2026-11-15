import type {
  AnatomicalSystem,
  BiologicalSex,
  OfficialAtlasPresetId,
} from '../store/useAnatomyStore';

export interface ZAnatomyBundleMatch {
  preset: OfficialAtlasPresetId;
  system: AnatomicalSystem;
  isFullBody?: boolean;
}

export const ZANATOMY_PRESET_GLB_URL: Record<OfficialAtlasPresetId, string | null> = {
  'zanatomy-visceral': '/models/zanatomy/visceral.glb',
  'zanatomy-muscular': '/models/zanatomy/muscular.glb',
  'zanatomy-skeletal': '/models/zanatomy/skeletal.glb',
  'zanatomy-nervous': '/models/zanatomy/nervous.glb',
  'zanatomy-cardiovascular': '/models/zanatomy/cardiovascular.glb',
  'zanatomy-integumentary': '/models/zanatomy/integumentary.glb',
  'zanatomy-full-body': null,
  'nih-visible-human': null,
};

/**
 * Matches Z-Anatomy system bundle titles (`Splanchnology`, `Myology`, `Osteology`,
 * `Arthrology`, `Neurology`, `Angiology`, `Integumentary`, or `Full Body`) to
 * local Three.js GLB presets.
 */
export function matchZAnatomySystemBundle(
  title: string
): ZAnatomyBundleMatch | null {
  const lower = title.toLowerCase();
  if (/\b(?:splanchnolog|visceral\s+system|viscera\b|digestive\s+&?\s*respiratory)\b/i.test(lower)) {
    return { preset: 'zanatomy-visceral', system: 'visceral' };
  }
  if (/\b(?:myolog|muscular\s+system)\b/i.test(lower)) {
    return { preset: 'zanatomy-muscular', system: 'muscular' };
  }
  if (/\b(?:osteolog|arthrolog|skeletal\s+system|joints?\s*&?\s*ligaments?)\b/i.test(lower)) {
    return { preset: 'zanatomy-skeletal', system: 'skeletal' };
  }
  if (/\b(?:neurolog|nervous\s+system)\b/i.test(lower)) {
    return { preset: 'zanatomy-nervous', system: 'nervous' };
  }
  if (/\b(?:angiolog|cardiovascular\s+system|circulatory\s+system|vascular\s+system)\b/i.test(lower)) {
    return { preset: 'zanatomy-cardiovascular', system: 'cardiovascular' };
  }
  if (/\b(?:integument|integumentary\s+system|superficial\s+skin)\b/i.test(lower)) {
    return { preset: 'zanatomy-integumentary', system: 'integumentary' };
  }
  if (/\b(?:full\s+body|complete\s+human\s+anatomy|human\s+anatomy\s+atlas)\b/i.test(lower)) {
    return {
      preset: 'zanatomy-full-body',
      system: 'visceral',
      isFullBody: true,
    };
  }
  return null;
}

/**
 * Resolves any Explorer card whose remote `.glb` download token fails or is absent
 * to the highest-precision matching local `.glb` specimen in `/models/nih/` or `/models/zanatomy/`.
 */
export function resolveLocalFallbackGlb(
  title: string,
  system: AnatomicalSystem,
  sex?: BiologicalSex
): { glbUrl: string; system: AnatomicalSystem } {
  const lower = title.toLowerCase();
  const resolvedSex: BiologicalSex =
    /\b(?:female|woman|uterus|ovar|fallopian|mammary)\b/i.test(lower)
      ? 'female'
      : (sex ?? 'male');
  const isFemale = resolvedSex === 'female';

  if (
    /\b(?:skull|crani|mandib|maxilla|ethmoid|sphenoid|temporal|frontal|parietal|occipital|hyoid|calvaria|orbit|zygoma|suture|tooth|teeth|jaw)\b/i.test(
      lower
    )
  ) {
    return { glbUrl: '/models/zanatomy/skeletal.glb', system: 'skeletal' };
  }
  if (
    /\b(?:spine|vertebr|sacrum|coccyx|atlas|axis|thorax|rib|sternum|manubrium|clavicle|scapula|humerus|radius|ulna|carpal|hand|femur|tibia|fibula|patella|tarsal|foot)\b/i.test(
      lower
    )
  ) {
    return { glbUrl: '/models/zanatomy/skeletal.glb', system: 'skeletal' };
  }
  if (/\b(?:pelvis|pelvic|iliac|ischium|pubis|hip\s*bone)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/pelvis-female.glb'
        : '/models/nih/male/pelvis-male.glb',
      system: 'skeletal',
    };
  }
  if (/\b(?:knee|menisc|cruciate)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/knee-female-left.glb'
        : '/models/nih/male/knee-male-left.glb',
      system: 'skeletal',
    };
  }
  if (
    /\b(?:brain|cerebr|cerebell|encephal|cortex|gyr|sulc|ventricle|hippocamp|thalam|brainstem|pons|medulla)\b/i.test(
      lower
    )
  ) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/brain-female.glb'
        : '/models/nih/male/brain-male.glb',
      system: 'nervous',
    };
  }
  if (/\bspinal\s*cord\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/spinal-cord-female.glb'
        : '/models/nih/male/spinal-cord-male.glb',
      system: 'nervous',
    };
  }
  if (
    /\b(?:heart|cardiac|myocardi|pericardi|coronary|atrium|mitral|tricuspid|aortic\s*valve)\b/i.test(
      lower
    )
  ) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/heart-female.glb'
        : '/models/nih/male/heart-male.glb',
      system: 'cardiovascular',
    };
  }
  if (
    /\b(?:aort|arter|vein|vena|vascul|angiolog|blood\s*vessel)\b/i.test(lower)
  ) {
    return {
      glbUrl: '/models/zanatomy/cardiovascular.glb',
      system: 'cardiovascular',
    };
  }
  if (/\b(?:lung|pulmon|bronch|pleura)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/lung-female.glb'
        : '/models/nih/male/lung-male.glb',
      system: 'visceral',
    };
  }
  if (/\btrachea\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/trachea-female.glb'
        : '/models/nih/male/trachea-male.glb',
      system: 'visceral',
    };
  }
  if (
    /\b(?:larynx|epiglottis|thyroid\s*cartilage|cricoid|vocal)\b/i.test(lower)
  ) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/larynx-female.glb'
        : '/models/nih/male/larynx-male.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:liver|hepat|gallbladder|biliary)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/liver-female.glb'
        : '/models/nih/male/liver-male.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:kidney|renal|nephr)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/kidney-female-left.glb'
        : '/models/nih/male/kidney-male-left.glb',
      system: 'visceral',
    };
  }
  if (/\bureter\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/ureter-female-left.glb'
        : '/models/nih/male/ureter-male-left.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:bladder|vesic)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/urinary-bladder-female.glb'
        : '/models/nih/male/urinary-bladder-male.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:uterus|womb|endometri|cervix)\b/i.test(lower)) {
    return {
      glbUrl: '/models/nih/female/uterus-female.glb',
      system: 'visceral',
    };
  }
  if (/\bovar/i.test(lower)) {
    return {
      glbUrl: '/models/nih/female/ovary-female-left.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:fallopian|uterine\s*tube|salpinx)\b/i.test(lower)) {
    return {
      glbUrl: '/models/nih/female/fallopian-tube-female-left.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:mammary|breast)\b/i.test(lower)) {
    return {
      glbUrl: '/models/nih/female/mammary-gland-female-left.glb',
      system: 'visceral',
    };
  }
  if (/\bprostate\b/i.test(lower)) {
    return {
      glbUrl: '/models/nih/male/prostate-male.glb',
      system: 'visceral',
    };
  }
  if (/\bpancreas\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/pancreas-female.glb'
        : '/models/nih/male/pancreas-male.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:spleen|splenic)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/spleen-female.glb'
        : '/models/nih/male/spleen-male.glb',
      system: 'visceral',
    };
  }
  if (/\b(?:colon|large\s*intestine|cecum|appendix|rectum)\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/large-intestine-female.glb'
        : '/models/nih/male/large-intestine-male.glb',
      system: 'visceral',
    };
  }
  if (
    /\b(?:small\s*intestine|duodenum|jejunum|ileum|stomach|gastric)\b/i.test(
      lower
    )
  ) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/small-intestine-female.glb'
        : '/models/nih/male/small-intestine-male.glb',
      system: 'visceral',
    };
  }
  if (/\bthymus\b/i.test(lower)) {
    return {
      glbUrl: isFemale
        ? '/models/nih/female/thymus-female.glb'
        : '/models/nih/male/thymus-male.glb',
      system: 'visceral',
    };
  }

  return {
    glbUrl:
      ZANATOMY_PRESET_GLB_URL[`zanatomy-${system}` as OfficialAtlasPresetId] ??
      '/models/zanatomy/visceral.glb',
    system,
  };
}

export interface SketchfabRawNode {
  instanceID?: number;
  name?: string;
  type?: string;
  children?: SketchfabRawNode[];
  localMatrix?: number[];
  worldMatrix?: number[];
}

export interface SketchfabOpacityChannel {
  enable?: boolean;
  factor?: number;
  type?: string;
  texture?: unknown;
  [key: string]: unknown;
}

export interface SketchfabMaterialEntry {
  id: string;
  name?: string;
  channels: {
    Opacity?: SketchfabOpacityChannel;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SketchfabAnnotationEntry {
  name?: string;
  content?: { rendered?: string; raw?: string } | string;
}

export interface SketchfabViewerApi {
  start: () => void;
  setBackground: (
    options: { color?: [number, number, number, number] },
    callback?: () => void
  ) => void;
  getNodeMap: (
    callback: (err: unknown, nodes: Record<string, SketchfabRawNode>) => void
  ) => void;
  addEventListener: (
    event: string,
    callback: (info?: unknown) => void,
    options?: Record<string, unknown>
  ) => void;
  hide?: (instanceID: number, callback?: (err?: unknown) => void) => void;
  show?: (instanceID: number, callback?: (err?: unknown) => void) => void;
  getMaterialList?: (
    callback: (err: unknown, materials: SketchfabMaterialEntry[]) => void
  ) => void;
  setMaterial?: (
    material: SketchfabMaterialEntry,
    callback?: (err?: unknown) => void
  ) => void;
  translate?: (
    instanceID: number,
    translateTo: [number, number, number],
    options?: { duration?: number; easing?: string },
    callback?: (err?: unknown, translateTo?: [number, number, number]) => void
  ) => void;
  recenterCamera?: (callback?: (err?: unknown) => void) => void;
  getAnnotationList?: (
    callback: (err: unknown, annotations: SketchfabAnnotationEntry[]) => void
  ) => void;
  showAnnotation?: (
    index: number,
    callback?: (err?: unknown) => void
  ) => void;
  hideAnnotation?: (
    index: number,
    callback?: (err?: unknown) => void
  ) => void;
  showAnnotationTooltips?: (callback?: (err?: unknown) => void) => void;
  hideAnnotationTooltips?: (callback?: (err?: unknown) => void) => void;
}

export interface CloudMovableNode {
  instanceID: number;
  restLocal: [number, number, number];
  explodeDir: [number, number, number];
}

export interface CloudNodeIndex {
  nameByInstanceId: Map<number, string>;
  parentByInstanceId: Map<number, number>;
  childrenByInstanceId: Map<number, number[]>;
  allHideableIds: number[];
  sliceOrderedIds: number[];
  movableNodes: CloudMovableNode[];
}

function readMatrixTranslation(mat?: number[]): [number, number, number] {
  if (!mat || mat.length < 15) return [0, 0, 0];
  return [mat[12] || 0, mat[13] || 0, mat[14] || 0];
}

export function buildCloudNodeIndex(
  nodes: Record<string, SketchfabRawNode>
): CloudNodeIndex {
  const nameByInstanceId = new Map<number, string>();
  const parentByInstanceId = new Map<number, number>();
  const childrenByInstanceId = new Map<number, number[]>();
  const nodeById = new Map<number, SketchfabRawNode>();

  for (const node of Object.values(nodes)) {
    if (typeof node.instanceID !== 'number') continue;
    nodeById.set(node.instanceID, node);
    if (node.name && !/^(rootnode|scene|sketchfab)/i.test(node.name)) {
      nameByInstanceId.set(node.instanceID, node.name);
    }
    const childIds: number[] = [];
    for (const ch of node.children ?? []) {
      if (typeof ch.instanceID === 'number') {
        childIds.push(ch.instanceID);
        parentByInstanceId.set(ch.instanceID, node.instanceID);
      }
    }
    childrenByInstanceId.set(node.instanceID, childIds);
  }

  const allHideableIds: number[] = [];
  const sliceEntries: Array<{ id: number; score: number }> = [];
  const movableCandidates: Array<{
    instanceID: number;
    restLocal: [number, number, number];
    worldPos: [number, number, number];
  }> = [];

  for (const [id, node] of nodeById.entries()) {
    const type = (node.type || '').toLowerCase();
    const childCount = (childrenByInstanceId.get(id) || []).length;
    const isLeafGeometry = type === 'geometry' || (childCount === 0 && nameByInstanceId.has(id));
    if (isLeafGeometry) {
      allHideableIds.push(id);
      const wp = readMatrixTranslation(node.worldMatrix);
      sliceEntries.push({
        id,
        score: wp[2] * 1.15 + wp[1] * 0.45 + Math.abs(wp[0]) * 0.15,
      });
    }

    if (
      (type === 'matrixtransform' || type === 'group') &&
      node.name &&
      !/^(rootnode|scene|sketchfab|camera|light)/i.test(node.name) &&
      movableCandidates.length < 72
    ) {
      movableCandidates.push({
        instanceID: id,
        restLocal: readMatrixTranslation(node.localMatrix),
        worldPos: readMatrixTranslation(node.worldMatrix),
      });
    }
  }

  sliceEntries.sort((a, b) => b.score - a.score);
  const sliceOrderedIds = sliceEntries.map((e) => e.id);

  // Compute radial explode directions around model centroid (with spherical fallback)
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const m of movableCandidates) {
    cx += m.worldPos[0];
    cy += m.worldPos[1];
    cz += m.worldPos[2];
  }
  const n = Math.max(movableCandidates.length, 1);
  cx /= n;
  cy /= n;
  cz /= n;

  let maxSpan = 0.001;
  for (const m of movableCandidates) {
    const dx = m.worldPos[0] - cx;
    const dy = m.worldPos[1] - cy;
    const dz = m.worldPos[2] - cz;
    maxSpan = Math.max(maxSpan, Math.hypot(dx, dy, dz));
  }
  const explodeAmp = Math.max(maxSpan * 0.38, 0.22);

  const movableNodes: CloudMovableNode[] = movableCandidates.map((m, idx) => {
    const dx = m.worldPos[0] - cx;
    const dy = m.worldPos[1] - cy;
    const dz = m.worldPos[2] - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-4) {
      return {
        instanceID: m.instanceID,
        restLocal: m.restLocal,
        explodeDir: [
          (dx / len) * explodeAmp,
          (dy / len) * explodeAmp,
          (dz / len) * explodeAmp,
        ],
      };
    }
    const angle = idx * 2.3999632;
    const elev = ((idx % 5) - 2) * 0.25;
    return {
      instanceID: m.instanceID,
      restLocal: m.restLocal,
      explodeDir: [
        Math.cos(angle) * explodeAmp * 0.7,
        elev * explodeAmp * 0.6,
        Math.sin(angle) * explodeAmp * 0.7,
      ],
    };
  });

  return {
    nameByInstanceId,
    parentByInstanceId,
    childrenByInstanceId,
    allHideableIds,
    sliceOrderedIds,
    movableNodes,
  };
}

/**
 * Computes all hideable instance IDs outside `targetInstanceId`'s ancestor/descendant lineage
 * so Sketchfab Viewer `Isolate` keeps the clicked organ subtree visible.
 */
export function collectIsolationHideIds(
  targetInstanceId: number,
  index: CloudNodeIndex
): number[] {
  const keepSet = new Set<number>([targetInstanceId]);

  let cursor = index.parentByInstanceId.get(targetInstanceId);
  while (cursor !== undefined) {
    keepSet.add(cursor);
    cursor = index.parentByInstanceId.get(cursor);
  }

  const stack = [...(index.childrenByInstanceId.get(targetInstanceId) ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (keepSet.has(cur)) continue;
    keepSet.add(cur);
    for (const ch of index.childrenByInstanceId.get(cur) ?? []) {
      stack.push(ch);
    }
  }

  return index.allHideableIds.filter((id) => !keepSet.has(id));
}
