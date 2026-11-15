import * as THREE from 'three';
import type { AnatomicalSystem, BiologicalSex } from '../store/useAnatomyStore';
import { resolveAssetUrl } from '../utils/assetUrl';

export const NIH_HRA_REFERENCE_ORGANS_API =
  'https://apps.humanatlas.io/api/v1/reference-organs';
export const NIH_HRA_SCENE_API = 'https://apps.humanatlas.io/api/v1/scene';
export const NIH_HRA_CDN_BASE =
  'https://cdn.humanatlas.io/digital-objects/ref-organ/';
export const NIH_LOCAL_MANIFEST_URL = '/models/nih/manifest.json';

export interface NihPlacementTransform {
  translation: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface NihOrganSceneItem {
  id: string;
  organKey: string;
  name: string;
  sex: BiologicalSex;
  side: 'Left' | 'Right' | 'Unpaired';
  system: AnatomicalSystem;
  ontologyId: string;
  ta98Code: string;
  remoteUrl: string;
  localPath: string;
  activeUrl: string;
  downloadedLocally: boolean;
  placement: NihPlacementTransform;
  subNode?: string;
  dimensionsMm?: [number, number, number];
  transformMatrix?: number[];
  defaultOpacity?: number;
}

export interface NihBodyNormalizationTransform {
  position: [number, number, number];
  scale: [number, number, number];
}

interface RawHraPlacement {
  x_translation?: number;
  y_translation?: number;
  z_translation?: number;
  x_rotation?: number;
  y_rotation?: number;
  z_rotation?: number;
  x_scaling?: number;
  y_scaling?: number;
  z_scaling?: number;
  translation_units?: string;
  dimension_units?: string;
  translation?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

interface RawHraReferenceOrgan {
  '@id'?: string;
  id?: string;
  label?: string;
  name?: string;
  organ?: string;
  sex?: string;
  organ_owner_sex?: string;
  side?: string;
  representation_of?: string;
  reference_organ?: string;
  dimension_units?: string;
  x_dimension?: number;
  y_dimension?: number;
  z_dimension?: number;
  glbObject?: {
    file?: string;
    file_subpath?: string;
    placement?: RawHraPlacement;
  };
  object?: {
    file?: string;
    file_subpath?: string;
    placement?: RawHraPlacement;
  };
  placement?: RawHraPlacement;
}

interface RawHraSceneNode {
  '@id'?: string;
  reference_organ?: string;
  representation_of?: string;
  tooltip?: string;
  label?: string;
  sex?: string;
  scenegraph?: string;
  scenegraphNode?: string;
  transformMatrix?: number[];
  color?: [number, number, number, number];
  opacity?: number;
}

interface LocalManifestOrganRecord {
  id: string;
  organKey?: string;
  name?: string;
  sex?: BiologicalSex;
  side?: 'Left' | 'Right' | 'Unpaired';
  system?: AnatomicalSystem;
  ontologyId?: string;
  ta98Code?: string;
  remoteUrl?: string;
  localPath?: string;
  downloaded?: boolean;
  placement?: NihPlacementTransform;
}

interface LocalManifestPayload {
  male?: LocalManifestOrganRecord[];
  female?: LocalManifestOrganRecord[];
}

// Pre-measured exact bounds from Visible Human Male & Female skin GLBs
const DEFAULT_SKIN_BOUNDS_BY_SEX: Record<BiologicalSex, THREE.Box3> = {
  male: new THREE.Box3(
    new THREE.Vector3(-0.524, -0.913, -0.168),
    new THREE.Vector3(0.519, 0.911, 0.158)
  ),
  female: new THREE.Box3(
    new THREE.Vector3(-0.487, -0.793, -0.219),
    new THREE.Vector3(0.475, 0.865, 0.108)
  ),
};

const WHOLE_BODY_MACRO_MATCHERS: Array<{
  key: string;
  system: AnatomicalSystem;
  ta98Code: string;
  regex: RegExp;
  sexOnly?: BiologicalSex;
  localOnly?: boolean;
}> = [
  { key: 'skin', system: 'integumentary', ta98Code: 'A16.0.00.001', regex: /^skin$/i },
  { key: 'adipose', system: 'integumentary', ta98Code: 'A04.0.00.004', regex: /^adipose$/i },
  { key: 'pelvis', system: 'skeletal', ta98Code: 'A02.5.02.001', regex: /^pelvis$/i },
  { key: 'knee', system: 'skeletal', ta98Code: 'A03.6.08.001', regex: /^(?:left |right )?knee$/i },
  { key: 'sternum', system: 'skeletal', ta98Code: 'A02.3.03.001', regex: /^sternum$/i },
  { key: 'manubrium', system: 'skeletal', ta98Code: 'A02.3.03.002', regex: /^manubrium$/i },
  { key: 'intervertebral disk', system: 'skeletal', ta98Code: 'A03.2.02.003', regex: /^intervertebral[\s_-]?disk$/i },
  { key: 'brain', system: 'nervous', ta98Code: 'A14.1.03.001', regex: /^brain$/i },
  { key: 'spinal cord', system: 'nervous', ta98Code: 'A14.1.02.001', regex: /^spinal[\s_-]?cord$/i },
  { key: 'eye', system: 'nervous', ta98Code: 'A15.2.00.001', regex: /^(?:left |right )?eye$/i },
  { key: 'heart', system: 'cardiovascular', ta98Code: 'A12.1.00.001', regex: /^heart$/i },
  { key: 'blood vasculature', system: 'cardiovascular', ta98Code: 'A12.0.00.001', regex: /^blood[\s_-]?vasculature$/i },
  { key: 'lymph node', system: 'cardiovascular', ta98Code: 'A13.0.00.001', regex: /^lymph[\s_-]?node$/i },
  { key: 'mouth', system: 'visceral', ta98Code: 'A05.1.00.001', regex: /^mouth$/i },
  { key: 'larynx', system: 'visceral', ta98Code: 'A06.2.01.001', regex: /^larynx$/i },
  { key: 'trachea', system: 'visceral', ta98Code: 'A06.3.01.001', regex: /^trachea$/i },
  { key: 'main bronchus', system: 'visceral', ta98Code: 'A06.4.01.001', regex: /^main[\s_-]?bronchus$/i },
  { key: 'lung', system: 'visceral', ta98Code: 'A06.5.01.001', regex: /^(?:left |right )?lungs?$/i },
  { key: 'thymus', system: 'visceral', ta98Code: 'A13.1.01.001', regex: /^thymus$/i },
  { key: 'palatine tonsil', system: 'visceral', ta98Code: 'A05.2.01.011', regex: /^(?:left |right )?palatine[\s_-]?tonsil$/i },
  { key: 'liver', system: 'visceral', ta98Code: 'A05.8.01.001', regex: /^liver$/i },
  { key: 'spleen', system: 'visceral', ta98Code: 'A13.2.01.001', regex: /^spleen$/i },
  { key: 'pancreas', system: 'visceral', ta98Code: 'A05.9.01.001', regex: /^pancreas$/i },
  { key: 'small intestine', system: 'visceral', ta98Code: 'A05.6.01.001', regex: /^small[\s_-]?intestine$/i },
  { key: 'large intestine', system: 'visceral', ta98Code: 'A05.7.01.001', regex: /^large[\s_-]?intestine$/i },
  { key: 'omentum', system: 'visceral', ta98Code: 'A10.1.02.202', regex: /^omentum$/i },
  {
    key: 'epiploic appendage',
    system: 'visceral',
    ta98Code: 'A05.7.03.009',
    regex: /^epiploic[\s_-]?appendage/i,
  },
  { key: 'kidney', system: 'visceral', ta98Code: 'A08.1.01.001', regex: /^(?:left |right )?kidneys?$/i },
  { key: 'renal pelvis', system: 'visceral', ta98Code: 'A08.1.05.001', regex: /^(?:left |right )?renal[\s_-]?pelvis$/i },
  { key: 'ureter', system: 'visceral', ta98Code: 'A08.2.01.001', regex: /^(?:left |right )?ureter$/i },
  { key: 'urinary bladder', system: 'visceral', ta98Code: 'A08.3.01.001', regex: /^urinary[\s_-]?bladder$/i },
  { key: 'prostate', system: 'visceral', ta98Code: 'A09.3.08.001', regex: /^prostate$/i, sexOnly: 'male' },
  { key: 'uterus', system: 'visceral', ta98Code: 'A09.1.03.001', regex: /^uterus$/i, sexOnly: 'female' },
  { key: 'ovary', system: 'visceral', ta98Code: 'A09.1.01.001', regex: /^(?:left |right )?ovary$/i, sexOnly: 'female' },
  { key: 'fallopian tube', system: 'visceral', ta98Code: 'A09.1.02.001', regex: /^(?:left |right )?fallopian[\s_-]?tube$/i, sexOnly: 'female' },
  { key: 'mammary gland', system: 'visceral', ta98Code: 'A16.0.02.001', regex: /^(?:left |right )?mammary[\s_-]?gland$/i, sexOnly: 'female' },
  { key: 'placenta full term', system: 'visceral', ta98Code: 'A09.1.03.001', regex: /^placenta(?:\s+full[\s_-]?term)?$/i, sexOnly: 'female' },
];

function isDonorTissueBlockOrNoise(node: RawHraSceneNode | { id?: string; label?: string }): boolean {
  const rec = node as RawHraSceneNode;
  if ('@type' in rec && !rec.scenegraph) return true;
  const text = `${rec['@id'] ?? ''} ${rec.label ?? ''} ${(node as { id?: string }).id ?? ''}`.trim();
  return /\b(tissue[-_\s]?block|extraction[-_\s]?site)\b/i.test(text);
}

// Emergency direct CDN list matching official NIH HRA digital-objects URLs if API + manifest both fail
const EMERGENCY_CDN_ORGANS: Array<{
  id: string;
  label: string;
  sex: BiologicalSex;
  ontologyId: string;
  remoteUrl: string;
}> = [
  { id: 'skin-male', label: 'skin', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002097', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/skin-male/v1.4/assets/3d-vh-m-skin.glb' },
  { id: 'skin-female', label: 'skin', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002097', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/skin-female/v1.5/assets/3d-vh-f-skin.glb' },
  { id: 'brain-male', label: 'brain', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000955', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/brain-male/v1.4/assets/3d-allen-m-brain.glb' },
  { id: 'brain-female', label: 'brain', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000955', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/brain-female/v1.4/assets/3d-allen-f-brain.glb' },
  { id: 'heart-male', label: 'heart', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000948', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/heart-male/v1.3/assets/3d-vh-m-heart.glb' },
  { id: 'heart-female', label: 'heart', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000948', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/3d-vh-f-heart.glb' },
  { id: 'blood-vasculature-male', label: 'blood vasculature', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004537', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/blood-vasculature-male/v1.3/assets/3d-vh-m-blood-vasculature.glb' },
  { id: 'blood-vasculature-female', label: 'blood vasculature', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004537', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/blood-vasculature-female/v1.3/assets/3d-vh-f-blood-vasculature.glb' },
  { id: 'lung-male', label: 'lung', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002048', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-male/v1.4/assets/3d-vh-m-lung.glb' },
  { id: 'lung-female', label: 'lung', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002048', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/assets/3d-vh-f-lung.glb' },
  { id: 'liver-male', label: 'liver', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002107', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/liver-male/v1.2/assets/3d-vh-m-liver.glb' },
  { id: 'liver-female', label: 'liver', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002107', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/liver-female/v1.2/assets/3d-vh-f-liver.glb' },
  { id: 'pelvis-male', label: 'pelvis', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001270', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/pelvis-male/v1.3/assets/3d-vh-m-pelvis.glb' },
  { id: 'pelvis-female', label: 'pelvis', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001270', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/pelvis-female/v1.3/assets/3d-vh-f-pelvis.glb' },
  { id: 'kidney-male-left', label: 'Left kidney', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004538', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/kidney-male-left/v1.3/assets/3d-vh-m-kidney-l.glb' },
  { id: 'kidney-male-right', label: 'Right kidney', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004539', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/kidney-male-right/v1.3/assets/3d-vh-m-kidney-r.glb' },
  { id: 'kidney-female-left', label: 'Left kidney', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004538', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/kidney-female-left/v1.3/assets/3d-vh-f-kidney-l.glb' },
  { id: 'kidney-female-right', label: 'Right kidney', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0004539', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/kidney-female-right/v1.3/assets/3d-vh-f-kidney-r.glb' },
  { id: 'spinal-cord-male', label: 'spinal cord', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002240', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/spinal-cord-male/v1.1/assets/3d-vh-m-spinal-cord.glb' },
  { id: 'spinal-cord-female', label: 'spinal cord', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002240', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/spinal-cord-female/v1.1/assets/3d-vh-f-spinal-cord.glb' },
  { id: 'spleen-male', label: 'spleen', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002106', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/spleen-male/v1.3/assets/3d-vh-m-spleen.glb' },
  { id: 'spleen-female', label: 'spleen', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002106', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/spleen-female/v1.3/assets/3d-vh-f-spleen.glb' },
  { id: 'pancreas-male', label: 'pancreas', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001264', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/pancreas-male/v1.3/assets/3d-vh-m-pancreas.glb' },
  { id: 'pancreas-female', label: 'pancreas', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001264', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/pancreas-female/v1.3/assets/3d-vh-f-pancreas.glb' },
  { id: 'small-intestine-male', label: 'small intestine', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002108', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/small-intestine-male/v1.2/assets/3d-vh-m-small-intestine.glb' },
  { id: 'small-intestine-female', label: 'small intestine', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0002108', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/small-intestine-female/v1.2/assets/3d-vh-f-small-intestine.glb' },
  { id: 'urinary-bladder-male', label: 'urinary bladder', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001255', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/urinary-bladder-male/v1.2/assets/3d-vh-m-urinary-bladder.glb' },
  { id: 'urinary-bladder-female', label: 'urinary bladder', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0001255', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/urinary-bladder-female/v1.2/assets/3d-vh-f-urinary-bladder.glb' },
  { id: 'prostate-male', label: 'prostate', sex: 'male', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000079', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/prostate-male/v1.2/assets/3d-vh-m-prostate.glb' },
  { id: 'uterus-female', label: 'uterus', sex: 'female', ontologyId: 'http://purl.obolibrary.org/obo/UBERON_0000995', remoteUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/uterus-female/v1.2/assets/3d-vh-f-uterus.glb' },
];

export function resolveNihOrganSystem(label: string): AnatomicalSystem {
  const clean = label.trim().toLowerCase();
  if (/skin|adipose/.test(clean)) return 'integumentary';
  if (/pelvis|knee|sternum|manubrium|intervertebral/.test(clean)) {
    return 'skeletal';
  }
  if (/brain|spinal\s*cord|eye/.test(clean)) return 'nervous';
  if (/heart|blood\s*vasculature|lymph[-_\s]?node/.test(clean)) {
    return 'cardiovascular';
  }
  return 'visceral';
}

function resolveOrganSex(
  item: RawHraReferenceOrgan,
  glbUrl: string
): BiologicalSex | null {
  const rep = String(item.representation_of ?? '').toLowerCase();
  const ownerSex = String(item.organ_owner_sex ?? item.sex ?? '').toLowerCase();
  const iri = String(item['@id'] ?? item.reference_organ ?? '').toLowerCase();
  const fileLower = glbUrl.toLowerCase();

  if (
    rep.includes('#vhm') ||
    ownerSex === 'male' ||
    /vh_m_|-vh-m-|-allen-m-|-sbu-m-|-nih-m-/.test(fileLower) ||
    iri.includes('-male')
  ) {
    return 'male';
  }
  if (
    rep.includes('#vhf') ||
    ownerSex === 'female' ||
    /vh_f_|-vh-f-|-allen-f-|-sbu-f-|-nih-f-/.test(fileLower) ||
    iri.includes('-female')
  ) {
    return 'female';
  }
  return null;
}

function extractOrganSlug(
  item: RawHraReferenceOrgan,
  label: string,
  sex: BiologicalSex
): string {
  const iri = String(item['@id'] ?? item.reference_organ ?? '');
  const refPart = iri.split('/ref-organ/')[1];
  if (refPart) {
    return refPart
      .split('/')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-');
  }
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sex}`;
}

function parseHraPlacement(item: RawHraReferenceOrgan): NihPlacementTransform {
  const placement =
    item.placement ?? item.glbObject?.placement ?? item.object?.placement;
  if (!placement) {
    return {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
  }

  const unitFactor =
    placement.translation_units === 'millimeter' ||
    placement.dimension_units === 'millimeter'
      ? 0.001
      : 1;

  const tx = Array.isArray(placement.translation)
    ? Number(placement.translation[0]) || 0
    : (Number(placement.x_translation) || 0) * unitFactor;
  const ty = Array.isArray(placement.translation)
    ? Number(placement.translation[1]) || 0
    : (Number(placement.y_translation) || 0) * unitFactor;
  const tz = Array.isArray(placement.translation)
    ? Number(placement.translation[2]) || 0
    : (Number(placement.z_translation) || 0) * unitFactor;

  const rx = Array.isArray(placement.rotation)
    ? Number(placement.rotation[0]) || 0
    : THREE.MathUtils.degToRad(Number(placement.x_rotation) || 0);
  const ry = Array.isArray(placement.rotation)
    ? Number(placement.rotation[1]) || 0
    : THREE.MathUtils.degToRad(Number(placement.y_rotation) || 0);
  const rz = Array.isArray(placement.rotation)
    ? Number(placement.rotation[2]) || 0
    : THREE.MathUtils.degToRad(Number(placement.z_rotation) || 0);

  const sx = Array.isArray(placement.scale)
    ? Number(placement.scale[0]) || 1
    : Number(placement.x_scaling) || 1;
  const sy = Array.isArray(placement.scale)
    ? Number(placement.scale[1]) || 1
    : Number(placement.y_scaling) || 1;
  const sz = Array.isArray(placement.scale)
    ? Number(placement.scale[2]) || 1
    : Number(placement.z_scaling) || 1;

  return {
    translation: [tx, ty, tz],
    rotation: [rx, ry, rz],
    scale: [sx, sy, sz],
  };
}

function inferSideFromLabel(label: string): 'Left' | 'Right' | 'Unpaired' {
  if (/^left\b|_L\b|-l\.glb/i.test(label)) return 'Left';
  if (/^right\b|_R\b|-r\.glb/i.test(label)) return 'Right';
  return 'Unpaired';
}

function decomposeTransformMatrix(matrix16?: number[]): NihPlacementTransform | null {
  if (!Array.isArray(matrix16) || matrix16.length !== 16) return null;
  const mat = new THREE.Matrix4().fromArray(matrix16);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  mat.decompose(pos, quat, scl);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return {
    translation: [pos.x, pos.y, pos.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: [scl.x, scl.y, scl.z],
  };
}

/**
 * Computes master root group transform from the Skin bounding box so the
 * complete assembled NIH body stands centered on X/Z inside the [0.02m - 1.75m] frustum.
 */
export function computeBodyNormalizationTransform(
  skinBox: THREE.Box3 | null,
  sex: BiologicalSex
): NihBodyNormalizationTransform {
  const refBox =
    skinBox && !skinBox.isEmpty() ? skinBox : DEFAULT_SKIN_BOUNDS_BY_SEX[sex];
  const height = Math.max(refBox.max.y - refBox.min.y, 0.25);
  const targetHeight = 1.73; // 0.02m floor to 1.75m apex
  const floorY = 0.02;
  const scaleFactor = targetHeight / height;
  const centerX = (refBox.min.x + refBox.max.x) * 0.5;
  const centerZ = (refBox.min.z + refBox.max.z) * 0.5;

  return {
    position: [
      -centerX * scaleFactor,
      floorY - refBox.min.y * scaleFactor,
      -centerZ * scaleFactor,
    ],
    scale: [scaleFactor, scaleFactor, scaleFactor],
  };
}

function buildManifestLookup(
  manifest: LocalManifestPayload | null
): Map<string, LocalManifestOrganRecord> {
  const lookup = new Map<string, LocalManifestOrganRecord>();
  if (!manifest) return lookup;

  for (const list of [manifest.male ?? [], manifest.female ?? []]) {
    for (const rec of list) {
      if (rec?.id) {
        lookup.set(rec.id, rec);
      }
    }
  }
  return lookup;
}

export async function fetchNihSceneOrgans(): Promise<
  Record<BiologicalSex, NihOrganSceneItem[]>
> {
  const [manifestResult, refOrgansResult, maleSceneResult, femaleSceneResult] =
    await Promise.allSettled([
      fetch(resolveAssetUrl(NIH_LOCAL_MANIFEST_URL)).then((r) =>
        r.ok ? (r.json() as Promise<LocalManifestPayload>) : null
      ),
      fetch(NIH_HRA_REFERENCE_ORGANS_API, {
        headers: { Accept: 'application/json' },
      }).then((r) =>
        r.ok ? (r.json() as Promise<RawHraReferenceOrgan[]>) : null
      ),
      fetch(`${NIH_HRA_SCENE_API}?sex=male`, {
        headers: { Accept: 'application/json' },
      }).then((r) => (r.ok ? (r.json() as Promise<RawHraSceneNode[]>) : null)),
      fetch(`${NIH_HRA_SCENE_API}?sex=female`, {
        headers: { Accept: 'application/json' },
      }).then((r) => (r.ok ? (r.json() as Promise<RawHraSceneNode[]>) : null)),
    ]);

  const localManifest =
    manifestResult.status === 'fulfilled' ? manifestResult.value : null;
  const apiList =
    refOrgansResult.status === 'fulfilled' &&
    Array.isArray(refOrgansResult.value)
      ? refOrgansResult.value
      : null;

  // Strictly extract ONLY reference organ nodes (never donor tissue blocks or landmarks)
  const sceneNodeByKey = new Map<string, RawHraSceneNode>();
  const ingestSceneList = (
    sex: BiologicalSex,
    list: RawHraSceneNode[] | null
  ) => {
    if (!Array.isArray(list)) return;
    for (const node of list) {
      if (isDonorTissueBlockOrNoise(node)) continue;
      if (
        !node.scenegraph ||
        !Array.isArray(node.transformMatrix) ||
        node.transformMatrix.length !== 16
      ) {
        continue;
      }
      if (node.sex && node.sex.toLowerCase() !== sex) continue;
      const keyId = node.reference_organ || node['@id'] || node.scenegraph;
      if (keyId) {
        sceneNodeByKey.set(`${sex}::${keyId}`, node);
      }
    }
  };

  ingestSceneList(
    'male',
    maleSceneResult.status === 'fulfilled' ? maleSceneResult.value : null
  );
  ingestSceneList(
    'female',
    femaleSceneResult.status === 'fulfilled' ? femaleSceneResult.value : null
  );

  const localLookup = buildManifestLookup(localManifest);
  const itemsBySex: Record<BiologicalSex, NihOrganSceneItem[]> = {
    male: [],
    female: [],
  };
  const seenIds = new Set<string>();

  if (apiList && apiList.length > 0) {
    for (const raw of apiList) {
      const label = String(raw.label ?? raw.name ?? raw.organ ?? '').trim();
      if (!label || isDonorTissueBlockOrNoise({ id: raw['@id'], label })) {
        continue;
      }
      const matcher = WHOLE_BODY_MACRO_MATCHERS.find((m) =>
        m.regex.test(label)
      );

      const glbUrlRaw = raw.glbObject?.file ?? raw.object?.file ?? '';
      if (!glbUrlRaw || !glbUrlRaw.includes('.glb')) continue;

      const remoteUrl = glbUrlRaw.startsWith('http')
        ? glbUrlRaw
        : `${NIH_HRA_CDN_BASE}${glbUrlRaw.replace(/^\/+/, '')}`;

      const sex = resolveOrganSex(raw, remoteUrl);
      if (!sex) continue;
      if (matcher?.sexOnly && matcher.sexOnly !== sex) continue;

      const id = extractOrganSlug(raw, label, sex);
      if (seenIds.has(id)) continue;

      const localRec = localLookup.get(id);
      const downloadedLocally = Boolean(
        localRec?.downloaded && localRec?.localPath
      );
      if (matcher?.localOnly && !downloadedLocally) continue;

      seenIds.add(id);

      const iri = raw.reference_organ || raw['@id'] || remoteUrl;
      const sceneNode =
        sceneNodeByKey.get(`${sex}::${iri}`) ??
        sceneNodeByKey.get(`${sex}::${raw['@id'] ?? ''}`);

      const dimensionsMm: [number, number, number] | undefined =
        typeof raw.x_dimension === 'number' &&
        typeof raw.y_dimension === 'number' &&
        typeof raw.z_dimension === 'number'
          ? [raw.x_dimension, raw.y_dimension, raw.z_dimension]
          : undefined;

      const localPath = resolveAssetUrl(
        localRec?.localPath ?? `/models/nih/${sex}/${id}.glb`
      );
      const placement =
        decomposeTransformMatrix(sceneNode?.transformMatrix) ??
        parseHraPlacement(raw);
      const resolvedSystem = matcher?.system ?? resolveNihOrganSystem(label);
      const resolvedKey = matcher?.key ?? label.toLowerCase();

      itemsBySex[sex].push({
        id,
        organKey: resolvedKey,
        name: label,
        sex,
        side:
          (raw.side as 'Left' | 'Right' | 'Unpaired' | undefined) ??
          inferSideFromLabel(label),
        system: resolvedSystem,
        ontologyId: String(raw.representation_of ?? ''),
        ta98Code: matcher?.ta98Code ?? 'A01.0.00.000',
        remoteUrl,
        localPath,
        activeUrl: downloadedLocally ? localPath : remoteUrl,
        downloadedLocally,
        placement,
        subNode:
          raw.object?.file_subpath ??
          raw.glbObject?.file_subpath ??
          sceneNode?.scenegraphNode,
        dimensionsMm,
        transformMatrix: sceneNode?.transformMatrix,
        defaultOpacity:
          typeof sceneNode?.opacity === 'number'
            ? sceneNode.opacity
            : undefined,
      });
    }
  }

  // Merge any locally cached manifest entries if API didn't return them or was offline
  for (const sex of ['male', 'female'] as const) {
    for (const rec of localManifest?.[sex] ?? []) {
      if (!rec?.id || seenIds.has(rec.id)) continue;
      if (isDonorTissueBlockOrNoise({ id: rec.id, label: rec.name })) {
        continue;
      }
      const matcher = WHOLE_BODY_MACRO_MATCHERS.find(
        (m) => m.key === rec.organKey || m.regex.test(rec.name ?? '')
      );
      if (!rec.downloaded && !rec.remoteUrl) continue;

      seenIds.add(rec.id);
      const remoteUrl =
        rec.remoteUrl ??
        `${NIH_HRA_CDN_BASE}${rec.id}/latest/assets/3d-model.glb`;
      const localPath = resolveAssetUrl(
        rec.localPath ?? `/models/nih/${sex}/${rec.id}.glb`
      );
      itemsBySex[sex].push({
        id: rec.id,
        organKey: rec.organKey ?? matcher?.key ?? rec.id,
        name: rec.name ?? rec.id,
        sex,
        side: rec.side ?? inferSideFromLabel(rec.name ?? ''),
        system:
          rec.system ??
          matcher?.system ??
          resolveNihOrganSystem(rec.name ?? rec.id),
        ontologyId: rec.ontologyId ?? '',
        ta98Code: rec.ta98Code ?? matcher?.ta98Code ?? 'A01.0.00.000',
        remoteUrl,
        localPath,
        activeUrl: rec.downloaded ? localPath : remoteUrl,
        downloadedLocally: Boolean(rec.downloaded),
        placement: rec.placement ?? {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      });
    }
  }

  // Emergency CDN fallback if neither local manifest nor live HRA API resolved any entries
  if (itemsBySex.male.length === 0 && itemsBySex.female.length === 0) {
    for (const cdnItem of EMERGENCY_CDN_ORGANS) {
      const matcher = WHOLE_BODY_MACRO_MATCHERS.find((m) =>
        m.regex.test(cdnItem.label)
      );
      if (!matcher) continue;
      itemsBySex[cdnItem.sex].push({
        id: cdnItem.id,
        organKey: matcher.key,
        name: cdnItem.label,
        sex: cdnItem.sex,
        side: inferSideFromLabel(cdnItem.label),
        system: matcher.system,
        ontologyId: cdnItem.ontologyId,
        ta98Code: matcher.ta98Code,
        remoteUrl: cdnItem.remoteUrl,
        localPath: resolveAssetUrl(`/models/nih/${cdnItem.sex}/${cdnItem.id}.glb`),
        activeUrl: cdnItem.remoteUrl,
        downloadedLocally: false,
        placement: {
          translation: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      });
    }
  }

  return itemsBySex;
}

export {
  HRA_RUI_REFERENCE_DATA_URL,
  getCachedHraSurgicalLandmarksSync,
  getHraSurgicalLandmarks,
  matchLandmarksForOrgan,
  type HraLandmarkMatchQuery,
  type HraLandmarkSubmesh,
  type HraSurgicalLandmarkGlb,
} from './hraLandmarkService';
