import React, {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  cameraInteractionState,
  useAnatomyStore,
  useAnatomyStoreApi,
  useAppNavigationStore,
  type AnatomicalSystem,
  type BiologicalSex,
  type OfficialAtlasPresetId,
} from '../../store/useAnatomyStore';
import {
  isGenericNodeName,
  parseAnatomicalMesh,
  type AnatomicalPartInfo,
} from '../../utils/anatomyParser';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { resolveSpatialStructure } from '../../utils/spatialAnatomyResolver';
import {
  enqueueGeometryBVH,
  getRegisteredSceneMesh,
  registerSceneMesh,
  unregisterSceneMesh,
  useSceneMeshRegistry,
} from '../../utils/bvhSetup';
import {
  INTERNAL_TISSUE_COLORS,
  useClippingPlane,
} from '../../utils/slicingPlane';
import {
  resolveExplodeClusterId,
  applyRigidMacroExplodeOffset,
  type ExplodeClusterId,
} from '../../utils/explodeClusters';
import {
  GHOST_EMISSIVE_COLOR,
  ZERO_EMISSIVE_COLOR,
} from '../../utils/tissueShader';
import {
  cloneClinicalHighlightMaterial,
  setClinicalHighlightState,
} from '../../utils/clinicalReliefShader';
import {
  computeBodyNormalizationTransform,
  fetchNihSceneOrgans,
  type NihBodyNormalizationTransform,
  type NihOrganSceneItem,
} from '../../services/nihSceneService';
import {
  getOrCreateSharedStandardMaterial,
  NihManifestOrganGLB,
  setMaterialEmissiveSafe,
  type SharedSystemMaterialEntry,
} from './NihManifestOrgan';
import { registerCustomGlbExtensions } from '../../utils/gltfSpecularGlossinessExtension';
import { SlicingPlaneGizmo } from './SlicingPlaneGizmo';
import { FemaleZAnatomyOrgansGroup } from './FemaleZAnatomyOrgansGroup';
import {
  HraLandmarkOverlayList,
  useHraSurgicalLandmarksCatalog,
} from './HraLandmarkOverlayGLB';
import { UniversalLandmarksLayer } from './UniversalLandmarksLayer';
import { matchLandmarksForOrgan } from '../../services/hraLandmarkService';
import {
  applyMeshPartOpacityOverride,
  disposeMeshOpacityClone,
  getMeshNonHighlightMaterial,
  resolveMeshOpacityOverride,
} from '../../utils/partOpacityUtils';
import {
  isFemaleOnlyMesh,
  isMaleOnlyMesh,
  isMeshVisibleForSex,
  isPartVisibleForSex,
} from '../../utils/sexDimorphismFilter';

// Configure local offline Draco decoder (bundled under public/draco/)
useGLTF.setDecoderPath(resolveAssetUrl('/draco/'));

const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

const OriginAnchorDot: React.FC = () => (
  <div className="pointer-events-none relative select-none">
    <span className="flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full border border-white/80 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.95)]" />
    </span>
  </div>
);

const CalloutCardContent: React.FC<{ part: AnatomicalPartInfo }> = ({ part }) => (
  <div className="pointer-events-none select-none">
    <div className="min-w-[170px] max-w-[240px] rounded-lg border border-sky-400/45 bg-zinc-950/92 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-sans text-xs font-semibold text-white">
          {part.cleanName}
        </span>
        <span className="shrink-0 rounded border border-sky-400/25 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-medium text-sky-300">
          {part.ta98Code}
        </span>
      </div>
      <div className="mt-0.5 truncate font-serif text-[11px] italic text-zinc-400">
        {part.latinName}
      </div>
    </div>
  </div>
);

class GLBErrorBoundary extends Component<
  {
    fallback: React.ReactNode;
    children: React.ReactNode;
    onError?: (error: Error) => void;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const ATLAS_PROCESSING_REV = 6;

const SURFACE_SHELL_REGEX =
  /(?:^|[_\s.\-/])(skin|cutis|epiderm|dermis|integument|surface[_\s]*region|region[_\s]*of|regions[_\s]*of|body[_\s]*mesh|human[_\s]*body|mannequin|head[_\s]*skin|face[_\s]*skin|face|scalp|hair|hairs|eyebrow|eyelash|eyelashes|nail|fascia[_\s]*superficialis|subcutaneous|tela[_\s]*subcutanea|adipose|fat|philtrum|nasolabial|mentolabial|labial[_\s]*commissure|angle[_\s]*of[_\s]*mouth|tubercle[_\s]*of[_\s]*upper[_\s]*lip|buccal[_\s]*region|oral[_\s]*region|mental[_\s]*region|nasal[_\s]*region|frontal[_\s]*region|orbital[_\s]*region|zygomatic[_\s]*region|infra-?orbital[_\s]*region|parietal[_\s]*region|temporal[_\s]*region|occipital[_\s]*region|auricular[_\s]*region|gluteal[_\s]*region|hip[_\s]*region|urogenital[_\s]*region|heel[_\s]*region|metatarsal[_\s]*region)(?=$|[_\s.\-/])/i;

const PROTECTED_INTERNAL_MESH_REGEX =
  /(?:^|[_\s.\-/()])(pleura|spinal[_\s]*dura|dura[_\s]*mater|bursa|bursae|fat[_\s]*pad|articular[_\s]*surface|surface[_\s]*of[_\s]*(?:spleen|liver|kidney|patella|tibia|femur|humerus|talus|calcaneus|radius|ulna|rib|vertebra)|piriformis[_\s]*fascia|nasolabial[_\s]*node|lymph[_\s]*node)(?=$|[_\s.\-/()])/i;

const INTEGUMENT_MATERIAL_REGEX = /^(?:fascia|skin|black|nail)\b/i;

function isIntegumentaryOuterShell(
  names: string[],
  materialName: string,
  normalizedHeight = 0
): boolean {
  const joined = names.filter(Boolean).join(' ');
  if (PROTECTED_INTERNAL_MESH_REGEX.test(joined)) {
    return false;
  }
  if (normalizedHeight > 1.35) {
    return true;
  }
  if (INTEGUMENT_MATERIAL_REGEX.test(materialName.trim())) {
    return true;
  }
  return SURFACE_SHELL_REGEX.test(joined);
}

const PELVIC_GIRDLE_REGEX =
  /(?:^|[\s_])(hip[\s_]+bone|sacrum|coccyx|pubic[\s_]+symphysis|interpubic[\s_]+disc|superior[\s_]+pubic[\s_]+ligament|inferior[\s_]+pubic[\s_]+ligament|obturator[\s_]+membrane)(?=$|[\s_])/i;

// Z-Anatomy raw centimeter-space pelvic widening when female skeletal dimorphism is active
const FEMALE_PELVIS_SCALE_X = 1.055;
const FEMALE_PELVIS_SCALE_Z = 1.025;
const FEMALE_PELVIS_PIVOT_Z_CM = -1.8;
const FEMALE_PELVIS_PIVOT_OFFSET = new THREE.Vector3(
  0,
  0,
  (1 - FEMALE_PELVIS_SCALE_Z) * FEMALE_PELVIS_PIVOT_Z_CM
);

function resolveOrganGroupId(
  mesh: THREE.Mesh,
  rootObj: THREE.Object3D,
  fallbackName: string,
  scopePrefix = ''
): string {
  const explicit =
    typeof mesh.userData?.organGroupId === 'string' &&
    mesh.userData.organGroupId.trim().length > 0
      ? mesh.userData.organGroupId.trim()
      : '';
  const parentExplicit =
    mesh.parent &&
    mesh.parent !== rootObj &&
    typeof mesh.parent.userData?.organGroupId === 'string' &&
    mesh.parent.userData.organGroupId.trim().length > 0
      ? mesh.parent.userData.organGroupId.trim()
      : '';

  let base = explicit || parentExplicit;
  if (!base) {
    const parentName =
      mesh.parent &&
      mesh.parent !== rootObj &&
      mesh.parent.name &&
      !/^(?:scene|rootnode|gltf|zanatomy-|sketchfab_system_)/i.test(
        mesh.parent.name.trim()
      )
        ? mesh.parent.name.trim()
        : '';
    base = parentName || fallbackName;
  }

  base = base
    .replace(/(?:[_\s]+primitive\d+|_primitive\d+|primitive_\d+|\.\d{3}|_\d+)$/i, '')
    .trim();

  if (/segment[_\s]+of[_\s]+liver/i.test(base)) {
    base = 'Liver';
  }

  const finalBase = base || fallbackName || mesh.uuid;
  return scopePrefix ? `${scopePrefix}::${finalBase}` : finalBase;
}

function resolveHierarchyName(mesh: THREE.Mesh, fallbackIndex: number): string {
  const rawOwn = mesh.name?.trim();
  if (rawOwn && !isGenericNodeName(rawOwn)) {
    return rawOwn;
  }
  let ancestor: THREE.Object3D | null = mesh.parent;
  while (ancestor) {
    const ancName = ancestor.name?.trim();
    if (
      ancName &&
      !isGenericNodeName(ancName) &&
      !/^(?:scene|rootnode|root|gltf|sketchfab(?:_system|_model)?|human_body_assembly|nih_visible_human|anatomical_atlas_root|zanatomy-.*)$/i.test(
        ancName
      )
    ) {
      return ancName;
    }
    ancestor = ancestor.parent;
  }
  return `Anatomical_Structure_${fallbackIndex}`;
}

const CRANIAL_SKULL_REQUEST_REGEX =
  /\b(?:skull|crani(?:um|al)|calvaria|mandible|maxilla|facial\s*bones?|head\s*bones?)\b/i;

const CRANIAL_MESH_KEEP_REGEX =
  /\b(?:skull|crani|frontal|parietal|temporal|occipital|sphenoid|ethmoid|zygomatic|maxilla|mandib|nasal|lacrimal|palatine|vomer|concha|malleus|incus|stapes|hyoid|suture|fontanelle|tooth|teeth|incisor|canine|premolar|molar|calvaria|orbit)\b/i;

const CustomGlbModel: React.FC<{ url: string }> = ({ url }) => {
  const { gl, invalidate } = useThree();
  const maxAnisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 8);
  const resolvedUrl = resolveAssetUrl(url);
  const gltf = useGLTF(resolvedUrl, true, true, registerCustomGlbExtensions);
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const explorerOpenedModel = useAppNavigationStore(
    (s) => s.explorerOpenedModel
  );
  const showSurgicalLandmarks = useAnatomyStore(
    (s) => s.showSurgicalLandmarks
  );
  const landmarksCatalog = useHraSurgicalLandmarksCatalog(
    showSurgicalLandmarks
  );
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);

  const customGlbName = useAnatomyStore((s) => s.customGlbName);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const partOpacityOverrides = useAnatomyStore((s) => s.partOpacityOverrides);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);

  const registerCatalog = useAnatomyStore((s) => s.registerCatalog);

  const { clonedScene, catalogParts, sharedMaterials, registeredMeshes } =
    useMemo(() => {
      const clone = gltf.scene.clone(true);
      clone.updateMatrixWorld(true);

      // Preserve anatomical proportions first so height checks map reliably to real [0.02m..1.78m] space
      const normalizeSceneToBodyBounds = (targetDim: number, targetCenterY: number) => {
        clone.scale.set(1, 1, 1);
        clone.position.set(0, 0, 0);
        clone.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(clone);
        if (box.isEmpty()) return false;
        const size = new THREE.Vector3();
        box.getSize(size);
        const horizMax = Math.max(size.x, size.z, 1e-4);
        const isFullBodyAspect = size.y / horizMax > 2.1;
        const resolvedTargetDim = targetDim > 0 ? targetDim : isFullBodyAspect ? 1.76 : 0.78;
        const refDim = isFullBodyAspect
          ? Math.max(size.y, 1e-4)
          : Math.max(size.y, size.x, size.z, 1e-4);
        const uniformScale = resolvedTargetDim / refDim;
        clone.scale.multiplyScalar(uniformScale);
        clone.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(clone);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        const resolvedCenterY =
          targetCenterY >= 0 ? targetCenterY : isFullBodyAspect ? 0.9 : 1.0;
        clone.position.add(
          new THREE.Vector3(
            0 - scaledCenter.x,
            resolvedCenterY - scaledCenter.y,
            0 - scaledCenter.z
          )
        );
        clone.updateMatrixWorld(true);
        return true;
      };

      normalizeSceneToBodyBounds(0, -1);

      // Isolate cranial/skull subtree cleanly when a Skull card falls back to full-body skeletal.glb
      if (CRANIAL_SKULL_REQUEST_REGEX.test(customGlbName ?? '')) {
        const fullBox = new THREE.Box3().setFromObject(clone);
        let rawMeshCount = 0;
        const candidateMeshes: THREE.Mesh[] = [];
        clone.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            rawMeshCount += 1;
            candidateMeshes.push(child as THREE.Mesh);
          }
        });
        const fullHeight = fullBox.isEmpty() ? 0 : fullBox.max.y - fullBox.min.y;
        if (!fullBox.isEmpty() && (fullHeight > 1.2 || rawMeshCount > 150)) {
          const meshBox = new THREE.Box3();
          const meshCenter = new THREE.Vector3();
          const keepMeshes: THREE.Mesh[] = [];
          const removeMeshes: THREE.Mesh[] = [];

          for (const m of candidateMeshes) {
            const labelChain = [
              m.name,
              m.parent?.name,
              m.parent?.parent?.name,
            ]
              .filter(Boolean)
              .join(' ');
            meshBox.setFromObject(m);
            const hasBox = !meshBox.isEmpty();
            if (hasBox) {
              meshBox.getCenter(meshCenter);
            }
            const inHeadZone = hasBox && meshCenter.y >= 1.48;
            const matchesCranial =
              CRANIAL_MESH_KEEP_REGEX.test(labelChain) &&
              (!hasBox || meshCenter.y >= 1.32);
            if (inHeadZone || matchesCranial) {
              keepMeshes.push(m);
            } else {
              removeMeshes.push(m);
            }
          }

          if (keepMeshes.length > 0 && removeMeshes.length > 0) {
            for (const m of removeMeshes) {
              m.removeFromParent();
            }
            normalizeSceneToBodyBounds(0.78, 1.0);
          }
        }
      }

      void ATLAS_PROCESSING_REV;
      const parts: AnatomicalPartInfo[] = [];
      const seenRawNames = new Map<string, number>();
      const matCache = new Map<string, SharedSystemMaterialEntry>();
      const nonPooledMaterials: SharedSystemMaterialEntry[] = [];
      const meshes: THREE.Mesh[] = [];
      const contextHint = customGlbName ?? undefined;
      const organBoxes = new Map<string, THREE.Box3>();
      const tempMeshBox = new THREE.Box3();
      const tempBoxCenter = new THREE.Vector3();
      const tempBoxSphere = new THREE.Sphere();
      const collected: Array<{
        mesh: THREE.Mesh;
        parsed: AnatomicalPartInfo;
        matName: string;
        organGroupId: string;
        meshIndexZero: number;
        isMaleOnly: boolean;
        isFemaleOnly: boolean;
        spatialBounds?: {
          center: THREE.Vector3;
          maxZ: number;
          radius: number;
          system?: string;
        };
      }> = [];
      let meshIdx = 0;

      // Pass 1: Normalize names, enforce Surface/Fascia integumentary classification, and union boxes by organGroupId
      clone.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        meshIdx += 1;
        const mesh = child as THREE.Mesh;

        let candidateName = resolveHierarchyName(mesh, meshIdx);
        const count = seenRawNames.get(candidateName) ?? 0;
        seenRawNames.set(candidateName, count + 1);
        if (count > 0) {
          candidateName = `${candidateName}_${count + 1}`;
        }
        mesh.name = candidateName;

        if (mesh.geometry && !mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }

        const parsed = parseAnatomicalMesh(mesh, contextHint, meshIdx - 1);
        const matName = getMaterialName(mesh);

        const organGroupId = resolveOrganGroupId(
          mesh,
          clone,
          parsed.cleanName || candidateName,
          'custom'
        );

        tempMeshBox.setFromObject(mesh);
        const meshHeight = tempMeshBox.isEmpty()
          ? 0
          : tempMeshBox.max.y - tempMeshBox.min.y;
        if (
          isIntegumentaryOuterShell(
            [parsed.cleanName, candidateName],
            matName,
            meshHeight
          )
        ) {
          parsed.system = 'integumentary';
        }

        let spatialBounds:
          | {
              center: THREE.Vector3;
              maxZ: number;
              radius: number;
              system?: string;
            }
          | undefined;
        if (!tempMeshBox.isEmpty()) {
          const prevBox = organBoxes.get(organGroupId);
          if (prevBox) {
            prevBox.union(tempMeshBox);
          } else {
            organBoxes.set(organGroupId, tempMeshBox.clone());
          }
          tempMeshBox.getCenter(tempBoxCenter);
          tempMeshBox.getBoundingSphere(tempBoxSphere);
          spatialBounds = {
            center: tempBoxCenter.clone(),
            maxZ: tempMeshBox.max.z,
            radius: tempBoxSphere.radius,
            system: parsed.system,
          };
        }

        const isMaleOnly = isMaleOnlyMesh(mesh, spatialBounds);
        const isFemaleOnly = isFemaleOnlyMesh(mesh);

        collected.push({
          mesh,
          parsed,
          matName,
          organGroupId,
          meshIndexZero: meshIdx - 1,
          isMaleOnly,
          isFemaleOnly,
          spatialBounds,
        });
      });

      const sharedOrganCenter = new THREE.Vector3();

      // Pass 2: Assign rigid macro-unit explode cluster IDs and configure materials
      for (const {
        mesh,
        parsed,
        matName,
        organGroupId,
        meshIndexZero,
        isMaleOnly,
        isFemaleOnly,
        spatialBounds,
      } of collected) {
        const localCenter = mesh.geometry?.boundingBox
          ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3();

        const groupBox = organBoxes.get(organGroupId);
        if (groupBox && !groupBox.isEmpty()) {
          groupBox.getCenter(sharedOrganCenter);
        } else {
          sharedOrganCenter.set(...parsed.worldCenter);
        }

        const explodeClusterId = resolveExplodeClusterId(
          `${mesh.name} ${parsed.cleanName} ${organGroupId} ${matName}`,
          parsed.system,
          sharedOrganCenter
        );

        const tissueColor = new THREE.Color(
          INTERNAL_TISSUE_COLORS[parsed.system]
        );
        const hasVertexColors = Boolean(mesh.geometry?.getAttribute('color'));

        const isExternalExplorerModel =
          !resolvedUrl.includes('/models/zanatomy/') &&
          !resolvedUrl.includes('/models/nih/');
        const configureMaterial = (m: THREE.Material): THREE.Material =>
          getOrCreateSharedStandardMaterial(
            matCache,
            m,
            parsed.system,
            hasVertexColors,
            tissueColor,
            parsed.cleanName,
            isExternalExplorerModel,
            maxAnisotropy,
            nonPooledMaterials
          );

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(configureMaterial);
        } else if (mesh.material) {
          mesh.material = configureMaterial(mesh.material);
        }

        mesh.userData = {
          ...mesh.userData,
          anatomicalName: parsed.cleanName,
          organGroupId,
          parentModelContext: contextHint,
          partIndex: meshIndexZero,
          system: parsed.system,
          ta98Code: parsed.ta98Code,
          __isMaleOnly: isMaleOnly,
          __isFemaleOnly: isFemaleOnly,
          __spatialBounds: spatialBounds,
          __restPosition: mesh.position.clone(),
          __restCenter: sharedOrganCenter.clone(),
          __localCenter: localCenter,
          __explodeClusterId: explodeClusterId,
          __sharedMaterial: mesh.material,
          __origRaycast: mesh.raycast,
        };

        meshes.push(mesh);
        parts.push(parsed);
      }

      return {
        clonedScene: clone,
        catalogParts: parts,
        sharedMaterials: [
          ...Array.from(matCache.values()),
          ...nonPooledMaterials,
        ],
        registeredMeshes: meshes,
      };
    }, [gltf.scene, customGlbName, maxAnisotropy, resolvedUrl]);

  useEffect(() => {
    registeredMeshes.forEach((m) => registerSceneMesh(m, registry));
    return () => {
      registeredMeshes.forEach((m) => unregisterSceneMesh(m, registry));
    };
  }, [registeredMeshes, registry]);

  useEffect(() => {
    registerCatalog(
      catalogParts.filter((part) => isPartVisibleForSex(part, biologicalSex))
    );
  }, [catalogParts, biologicalSex, registerCatalog]);

  // Dispose shared materials, any active highlight clone, & free cached custom URL on unmount / replacement
  useEffect(() => {
    return () => {
      registeredMeshes.forEach((mesh) => {
        const hi = mesh.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((m) => m?.dispose());
          mesh.userData.__highlightMaterial = undefined;
        }
        disposeMeshOpacityClone(mesh);
        if (mesh.userData?.__sharedMaterial) {
          mesh.material = mesh.userData.__sharedMaterial;
        }
      });
      sharedMaterials.forEach(({ mat }) => mat.dispose());
      if (resolvedUrl.startsWith('blob:')) {
        useGLTF.clear(resolvedUrl);
      }
    };
  }, [registeredMeshes, sharedMaterials, resolvedUrl]);

  // Apply rigid macro-unit explode offsets declaratively
  useEffect(() => {
    clonedScene.parent?.updateWorldMatrix(true, false);
    clonedScene.updateMatrixWorld(true);
    const explodeCtx = { activeAtlasPreset, activeSystems };

    for (const mesh of registeredMeshes) {
      const restPos = mesh.userData?.__restPosition as
        | THREE.Vector3
        | undefined;
      const clusterId = mesh.userData?.__explodeClusterId as
        | ExplodeClusterId
        | undefined;
      if (restPos) {
        applyRigidMacroExplodeOffset(
          mesh,
          clusterId,
          explodeFactor,
          restPos,
          explodeCtx
        );
      }
    }
  }, [
    clonedScene,
    registeredMeshes,
    explodeFactor,
    activeAtlasPreset,
    activeSystems,
  ]);

  useEffect(() => {
    const isInternalSelection =
      selectedPart !== null && selectedPart.system !== 'integumentary';
    const sharedSliced = slicing.enabled && slicing.scope === 'all';

    for (const { mat, system: sys } of sharedMaterials) {
      const sysOpacity = systemOpacity[sys];
      let effectiveOpacity = xrayGhostMode ? 0.1 : sysOpacity;
      if (sys === 'integumentary' && isInternalSelection) {
        effectiveOpacity = xrayGhostMode ? 0.08 : Math.min(sysOpacity, 0.12);
      }
      const isTranslucentLayer = xrayGhostMode || effectiveOpacity < 0.85;
      const effectiveTransparent = isTranslucentLayer || effectiveOpacity < 1;
      const effectiveDepthWrite =
        !isTranslucentLayer && effectiveOpacity >= 0.99;

      mat.clippingPlanes = sharedSliced ? clippingPlanesList : null;
      mat.clipShadows = sharedSliced;
      const origSide =
        (mat.userData?.__origSide as THREE.Side | undefined) ?? THREE.FrontSide;
      const origTransparent = Boolean(mat.userData?.__origTransparent);
      const origOpacity =
        (mat.userData?.__origOpacity as number | undefined) ?? 1;
      mat.side = sharedSliced ? THREE.DoubleSide : origSide;
      mat.shadowSide = mat.side;
      mat.transparent = effectiveTransparent || origTransparent;
      mat.opacity =
        origTransparent && effectiveOpacity >= 0.99
          ? origOpacity
          : effectiveOpacity;
      mat.depthWrite = effectiveDepthWrite && !origTransparent;

      const baseEmissive =
        (mat.userData?.__baseEmissive as THREE.Color | undefined) ??
        ZERO_EMISSIVE_COLOR;
      const baseIntensity =
        (mat.userData?.__baseEmissiveIntensity as number | undefined) ?? 0;
      if (xrayGhostMode) {
        setMaterialEmissiveSafe(mat, GHOST_EMISSIVE_COLOR, 0.4);
      } else {
        setMaterialEmissiveSafe(mat, baseEmissive, baseIntensity);
      }
    }

    const hiddenGroupIds = new Set<string>();
    for (const hid of hiddenPartIds) {
      const hiddenMesh = getRegisteredSceneMesh(hid, hid, registry);
      const grp = hiddenMesh?.userData?.organGroupId as string | undefined;
      if (grp) hiddenGroupIds.add(grp);
    }
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId, registry)
      : null;
    const isolatedGroupId = isolatedMesh?.userData?.organGroupId as
      | string
      | undefined;

    for (const mesh of registeredMeshes) {
      const rawId = mesh.name;
      const sys = (mesh.userData?.system as AnatomicalSystem) ?? 'visceral';
      const organGroupId = mesh.userData?.organGroupId as string | undefined;
      const isSysActive = activeSystems[sys] ?? true;
      const sysOpacity = systemOpacity[sys] ?? 1.0;

      const isHiddenForSex = !isMeshVisibleForSex(
        mesh,
        biologicalSex,
        mesh.userData?.__spatialBounds
      );
      const isHiddenByPeel =
        hiddenPartIds.includes(mesh.uuid) ||
        hiddenPartIds.includes(rawId) ||
        (Boolean(organGroupId) && hiddenGroupIds.has(organGroupId!));
      const isIsolatedOut =
        isolatedPartId !== null &&
        !xrayGhostMode &&
        isolatedPartId !== mesh.uuid &&
        isolatedPartId !== rawId &&
        (!isolatedGroupId || organGroupId !== isolatedGroupId);

      const isVisible =
        !isHiddenForSex && isSysActive && !isHiddenByPeel && !isIsolatedOut;
      mesh.visible = isVisible;
      if (!mesh.userData.__origRaycast) {
        mesh.userData.__origRaycast = mesh.raycast;
      }
      mesh.raycast = isVisible
        ? (mesh.userData.__origRaycast as THREE.Mesh['raycast'])
        : NOOP_RAYCAST;
      if (isVisible) {
        mesh.layers.enable(0);
        enqueueGeometryBVH(mesh.geometry);
      } else {
        mesh.layers.disable(0);
      }

      let effectiveOpacity = xrayGhostMode ? 0.1 : sysOpacity;
      if (sys === 'integumentary' && isInternalSelection) {
        effectiveOpacity = xrayGhostMode ? 0.08 : Math.min(sysOpacity, 0.12);
      }
      const isTranslucentLayer = xrayGhostMode || effectiveOpacity < 0.85;
      const effectiveTransparent = isTranslucentLayer || effectiveOpacity < 1;

      const baseOrder = effectiveTransparent ? 10 : 2;
      const overrideOpacity = resolveMeshOpacityOverride(
        mesh,
        partOpacityOverrides
      );
      applyMeshPartOpacityOverride(mesh, overrideOpacity, baseOrder);
    }
    invalidate();
  }, [
    registeredMeshes,
    sharedMaterials,
    biologicalSex,
    activeSystems,
    systemOpacity,
    selectedPart,
    hiddenPartIds,
    isolatedPartId,
    partOpacityOverrides,
    invalidate,
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
  ]);

  const isNihOrganModel =
    /nih|human\s*reference\s*atlas|\bhra\b/i.test(
      explorerOpenedModel?.sourceLabel ?? ''
    ) || /humanatlas|nih_organs|\/models\/nih\//i.test(url);

  const organLandmarks = useMemo(() => {
    if (!showSurgicalLandmarks || !isNihOrganModel) return [];
    return matchLandmarksForOrgan(
      {
        organKey: explorerOpenedModel?.key,
        organLabel: customGlbName ?? explorerOpenedModel?.title,
        glbUrl: explorerOpenedModel?.glbUrl ?? url,
        sex: biologicalSex,
      },
      landmarksCatalog
    );
  }, [
    showSurgicalLandmarks,
    isNihOrganModel,
    explorerOpenedModel?.key,
    explorerOpenedModel?.title,
    explorerOpenedModel?.glbUrl,
    url,
    customGlbName,
    biologicalSex,
    landmarksCatalog,
  ]);

  return (
    <>
      <primitive object={clonedScene} />
      {showSurgicalLandmarks && isNihOrganModel && organLandmarks.length > 0 && (
        <group
          name="__custom_glb_landmarks__"
          position={[
            clonedScene.position.x,
            clonedScene.position.y,
            clonedScene.position.z,
          ]}
          rotation={[
            clonedScene.rotation.x,
            clonedScene.rotation.y,
            clonedScene.rotation.z,
          ]}
          scale={[
            clonedScene.scale.x,
            clonedScene.scale.y,
            clonedScene.scale.z,
          ]}
        >
          <HraLandmarkOverlayList
            visible={showSurgicalLandmarks}
            landmarks={organLandmarks}
            parentSystem={explorerOpenedModel?.system ?? 'visceral'}
          />
        </group>
      )}
      <UniversalLandmarksLayer
        nihCatalog={null}
        catalogTick={registeredMeshes.length}
        modelContext="explorer-custom"
        customModelHint={customGlbName ?? explorerOpenedModel?.title ?? ''}
        skipCrossHraGlb={isNihOrganModel}
      />
    </>
  );
};

function computeSubtreeLocalBox(
  root: THREE.Object3D,
  placement?: {
    translation: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }
): THREE.Box3 {
  const totalBox = new THREE.Box3();
  const meshBox = new THREE.Box3();
  const rootMatrix = placement
    ? new THREE.Matrix4().compose(
        new THREE.Vector3(...placement.translation),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...placement.rotation)
        ),
        new THREE.Vector3(...placement.scale)
      )
    : new THREE.Matrix4();

  const walk = (node: THREE.Object3D, parentMatrix: THREE.Matrix4) => {
    node.updateMatrix();
    const currentMatrix = new THREE.Matrix4().multiplyMatrices(
      parentMatrix,
      node.matrix
    );
    if ((node as THREE.Mesh).isMesh && (node as THREE.Mesh).geometry) {
      const mesh = node as THREE.Mesh;
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(currentMatrix);
        totalBox.union(meshBox);
      }
    }
    for (const child of node.children) {
      walk(child, currentMatrix);
    }
  };

  walk(root, rootMatrix);
  return totalBox;
}

const NihOrganStreamNode: React.FC<{
  entry: NihOrganSceneItem;
  forceVisible?: boolean;
  onOrganMounted: (entry: NihOrganSceneItem, scene: THREE.Object3D) => void;
  onOrganUnmounted: (organId: string) => void;
}> = ({ entry, forceVisible = false, onOrganMounted, onOrganUnmounted }) => {
  const hasDistinctRemoteFallback =
    Boolean(entry.remoteUrl) && entry.remoteUrl !== entry.activeUrl;

  const remoteFallback = hasDistinctRemoteFallback ? (
    <GLBErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <NihManifestOrganGLB
          entry={entry}
          urlOverride={entry.remoteUrl}
          forceVisible={forceVisible}
          onOrganMounted={onOrganMounted}
          onOrganUnmounted={onOrganUnmounted}
        />
      </Suspense>
    </GLBErrorBoundary>
  ) : null;

  return (
    <GLBErrorBoundary fallback={remoteFallback}>
      <Suspense fallback={null}>
        <NihManifestOrganGLB
          entry={entry}
          forceVisible={forceVisible}
          onOrganMounted={onOrganMounted}
          onOrganUnmounted={onOrganUnmounted}
        />
      </Suspense>
    </GLBErrorBoundary>
  );
};

interface SketchfabManifestModel {
  id: string;
  system: AnatomicalSystem;
  file?: string;
  fileName: string;
  localPath: string;
  uid: string;
  title: string;
  titleAr?: string;
  author: string;
  authorUsername: string;
  faceCount: number;
  vertexCount: number;
  sizeBytes: number;
  license: string;
  viewerUrl: string;
  isUnifiedFullBody?: boolean;
  alignment: {
    isFullBody: boolean;
    useSharedOrigin?: boolean;
    sharedScale?: number;
    sharedOffset?: [number, number, number];
    targetHeight: number;
    targetCenter: [number, number, number];
    rotationEuler?: [number, number, number];
  };
}

interface SketchfabManifestResponse {
  models?: SketchfabManifestModel[];
}

const GENERIC_SKETCHFAB_NODE_REGEX =
  /^(object|mesh|primitive|sketchfab_model|rootnode|scene|default)[_\s.-]*\d*(\.[a-z0-9]+)?$/i;

function getMaterialName(mesh: THREE.Mesh): string {
  const firstMat = Array.isArray(mesh.material)
    ? mesh.material[0]
    : mesh.material;
  return (firstMat?.name || '').trim();
}

function deriveSketchfabMeshDisplayName(
  rawNodeName: string,
  materialName: string,
  entry: SketchfabManifestModel,
  normalizedCenter: THREE.Vector3,
  partIndex: number
): { name: string; filteredOut: boolean; system: AnatomicalSystem } {
  const matLower = materialName.toLowerCase();

  if (isIntegumentaryOuterShell([rawNodeName], materialName)) {
    return {
      name: rawNodeName || 'Integumentary Surface',
      filteredOut: false,
      system: 'integumentary',
    };
  }

  // Because Z-Anatomy Splanchnology (visceral.glb) now renders as a standalone official atlas,
  // retain its aligned skeletal/cartilage/teeth structures under the 'skeletal' system layer
  // so users can dissect organs and bones together in perfect anatomical alignment.
  if (entry.system === 'visceral') {
    if (matLower === 'suture') {
      return {
        name: 'Cranial Sutures',
        filteredOut: false,
        system: 'skeletal',
      };
    }
    if (matLower === 'teeth') {
      return {
        name: 'Dental Arcade (Teeth)',
        filteredOut: false,
        system: 'skeletal',
      };
    }
    if (matLower === 'cartilage') {
      const cartilageName =
        normalizedCenter.y > 1.0 && Math.abs(normalizedCenter.x) < 0.16
          ? 'Costal & Articular Cartilage'
          : 'Articular Cartilage';
      return {
        name: cartilageName,
        filteredOut: false,
        system: 'skeletal',
      };
    }
    if (matLower === 'bone') {
      const boneName =
        rawNodeName && !GENERIC_SKETCHFAB_NODE_REGEX.test(rawNodeName)
          ? rawNodeName
              .replace(/__\d+$/, '')
              .replace(/[_]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : normalizedCenter.y > 1.5
            ? 'Cranium & Facial Skeleton'
            : normalizedCenter.y > 1.08
              ? 'Thoracic Cage & Vertebral Column'
              : normalizedCenter.y > 0.78
                ? 'Pelvic Girdle & Sacrum'
                : 'Appendicular Skeleton';
      return {
        name: boneName,
        filteredOut: false,
        system: 'skeletal',
      };
    }
  }

  const sidePrefix =
    normalizedCenter.x > 0.025
      ? 'Left '
      : normalizedCenter.x < -0.025
        ? 'Right '
        : '';

  if (
    rawNodeName &&
    !GENERIC_SKETCHFAB_NODE_REGEX.test(rawNodeName) &&
    !/^(material|phong|lambert)/i.test(rawNodeName)
  ) {
    const cleaned = rawNodeName
      .replace(/__\d+$/, '')
      .replace(/^l[\s_]+/i, 'Left ')
      .replace(/^r[\s_]+/i, 'Right ')
      .replace(/[_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const formatted = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      name: formatted,
      filteredOut: false,
      system: entry.system,
    };
  }

  if (entry.system === 'visceral') {
    if (matLower.includes('lung')) {
      return {
        name:
          normalizedCenter.x < -0.02
            ? 'Right Lung'
            : normalizedCenter.x > 0.02
              ? 'Left Lung'
              : 'Lungs',
        filteredOut: false,
        system: 'visceral',
      };
    }
    if (matLower.includes('bronch')) {
      return { name: 'Bronchial Tree', filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('cartilage.001')) {
      return { name: 'Trachea', filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('intestin')) {
      const intestinalName =
        normalizedCenter.y < 1.0 && Math.abs(normalizedCenter.x) > 0.03
          ? 'Large Intestine'
          : 'Small Intestine';
      return {
        name: intestinalName,
        filteredOut: false,
        system: 'visceral',
      };
    }
    if (matLower.includes('periton')) {
      return { name: 'Peritoneum', filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('gland')) {
      const glandName =
        normalizedCenter.y > 1.25
          ? 'Thymus'
          : normalizedCenter.y > 1.05
            ? 'Pancreas'
            : `${sidePrefix}Adrenal Gland`;
      return { name: glandName, filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('organ')) {
      let organName = 'Visceral Organ';
      if (normalizedCenter.y > 1.15 && normalizedCenter.x < -0.03) {
        organName = 'Liver';
      } else if (normalizedCenter.y > 1.18 && normalizedCenter.x > 0.035) {
        organName = 'Spleen';
      } else if (normalizedCenter.y > 1.08 && normalizedCenter.x > 0.0) {
        organName = 'Stomach';
      } else if (normalizedCenter.y > 0.98) {
        organName = `${sidePrefix}Kidney`.trim();
      } else {
        organName = 'Urinary Bladder';
      }
      return { name: organName, filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('mucosa')) {
      const mucosaName =
        normalizedCenter.y > 1.32
          ? 'Pharynx'
          : normalizedCenter.y > 1.15
            ? 'Esophagus'
            : 'Digestive Mucosa';
      return { name: mucosaName, filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('ductus')) {
      return { name: 'Gallbladder & Bile Duct', filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('ligament')) {
      return { name: 'Diaphragm Ligament', filteredOut: false, system: 'visceral' };
    }
    if (matLower.includes('muscle')) {
      return { name: 'Diaphragm', filteredOut: false, system: 'muscular' };
    }
    const spatial = resolveSpatialStructure(
      {
        nx: normalizedCenter.x,
        ny: normalizedCenter.y,
        nz: normalizedCenter.z,
        frame: 'standing',
      },
      'visceral',
      materialName,
      partIndex
    );
    return {
      name: spatial.cleanNameEn,
      filteredOut: false,
      system: spatial.system,
    };
  }

  if (entry.system === 'cardiovascular') {
    const heartLabels = ['Heart', 'Aorta', 'Vena Cava', 'Pulmonary Artery'];
    if (partIndex >= 1 && partIndex <= heartLabels.length) {
      return {
        name: heartLabels[partIndex - 1],
        filteredOut: false,
        system: 'cardiovascular',
      };
    }
    const spatial = resolveSpatialStructure(
      {
        nx: normalizedCenter.x,
        ny: normalizedCenter.y,
        nz: normalizedCenter.z,
        frame: 'standing',
      },
      'cardiovascular',
      materialName,
      partIndex
    );
    return {
      name: spatial.cleanNameEn,
      filteredOut: false,
      system: 'cardiovascular',
    };
  }

  if (entry.system === 'nervous') {
    if (normalizedCenter.y > 1.5) {
      return { name: 'Brain', filteredOut: false, system: 'nervous' };
    }
    if (Math.abs(normalizedCenter.x) < 0.06 && normalizedCenter.y > 0.95) {
      return { name: 'Spinal Cord', filteredOut: false, system: 'nervous' };
    }
    const spatial = resolveSpatialStructure(
      {
        nx: normalizedCenter.x,
        ny: normalizedCenter.y,
        nz: normalizedCenter.z,
        frame: 'standing',
      },
      'nervous',
      materialName,
      partIndex
    );
    return {
      name: spatial.cleanNameEn,
      filteredOut: false,
      system: 'nervous',
    };
  }

  if (entry.system === 'muscular') {
    if (matLower.includes('eye') || matLower.includes('cornea') || matLower.includes('sclera')) {
      return { name: 'Ocular Globe & Cornea', filteredOut: false, system: 'nervous' };
    }
    if (matLower.includes('skin')) {
      return { name: 'Superficial Integument', filteredOut: false, system: 'integumentary' };
    }
    const spatial = resolveSpatialStructure(
      {
        nx: normalizedCenter.x,
        ny: normalizedCenter.y,
        nz: normalizedCenter.z,
        frame: 'standing',
      },
      matLower.includes('bone') || matLower.includes('skull') || matLower.includes('teeth')
        ? 'skeletal'
        : 'muscular',
      materialName,
      partIndex
    );
    return {
      name: spatial.cleanNameEn,
      filteredOut: false,
      system: spatial.system,
    };
  }

  if (entry.system === 'integumentary') {
    const spatial = resolveSpatialStructure(
      {
        nx: normalizedCenter.x,
        ny: normalizedCenter.y,
        nz: normalizedCenter.z,
        frame: 'standing',
      },
      'integumentary',
      materialName,
      partIndex
    );
    return {
      name: spatial.cleanNameEn,
      filteredOut: false,
      system: 'integumentary',
    };
  }

  const fallbackSpatial = resolveSpatialStructure(
    {
      nx: normalizedCenter.x,
      ny: normalizedCenter.y,
      nz: normalizedCenter.z,
      frame: 'standing',
    },
    entry.system,
    materialName,
    partIndex
  );
  return {
    name: fallbackSpatial.cleanNameEn,
    filteredOut: false,
    system: fallbackSpatial.system,
  };
}

interface RgbColorLike {
  r: number;
  g: number;
  b: number;
}

function getMeshMaterialColors(mesh?: THREE.Mesh): RgbColorLike[] {
  if (!mesh?.material) return [];
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const colors: RgbColorLike[] = [];
  for (const m of mats) {
    const std = m as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | null;
    if (
      std?.color &&
      typeof std.color.r === 'number' &&
      typeof std.color.g === 'number' &&
      typeof std.color.b === 'number'
    ) {
      colors.push(std.color);
    }
  }
  return colors;
}

function isYellowOmentalColor(c: RgbColorLike): boolean {
  if (c.r > 0.75 && c.g > 0.70 && c.b < 0.58) return true;
  const sr = Math.pow(Math.max(c.r, 0), 1 / 2.2);
  const sg = Math.pow(Math.max(c.g, 0), 1 / 2.2);
  const sb = Math.pow(Math.max(c.b, 0), 1 / 2.2);
  return sr > 0.75 && sg > 0.70 && sb < 0.58 && sr + sg - 2 * sb > 0.35;
}

function isGreenLymphColor(c: RgbColorLike): boolean {
  if (c.g > c.r * 1.15 && c.g > c.b * 1.15 && c.g > 0.04) return true;
  const sr = Math.pow(Math.max(c.r, 0), 1 / 2.2);
  const sg = Math.pow(Math.max(c.g, 0), 1 / 2.2);
  const sb = Math.pow(Math.max(c.b, 0), 1 / 2.2);
  return sg > sr * 1.15 && sg > sb * 1.15 && sg > 0.08;
}

/**
 * Filters out distracting Z-Anatomy visceral overlays that visually bury internal organs:
 * 1) Yellow Peritoneum / Greater Omentum / Lesser Omentum / Mesocolon / Mesentery / Adipose sheets
 *    (`omentum`, `épiploon`, `peritoneum`, `péritoine`, `mesentery`, `adipose`, or large anterior
 *    abdominal yellow sheets in `-0.18 < ny < 0.15`, `nz > 0.04` with `r > 0.75 && g > 0.70 && b < 0.58`),
 *    strictly preserving `Omental_taenia` and major named abdominal organs.
 * 2) Bright green floating Lymph Node dot clusters (`lymph`, `nodus`, `ganglion lymphatique`, or tiny
 *    spherical meshes with `boundingRadius < 0.018` and `g > r * 1.15 && g > b * 1.15`) while preserving
 *    genuine lymphoid organs (`Palatine_tonsil`, `Spleen`, `Thymus`).
 */
export function isNoisyZAnatomyVisceralMesh(
  hierarchyName: string,
  matName: string,
  mesh?: THREE.Mesh,
  normCoords?: { nx: number; ny: number; nz: number },
  boundingRadius = 0
): boolean {
  const raw = hierarchyName.trim();
  const joined = `${raw} ${matName} ${mesh?.name || ''} ${mesh?.parent?.name || ''}`;
  const normalizedJoined = joined.replace(/_/g, ' ');
  const isOmentalTaenia = /\bomental\s+taenia\b/i.test(normalizedJoined);
  const isPeritonealOverlay =
    !isOmentalTaenia &&
    (/\b(?:greater\s+omentum|lesser\s+omentum|omentum|épiploon|epiploon|peritoneum|péritoine|peritoine|mesentery|mesocolon|mesoappendix|mésentère|mesentere|adipose)\b/i.test(
      normalizedJoined
    ) ||
      /^peritoneum/i.test(matName));

  if (isPeritonealOverlay) {
    return true;
  }

  const isProtectedOrgan =
    /(?:omental\s*taenia|palatine\s*tonsil|\btonsil\b|\bspleen\b|\bthymus\b|\bliver\b|\bstomach\b|\bkidney\b|\blung\b|\bpancreas\b|\buterus\b|\bovary\b|\bovaries\b|\bfallopian\b|\bbladder\b|\bgallbladder\b|\bintestin|\bcolon\b|\bduodenum\b|\bjejunum\b|\bileum\b|\bcaecum\b|\bcecum\b|\brectum\b|\besophagus\b|\btrachea\b|\bbronch|\blarynx\b|\bpharynx\b|\bthyroid\b|\badrenal\b|\bureter\b|\bheart\b|\bprostate\b|\btestis\b|\bvagina\b)/i.test(
      normalizedJoined
    );

  if (isProtectedOrgan) {
    return false;
  }

  if (
    /(?:^|_)nodes?(?:\)|_|$)|^node_of_|^lymph_node$|\blymph|\bnodus\b|ganglion[\s_.\-]*lymphatique/i.test(
      joined
    ) ||
    /^lymph/i.test(matName)
  ) {
    return true;
  }

  const colors = getMeshMaterialColors(mesh);
  if (colors.length > 0) {
    if (
      normCoords &&
      normCoords.ny > -0.18 &&
      normCoords.ny < 0.15 &&
      normCoords.nz > 0.04 &&
      colors.some(isYellowOmentalColor)
    ) {
      return true;
    }

    if (
      boundingRadius > 0 &&
      boundingRadius < 0.018 &&
      colors.some(isGreenLymphColor)
    ) {
      return true;
    }
  }

  return false;
}

const SketchfabSystemGlbContent: React.FC<{
  entry: SketchfabManifestModel;
  onSceneReady: () => void;
}> = ({ entry, onSceneReady }) => {
  const { invalidate } = useThree();
  const gltf = useGLTF(
    resolveAssetUrl(entry.localPath),
    true,
    true,
    registerCustomGlbExtensions
  );
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);

  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const partOpacityOverrides = useAnatomyStore((s) => s.partOpacityOverrides);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);

  const lastExplodeFactorRef = useRef(0);

  const { alignedRoot, normTransform, sharedMaterials, registeredMeshes } =
    useMemo(() => {
      void ATLAS_PROCESSING_REV;
      const clone = gltf.scene.clone(true);
      if (entry.alignment.rotationEuler) {
        clone.rotation.set(...entry.alignment.rotationEuler);
      }
      clone.updateMatrixWorld(true);

      let scale: number;
      let position: [number, number, number];

      if (
        entry.alignment.useSharedOrigin &&
        typeof entry.alignment.sharedScale === 'number' &&
        Array.isArray(entry.alignment.sharedOffset)
      ) {
        scale = entry.alignment.sharedScale;
        position = [...entry.alignment.sharedOffset];
      } else {
        const rawBox = new THREE.Box3().setFromObject(clone);
        const rawSize = new THREE.Vector3();
        const rawCenter = new THREE.Vector3();
        rawBox.getSize(rawSize);
        rawBox.getCenter(rawCenter);

        const height = Math.max(rawSize.y, 1e-4);
        scale = entry.alignment.targetHeight / height;
        const [tx, ty, tz] = entry.alignment.targetCenter;
        position = [
          tx - rawCenter.x * scale,
          ty - rawCenter.y * scale,
          tz - rawCenter.z * scale,
        ];
      }

      const matCache = new Map<string, SharedSystemMaterialEntry>();
      const nonPooledMaterials: SharedSystemMaterialEntry[] = [];
      const meshes: THREE.Mesh[] = [];
      const meshWorldBox = new THREE.Box3();
      const meshWorldSphere = new THREE.Sphere();
      const rawMeshCenter = new THREE.Vector3();
      const normalizedCenter = new THREE.Vector3();
      const organBoxes = new Map<string, THREE.Box3>();
      const collected: Array<{
        mesh: THREE.Mesh;
        partIndex: number;
        hierarchyName: string;
        matName: string;
        readableName: string;
        filteredOut: boolean;
        meshSystem: AnatomicalSystem;
        organGroupId: string;
        isMaleOnly: boolean;
        isFemaleOnly: boolean;
        isMaleBladder: boolean;
        isPelvicGirdle: boolean;
        spatialBounds: {
          center: THREE.Vector3;
          maxZ: number;
          radius: number;
          system: string;
        };
      }> = [];
      let partIndex = 0;

      // Pass 1: Resolve names, enforce strict integumentary classification, build BVH, and union bounding boxes per organGroupId
      clone.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        partIndex += 1;

        if (mesh.geometry && !mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }

        meshWorldBox.setFromObject(mesh);
        meshWorldBox.getCenter(rawMeshCenter);
        normalizedCenter.set(
          rawMeshCenter.x * scale + position[0],
          rawMeshCenter.y * scale + position[1],
          rawMeshCenter.z * scale + position[2]
        );

        const normBoxEmpty = meshWorldBox.isEmpty();
        const meshNormHeight = normBoxEmpty
          ? 0
          : (meshWorldBox.max.y - meshWorldBox.min.y) * scale;
        const normRadius = normBoxEmpty
          ? 0
          : meshWorldBox.getBoundingSphere(meshWorldSphere).radius * scale;
        const normMaxZ = normBoxEmpty
          ? normalizedCenter.z
          : meshWorldBox.max.z * scale + position[2];
        const normMinY = normBoxEmpty
          ? normalizedCenter.y
          : meshWorldBox.min.y * scale + position[1];
        const normHeightCoords = {
          nx: normalizedCenter.x,
          ny: THREE.MathUtils.clamp((normalizedCenter.y - 0.9) / 0.9, -1.0, 1.0),
          nz: normalizedCenter.z,
        };

        const hierarchyName =
          resolveHierarchyName(mesh, partIndex) || mesh.name;
        const matName = getMaterialName(mesh);

        let readableName: string;
        let filteredOut = false;
        let meshSystem: AnatomicalSystem = entry.system;

        const spatialBounds = {
          center: normalizedCenter.clone(),
          minY: normMinY,
          maxZ: normMaxZ,
          radius: normRadius,
          system: meshSystem,
        };

        if (entry.alignment.useSharedOrigin) {
          // Official Z-Anatomy ZIP bundles preserve genuine anatomical names & authoritative system layers
          mesh.name = hierarchyName;
          mesh.userData.system = entry.system;
          mesh.userData.parentModelContext = entry.system;
          mesh.userData.partIndex = partIndex - 1;
          mesh.userData.__spatialBounds = spatialBounds;
          mesh.userData.__restCenter = normalizedCenter.clone();
          const parsedZ = parseAnatomicalMesh(
            mesh,
            entry.system,
            partIndex - 1
          );
          readableName = parsedZ.cleanName;
          meshSystem = entry.system;
          filteredOut =
            (entry.system === 'visceral' || meshSystem === 'visceral') &&
            isNoisyZAnatomyVisceralMesh(
              hierarchyName,
              matName,
              mesh,
              normHeightCoords,
              normRadius
            );
        } else {
          const derived = deriveSketchfabMeshDisplayName(
            hierarchyName,
            matName,
            entry,
            normalizedCenter,
            partIndex
          );
          readableName = derived.name;
          filteredOut =
            derived.filteredOut ||
            ((entry.system === 'visceral' || derived.system === 'visceral') &&
              isNoisyZAnatomyVisceralMesh(
                hierarchyName,
                matName,
                mesh,
                normHeightCoords,
                normRadius
              ));
          meshSystem = derived.system;
          const safeSlug = readableName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          mesh.name = `sketchfab_${entry.system}_${partIndex}_${safeSlug}`;
        }

        if (
          entry.system === 'integumentary' ||
          isIntegumentaryOuterShell(
            [readableName, hierarchyName],
            matName,
            entry.alignment.isFullBody ? meshNormHeight : 0
          )
        ) {
          meshSystem = 'integumentary';
          if (entry.alignment.useSharedOrigin) {
            mesh.userData.system = 'integumentary';
          }
        }
        spatialBounds.system = meshSystem;

        const organGroupId = resolveOrganGroupId(
          mesh,
          clone,
          readableName || hierarchyName,
          entry.id
        );

        if (!normBoxEmpty) {
          const prevBox = organBoxes.get(organGroupId);
          if (prevBox) {
            prevBox.union(meshWorldBox);
          } else {
            organBoxes.set(organGroupId, meshWorldBox.clone());
          }
        }

        const isMaleOnly = isMaleOnlyMesh(mesh, spatialBounds);
        const isFemaleOnly = isFemaleOnlyMesh(mesh);
        const isMaleBladder = /\burinary[\s_]+bladder\b/i.test(
          `${hierarchyName} ${organGroupId}`
        );
        const isPelvicGirdle =
          Boolean(entry.alignment.useSharedOrigin) &&
          entry.system === 'skeletal' &&
          PELVIC_GIRDLE_REGEX.test(`${hierarchyName} ${organGroupId}`);

        collected.push({
          mesh,
          partIndex,
          hierarchyName,
          matName,
          readableName,
          filteredOut,
          meshSystem,
          organGroupId,
          isMaleOnly,
          isFemaleOnly,
          isMaleBladder,
          isPelvicGirdle,
          spatialBounds,
        });
      });

      const sharedRawCenter = new THREE.Vector3();
      const sharedWorldCenter = new THREE.Vector3();

      // Pass 2: Assign rigid macro-unit explode cluster IDs and configure preserved PBR materials
      for (const item of collected) {
        const {
          mesh,
          partIndex: pIdx,
          hierarchyName,
          matName,
          readableName,
          filteredOut,
          meshSystem,
          organGroupId,
          isMaleOnly,
          isFemaleOnly,
          isMaleBladder,
          isPelvicGirdle,
          spatialBounds,
        } = item;

        if (filteredOut) {
          mesh.userData = {
            ...mesh.userData,
            anatomicalName: readableName,
            organGroupId,
            system: meshSystem,
            __isNoiseFiltered: true,
            __origRaycast: mesh.raycast,
          };
          mesh.visible = false;
          mesh.layers.disable(0);
          mesh.raycast = NOOP_RAYCAST;
          continue;
        }

        const groupBox = organBoxes.get(organGroupId);
        if (groupBox && !groupBox.isEmpty()) {
          groupBox.getCenter(sharedRawCenter);
        } else {
          meshWorldBox.setFromObject(mesh);
          meshWorldBox.getCenter(sharedRawCenter);
        }

        sharedWorldCenter.set(
          sharedRawCenter.x * scale + position[0],
          sharedRawCenter.y * scale + position[1],
          sharedRawCenter.z * scale + position[2]
        );

        const geomLocalCenter = mesh.geometry?.boundingBox
          ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3();

        const explodeClusterId = resolveExplodeClusterId(
          `${hierarchyName} ${readableName} ${organGroupId} ${matName}`,
          meshSystem,
          sharedWorldCenter
        );

        const hasVertexColors = Boolean(mesh.geometry?.getAttribute('color'));
        const tissueColor = new THREE.Color(INTERNAL_TISSUE_COLORS[meshSystem]);
        const structureHint = `${readableName} ${matName}`.trim();

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) =>
            getOrCreateSharedStandardMaterial(
              matCache,
              m,
              meshSystem,
              hasVertexColors,
              tissueColor,
              structureHint,
              false,
              8,
              nonPooledMaterials
            )
          );
        } else if (mesh.material) {
          mesh.material = getOrCreateSharedStandardMaterial(
            matCache,
            mesh.material,
            meshSystem,
            hasVertexColors,
            tissueColor,
            structureHint,
            false,
            8,
            nonPooledMaterials
          );
        }

        const isFemaleSuppressedHair =
          meshSystem === 'integumentary' &&
          Boolean(entry.alignment?.useSharedOrigin) &&
          /\b(?:hairs?[\s_]+of[\s_]+head|pubic[\s_]+hairs?)\b/i.test(
            `${mesh.name} ${readableName}`
          );

        mesh.userData = {
          ...mesh.userData,
          anatomicalName: readableName,
          organGroupId,
          system: meshSystem,
          parentModelContext: entry.system,
          partIndex: pIdx - 1,
          sketchfabUid: entry.uid,
          sketchfabTitle: entry.title,
          __isNoiseFiltered: false,
          __isMaleOnly: isMaleOnly,
          __isFemaleOnly: isFemaleOnly,
          __isMaleBladder: isMaleBladder,
          __isPelvicGirdle: isPelvicGirdle,
          __isFemaleSuppressedHair: isFemaleSuppressedHair,
          __spatialBounds: spatialBounds,
          __restPosition: mesh.position.clone(),
          __restScale: mesh.scale.clone(),
          __restCenter: sharedWorldCenter.clone(),
          __localCenter: geomLocalCenter,
          __explodeClusterId: explodeClusterId,
          __sharedMaterial: mesh.material,
          __origRaycast: mesh.raycast,
        };
        mesh.userData.__cachedPartInfo = parseAnatomicalMesh(
          mesh,
          meshSystem,
          pIdx - 1
        );

        meshes.push(mesh);
      }

      return {
        alignedRoot: clone,
        normTransform: { position, scale },
        sharedMaterials: [
          ...Array.from(matCache.values()),
          ...nonPooledMaterials,
        ],
        registeredMeshes: meshes,
      };
    }, [gltf.scene, entry]);

  useEffect(() => {
    registeredMeshes.forEach((m) => registerSceneMesh(m, registry));
    onSceneReady();
    return () => {
      registeredMeshes.forEach((m) => unregisterSceneMesh(m, registry));
      onSceneReady();
    };
  }, [alignedRoot, registeredMeshes, registry, onSceneReady]);

  useEffect(() => {
    return () => {
      registeredMeshes.forEach((mesh) => {
        const hi = mesh.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((m) => m?.dispose());
          mesh.userData.__highlightMaterial = undefined;
        }
        disposeMeshOpacityClone(mesh);
        if (mesh.userData?.__sharedMaterial) {
          mesh.material = mesh.userData.__sharedMaterial;
        }
      });
      sharedMaterials.forEach(({ mat }) => mat.dispose());
    };
  }, [registeredMeshes, sharedMaterials]);

  useEffect(() => {
    const isInternalSelection =
      selectedPart !== null && selectedPart.system !== 'integumentary';
    const sharedSliced = slicing.enabled && slicing.scope === 'all';
    const hasInternalSystemsVisible =
      activeAtlasPreset !== 'zanatomy-integumentary' &&
      (activeSystems.skeletal ||
        activeSystems.muscular ||
        activeSystems.visceral ||
        activeSystems.nervous ||
        activeSystems.cardiovascular);

    for (const { mat, system: meshSystem } of sharedMaterials) {
      const sysOpacity = systemOpacity[meshSystem] ?? 1.0;
      const skinDimFactor =
        meshSystem === 'integumentary' && isInternalSelection ? 0.48 : 1.0;

      const rawTargetOpacity = xrayGhostMode
        ? 0.08
        : THREE.MathUtils.clamp(sysOpacity * skinDimFactor, 0.04, 1.0);
      const targetOpacity =
        !xrayGhostMode &&
        biologicalSex === 'female' &&
        meshSystem === 'integumentary' &&
        Boolean(entry.alignment?.useSharedOrigin) &&
        hasInternalSystemsVisible
          ? Math.min(rawTargetOpacity, 0.45)
          : rawTargetOpacity;
      const needsTransparency = targetOpacity < 0.99;

      const origSide =
        (mat.userData?.__origSide as THREE.Side | undefined) ?? THREE.FrontSide;
      const origTransparent = Boolean(mat.userData?.__origTransparent);
      const origOpacity =
        (mat.userData?.__origOpacity as number | undefined) ?? 1;
      mat.side = sharedSliced ? THREE.DoubleSide : origSide;
      mat.shadowSide = mat.side;
      mat.clippingPlanes = sharedSliced ? clippingPlanesList : [];
      mat.clipShadows = sharedSliced;
      mat.transparent = needsTransparency || origTransparent;
      mat.opacity =
        origTransparent && targetOpacity >= 0.99
          ? origOpacity
          : targetOpacity;
      mat.depthWrite = xrayGhostMode
        ? false
        : meshSystem === 'integumentary'
          ? targetOpacity > 0.85
          : !needsTransparency;

      const baseEmissive =
        (mat.userData?.__baseEmissive as THREE.Color | undefined) ??
        ZERO_EMISSIVE_COLOR;
      const baseIntensity =
        (mat.userData?.__baseEmissiveIntensity as number | undefined) ?? 0;
      if (xrayGhostMode) {
        setMaterialEmissiveSafe(mat, GHOST_EMISSIVE_COLOR, 0.22);
      } else {
        setMaterialEmissiveSafe(mat, baseEmissive, baseIntensity);
      }
    }

    const hiddenGroupIds = new Set<string>();
    for (const hid of hiddenPartIds) {
      const hiddenMesh = getRegisteredSceneMesh(hid, hid, registry);
      const grp = hiddenMesh?.userData?.organGroupId as string | undefined;
      if (grp) hiddenGroupIds.add(grp);
    }
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId, registry)
      : null;
    const isolatedGroupId = isolatedMesh?.userData?.organGroupId as
      | string
      | undefined;

    for (const mesh of registeredMeshes) {
      const meshSystem =
        (mesh.userData?.system as AnatomicalSystem | undefined) ?? entry.system;
      const rawId = mesh.name;
      const organGroupId = mesh.userData?.organGroupId as string | undefined;
      const isFemaleSuppressedHair =
        biologicalSex === 'female' &&
        Boolean(mesh.userData?.__isFemaleSuppressedHair);

      const isHiddenForSex =
        isFemaleSuppressedHair ||
        !isMeshVisibleForSex(
          mesh,
          biologicalSex,
          mesh.userData?.__spatialBounds
        );

      const isHiddenByPeel =
        hiddenPartIds.includes(mesh.uuid) ||
        hiddenPartIds.includes(rawId) ||
        (Boolean(organGroupId) && hiddenGroupIds.has(organGroupId!));
      const isIsolatedOut =
        isolatedPartId !== null &&
        !xrayGhostMode &&
        isolatedPartId !== mesh.uuid &&
        isolatedPartId !== rawId &&
        (!isolatedGroupId || organGroupId !== isolatedGroupId);

      const isVisible =
        !isHiddenForSex &&
        activeSystems[meshSystem] &&
        !isHiddenByPeel &&
        !isIsolatedOut;
      mesh.visible = isVisible;
      const origRaycast =
        (mesh.userData?.__origRaycast as THREE.Mesh['raycast'] | undefined) ??
        THREE.Mesh.prototype.raycast;
      mesh.raycast = isVisible ? origRaycast : NOOP_RAYCAST;
      if (isVisible) {
        mesh.layers.enable(0);
        enqueueGeometryBVH(mesh.geometry);
      } else {
        mesh.layers.disable(0);
      }

      const sysOpacity = systemOpacity[meshSystem] ?? 1.0;
      const isMeshSelected =
        selectedPart?.meshUuid === mesh.uuid || selectedPart?.rawName === rawId;
      const skinDimFactor =
        meshSystem === 'integumentary' && isInternalSelection && !isMeshSelected
          ? 0.48
          : 1.0;
      const rawMeshOpacity = xrayGhostMode
        ? 0.08
        : THREE.MathUtils.clamp(sysOpacity * skinDimFactor, 0.04, 1.0);
      const targetOpacity =
        !xrayGhostMode &&
        biologicalSex === 'female' &&
        meshSystem === 'integumentary' &&
        Boolean(entry.alignment?.useSharedOrigin) &&
        hasInternalSystemsVisible
          ? Math.min(rawMeshOpacity, 0.45)
          : rawMeshOpacity;

      const baseOrder =
        meshSystem === 'integumentary' && targetOpacity < 0.98
          ? 5
          : xrayGhostMode
            ? 2
            : 0;
      const overrideOpacity = resolveMeshOpacityOverride(
        mesh,
        partOpacityOverrides
      );
      applyMeshPartOpacityOverride(mesh, overrideOpacity, baseOrder);
    }
    invalidate();
  }, [
    registeredMeshes,
    sharedMaterials,
    entry.system,
    entry.alignment?.useSharedOrigin,
    biologicalSex,
    activeAtlasPreset,
    activeSystems,
    systemOpacity,
    selectedPart,
    hiddenPartIds,
    isolatedPartId,
    partOpacityOverrides,
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
    invalidate,
  ]);

  // Apply rigid macro-unit explode offsets & female skeletal pelvic dimorphism declaratively
  useEffect(() => {
    const prevExplode = lastExplodeFactorRef.current;
    const isAtZeroExplode = explodeFactor === 0 && prevExplode === 0;
    lastExplodeFactorRef.current = explodeFactor;

    if (!isAtZeroExplode) {
      alignedRoot.parent?.updateWorldMatrix(true, false);
      alignedRoot.updateMatrixWorld(true);
    }
    const explodeCtx = { activeAtlasPreset, activeSystems };

    for (const mesh of registeredMeshes) {
      const isPelvisMesh = Boolean(mesh.userData?.__isPelvicGirdle);
      if (isAtZeroExplode && !isPelvisMesh) {
        continue;
      }

      const restPos = mesh.userData.__restPosition as THREE.Vector3 | undefined;
      const restScale = mesh.userData.__restScale as THREE.Vector3 | undefined;
      const clusterId = mesh.userData.__explodeClusterId as
        | ExplodeClusterId
        | undefined;
      const isFemalePelvis = biologicalSex === 'female' && isPelvisMesh;

      if (restScale) {
        if (isFemalePelvis) {
          mesh.scale.set(
            restScale.x * FEMALE_PELVIS_SCALE_X,
            restScale.y,
            restScale.z * FEMALE_PELVIS_SCALE_Z
          );
        } else {
          mesh.scale.copy(restScale);
        }
      }

      if (restPos) {
        applyRigidMacroExplodeOffset(
          mesh,
          clusterId,
          explodeFactor,
          restPos,
          explodeCtx,
          isFemalePelvis ? FEMALE_PELVIS_PIVOT_OFFSET : undefined
        );
      }
    }
  }, [
    alignedRoot,
    registeredMeshes,
    explodeFactor,
    biologicalSex,
    activeAtlasPreset,
    activeSystems,
  ]);

  return (
    <group
      name={`Sketchfab_System_${entry.system}`}
      position={normTransform.position}
      scale={normTransform.scale}
    >
      <primitive object={alignedRoot} />
    </group>
  );
};

const SketchfabSystemGlbNode: React.FC<{
  entry: SketchfabManifestModel;
  onSceneReady: () => void;
}> = ({ entry, onSceneReady }) => (
  <GLBErrorBoundary fallback={null}>
    <Suspense fallback={null}>
      <SketchfabSystemGlbContent entry={entry} onSceneReady={onSceneReady} />
    </Suspense>
  </GLBErrorBoundary>
);

const ExternalSpatialCalloutPin: React.FC = () => {
  const { camera } = useThree();
  const registry = useSceneMeshRegistry();

  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const showSurgicalLandmarks = useAnatomyStore((s) => s.showSurgicalLandmarks);
  const activePartLandmarks = useAnatomyStore((s) => s.activePartLandmarks);

  const selectedMeshObj = selectedPart
    ? getRegisteredSceneMesh(
        selectedPart.meshUuid,
        selectedPart.rawName,
        registry
      )
    : null;
  const selectedGroupId = selectedMeshObj?.userData?.organGroupId as
    | string
    | undefined;
  const isolatedMeshObj = isolatedPartId
    ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId, registry)
    : null;
  const isolatedGroupId = isolatedMeshObj?.userData?.organGroupId as
    | string
    | undefined;

  const isVisible =
    selectedPart !== null &&
    activeSystems[selectedPart.system] &&
    !hiddenPartIds.includes(selectedPart.meshUuid) &&
    !hiddenPartIds.includes(selectedPart.rawName) &&
    (isolatedPartId === null ||
      xrayGhostMode ||
      isolatedPartId === selectedPart.meshUuid ||
      isolatedPartId === selectedPart.rawName ||
      (Boolean(selectedGroupId) && selectedGroupId === isolatedGroupId));

  const calloutGeometry = useMemo(() => {
    if (!selectedPart || !isVisible) return null;

    const originWorld = new THREE.Vector3(...selectedPart.worldCenter);
    const localCenter = selectedMeshObj?.userData?.__localCenter as
      | THREE.Vector3
      | undefined;
    if (selectedMeshObj && localCenter) {
      selectedMeshObj.updateWorldMatrix(true, false);
      originWorld.copy(localCenter).applyMatrix4(selectedMeshObj.matrixWorld);
    }

    const partBox = new THREE.Box3();
    const sceneBandBox = new THREE.Box3();
    const tmpBox = new THREE.Box3();

    for (const mesh of registry.byUuid.values()) {
      if (
        !mesh.visible ||
        mesh.userData?.isSurgicalLandmark ||
        mesh.userData?.__isNoiseFiltered ||
        mesh.userData?.__isNoiseSubmesh ||
        mesh.userData?.__isStencilHelper
      ) {
        continue;
      }
      mesh.updateWorldMatrix(true, false);
      tmpBox.setFromObject(mesh);
      if (tmpBox.isEmpty()) continue;

      const isSelectedOrGroup =
        mesh.uuid === selectedPart.meshUuid ||
        (selectedPart.rawName && mesh.name === selectedPart.rawName) ||
        (Boolean(selectedGroupId) &&
          mesh.userData?.organGroupId === selectedGroupId);
      if (isSelectedOrGroup) {
        partBox.union(tmpBox);
      }
      if (
        tmpBox.max.y >= originWorld.y - 0.14 &&
        tmpBox.min.y <= originWorld.y + 0.14
      ) {
        sceneBandBox.union(tmpBox);
      }
    }

    if (partBox.isEmpty()) {
      partBox.setFromCenterAndSize(
        originWorld,
        new THREE.Vector3(0.08, 0.08, 0.08)
      );
    }
    const refBox = sceneBandBox.isEmpty() ? partBox : sceneBandBox;

    const side: 1 | -1 =
      Math.abs(originWorld.x) >= 0.03
        ? originWorld.x >= 0
          ? 1
          : -1
        : camera.position.x >= 0
        ? -1
        : 1;

    const outerEdgeX =
      side > 0
        ? Math.max(refBox.max.x, partBox.max.x, 0.16)
        : Math.min(refBox.min.x, partBox.min.x, -0.16);

    const cameraDist = camera.position.distanceTo(originWorld);
    const baseOutward = THREE.MathUtils.clamp(cameraDist * 0.14, 0.11, 0.22);
    const landmarkExtra = showSurgicalLandmarks ? 0.08 : 0;
    const cardX = outerEdgeX + side * (baseOutward + landmarkExtra);

    // Anti-collision vertical slot selection against nearby landmark labels
    let bestOffsetY = showSurgicalLandmarks ? 0.055 : 0.045;
    if (showSurgicalLandmarks && activePartLandmarks.length > 0) {
      const partCenterX = (partBox.min.x + partBox.max.x) * 0.5;
      const sameSideLandmarkYs = activePartLandmarks
        .filter((lm) =>
          side > 0
            ? lm.worldPosition[0] >= partCenterX
            : lm.worldPosition[0] < partCenterX
        )
        .map((lm) => lm.worldPosition[1]);

      if (sameSideLandmarkYs.length > 0) {
        const candidateOffsets = [0.055, -0.065, 0.095, -0.105, 0.02];
        let maxMinDist = -Infinity;
        for (const off of candidateOffsets) {
          const candY = originWorld.y + off;
          let minDist = Infinity;
          for (const ly of sameSideLandmarkYs) {
            minDist = Math.min(minDist, Math.abs(candY - ly));
          }
          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            bestOffsetY = off;
          }
        }
      }
    }

    const cardY = originWorld.y + bestOffsetY;
    const cardZ = Math.max(originWorld.z + 0.04, refBox.max.z + 0.02);

    const relCardX = cardX - originWorld.x;
    const relCardY = cardY - originWorld.y;
    const relCardZ = cardZ - originWorld.z;

    const elbowGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.035, relCardY, relCardZ),
      new THREE.Vector3(relCardX, relCardY, relCardZ),
    ]);
    const elbowMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.85,
    });
    const elbowLine = new THREE.Line(elbowGeom, elbowMat);

    return {
      origin: [originWorld.x, originWorld.y, originWorld.z] as [
        number,
        number,
        number
      ],
      relCard: [relCardX, relCardY, relCardZ] as [number, number, number],
      side,
      elbowLine,
    };
  }, [
    selectedPart,
    isVisible,
    selectedMeshObj,
    selectedGroupId,
    registry,
    explodeFactor,
    showSurgicalLandmarks,
    activePartLandmarks,
    camera,
  ]);

  useEffect(() => {
    return () => {
      if (calloutGeometry?.elbowLine) {
        calloutGeometry.elbowLine.geometry.dispose();
        (calloutGeometry.elbowLine.material as THREE.Material).dispose();
      }
    };
  }, [calloutGeometry]);

  if (!selectedPart || !isVisible || !calloutGeometry) return null;

  return (
    <group position={calloutGeometry.origin}>
      <primitive object={calloutGeometry.elbowLine} />
      <Html position={[0, 0, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <OriginAnchorDot />
      </Html>
      <Html
        position={calloutGeometry.relCard}
        zIndexRange={[15, 0]}
        style={{
          pointerEvents: 'none',
          transform:
            calloutGeometry.side > 0
              ? 'translate(0%, -50%)'
              : 'translate(-100%, -50%)',
        }}
      >
        <CalloutCardContent part={selectedPart} />
      </Html>
    </group>
  );
};

/**
 * Event-driven O(1) material highlight controller.
 * Lazily clones ONLY the active hovered/selected/isolated mesh's shared material
 * in a React effect (zero per-frame traversals and zero duplicate geometry Outlines).
 */
type HighlightRole = 'selected' | 'hover' | 'isolated';

function getHighlightRoleState(role: HighlightRole): 0 | 1 | 2 {
  if (role === 'selected') return 2;
  if (role === 'hover') return 1;
  return 0;
}

function syncPooledHighlightMaterial(
  target: THREE.Material,
  srcMat: THREE.Material,
  role: HighlightRole,
  focusOverride: boolean,
  isMeshSliced: boolean,
  clippingPlanesList: THREE.Plane[],
  overrideOpacity?: number
): void {
  setClinicalHighlightState(target, getHighlightRoleState(role));

  if (focusOverride) {
    target.opacity = 1.0;
    target.transparent = false;
    target.depthWrite = true;
  } else if (overrideOpacity !== undefined && overrideOpacity < 0.99) {
    target.opacity = overrideOpacity;
    target.transparent = true;
    target.depthWrite = overrideOpacity >= 0.85;
  } else {
    target.opacity = srcMat.opacity;
    target.transparent = srcMat.transparent;
    target.depthWrite = srcMat.depthWrite;
  }

  const origSide =
    (srcMat.userData?.__origSide as THREE.Side | undefined) ?? THREE.FrontSide;
  target.side = isMeshSliced ? THREE.DoubleSide : origSide;
  target.shadowSide = target.side;
  target.clippingPlanes = isMeshSliced ? clippingPlanesList : null;
  target.clipShadows = isMeshSliced;
}

const MeshHighlightController: React.FC<{ nihCatalogTick: number }> = ({
  nihCatalogTick,
}) => {
  const { invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);
  const hoveredPart = useAnatomyStore((s) => s.hoveredPart);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const partOpacityOverrides = useAnatomyStore((s) => s.partOpacityOverrides);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const showSurgicalLandmarks = useAnatomyStore(
    (s) => s.showSurgicalLandmarks
  );
  const slicingEnabled = useAnatomyStore((s) => s.slicing.enabled);
  const slicingScope = useAnatomyStore((s) => s.slicing.scope);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);

  const highlightedMeshesRef = useRef<Set<THREE.Mesh>>(new Set());
  const highlightPoolRef = useRef<Map<string, THREE.Material>>(new Map());
  const groupIndexRef = useRef<{
    version: number;
    byGroup: Map<string, THREE.Mesh[]>;
  }>({ version: -1, byGroup: new Map() });

  const restoreAllHighlightedMeshes = useCallback(() => {
    if (highlightedMeshesRef.current.size === 0) return;
    for (const mesh of highlightedMeshesRef.current) {
      mesh.material = getMeshNonHighlightMaterial(mesh);
      mesh.userData.__highlightMaterial = undefined;
    }
    highlightedMeshesRef.current.clear();
  }, []);

  // Dispose pooled highlight clones only on unmount or when switching models/presets
  // so hovering/selecting never reallocates or recompiles materials per interaction.
  useEffect(() => {
    return () => {
      restoreAllHighlightedMeshes();
      for (const pooled of highlightPoolRef.current.values()) {
        pooled.dispose();
      }
      highlightPoolRef.current.clear();
    };
  }, [customGlbUrl, activeAtlasPreset, restoreAllHighlightedMeshes]);

  useEffect(() => {
    void nihCatalogTick;
    void activeSystems;
    void systemOpacity;
    void hiddenPartIds;
    void biologicalSex;
    void anatomicalCatalog;
    void showSurgicalLandmarks;

    restoreAllHighlightedMeshes();

    const selectedMesh = selectedPart
      ? getRegisteredSceneMesh(selectedPart.meshUuid, selectedPart.rawName, registry)
      : null;
    const hoveredMesh = hoveredPart
      ? getRegisteredSceneMesh(hoveredPart.meshUuid, hoveredPart.rawName, registry)
      : null;
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId, registry)
      : null;

    if (!selectedMesh && !hoveredMesh && !isolatedMesh) {
      invalidate();
      return restoreAllHighlightedMeshes;
    }

    if (groupIndexRef.current.version !== registry.version) {
      const nextByGroup = new Map<string, THREE.Mesh[]>();
      for (const m of registry.byUuid.values()) {
        const grp = m.userData?.organGroupId as string | undefined;
        if (!grp) continue;
        let bucket = nextByGroup.get(grp);
        if (!bucket) {
          bucket = [];
          nextByGroup.set(grp, bucket);
        }
        bucket.push(m);
      }
      groupIndexRef.current = {
        version: registry.version,
        byGroup: nextByGroup,
      };
    }

    const collectGroupSiblings = (anchor: THREE.Mesh | null): THREE.Mesh[] => {
      if (!anchor || !anchor.visible) return [];
      const grp = anchor.userData?.organGroupId as string | undefined;
      if (!grp) return [anchor];
      const bucket = groupIndexRef.current.byGroup.get(grp);
      if (!bucket || bucket.length === 0) return [anchor];
      const matches: THREE.Mesh[] = [];
      for (let i = 0; i < bucket.length; i++) {
        const m = bucket[i];
        if (m.visible) matches.push(m);
      }
      return matches.length > 0 ? matches : [anchor];
    };

    const targets: { mesh: THREE.Mesh; role: HighlightRole }[] = [];
    const queuedSet = new Set<THREE.Mesh>();

    for (const m of collectGroupSiblings(selectedMesh)) {
      queuedSet.add(m);
      targets.push({ mesh: m, role: 'selected' });
    }
    for (const m of collectGroupSiblings(hoveredMesh)) {
      if (!queuedSet.has(m)) {
        queuedSet.add(m);
        targets.push({ mesh: m, role: 'hover' });
      }
    }
    if (xrayGhostMode || (slicingEnabled && slicingScope === 'selected')) {
      for (const m of collectGroupSiblings(isolatedMesh)) {
        if (!queuedSet.has(m)) {
          queuedSet.add(m);
          targets.push({ mesh: m, role: 'isolated' });
        }
      }
    }

    for (const { mesh, role } of targets) {
      const shared = getMeshNonHighlightMaterial(mesh);
      if (!shared) continue;

      const overrideOpacity = resolveMeshOpacityOverride(
        mesh,
        partOpacityOverrides
      );
      const isFocusTarget =
        isolatedMesh !== null ? mesh === isolatedMesh : mesh === selectedMesh;
      const focusOverride = Boolean(xrayGhostMode && isFocusTarget);
      const isMeshSliced =
        slicingEnabled &&
        (slicingScope === 'all' ||
          mesh === selectedMesh ||
          mesh === isolatedMesh);

      const getPooledMaterial = (srcMat: THREE.Material): THREE.Material => {
        const poolKey = `${srcMat.uuid}::${role}::${focusOverride ? 1 : 0}::${isMeshSliced ? 1 : 0}::${
          overrideOpacity !== undefined && overrideOpacity < 0.99
            ? overrideOpacity.toFixed(2)
            : '1.00'
        }`;
        let pooled = highlightPoolRef.current.get(poolKey);
        if (!pooled) {
          pooled = cloneClinicalHighlightMaterial(srcMat);
          highlightPoolRef.current.set(poolKey, pooled);
        }
        syncPooledHighlightMaterial(
          pooled,
          srcMat,
          role,
          focusOverride,
          isMeshSliced,
          clippingPlanesList,
          overrideOpacity
        );
        return pooled;
      };

      const nextMat = Array.isArray(shared)
        ? shared.map(getPooledMaterial)
        : getPooledMaterial(shared);

      mesh.material = nextMat;
      mesh.userData.__highlightMaterial = nextMat;
      if (overrideOpacity !== undefined && overrideOpacity < 0.99 && !focusOverride) {
        mesh.renderOrder = 25;
      }
      highlightedMeshesRef.current.add(mesh);
    }

    invalidate();
    return restoreAllHighlightedMeshes;
  }, [
    hoveredPart,
    selectedPart,
    activeSystems,
    systemOpacity,
    hiddenPartIds,
    isolatedPartId,
    partOpacityOverrides,
    xrayGhostMode,
    slicingEnabled,
    slicingScope,
    biologicalSex,
    customGlbUrl,
    activeAtlasPreset,
    anatomicalCatalog,
    nihCatalogTick,
    registry,
    clippingPlanesList,
    invalidate,
    restoreAllHighlightedMeshes,
  ]);

  return null;
};

/**
 * Zero-overhead pure DOM click + throttled BVH hover raycaster attached to `gl.domElement`.
 * Keeps `@react-three/fiber`'s `internal.interaction` array at length 0 so orbit dragging
 * and pointer movement incur zero synchronous per-frame scene traversals.
 */
const HOVER_RAYCAST_THROTTLE_MS = 55;

function isGeometryHoverReady(geom: THREE.BufferGeometry | undefined): boolean {
  if (!geom) return false;
  if ((geom as THREE.BufferGeometry & { boundsTree?: unknown }).boundsTree) {
    return true;
  }
  // Small meshes (< ~1,000 tris) raycast in <0.15ms even before idle BVH finishes.
  if (geom.index) return geom.index.count <= 3000;
  return (geom.attributes?.position?.count ?? Infinity) <= 3000;
}

const NativeCanvasClickPicker: React.FC = () => {
  const { gl, camera, raycaster } = useThree();
  const registry = useSceneMeshRegistry();
  const storeApi = useAnatomyStoreApi();
  const ndcRef = useRef(new THREE.Vector2());

  useEffect(() => {
    const canvas = gl.domElement;
    let downPos: {
      x: number;
      y: number;
      time: number;
      pointerId: number;
    } | null = null;
    let lastClick: { x: number; y: number; time: number } | null = null;

    let visibleMeshes: THREE.Mesh[] = [];
    let hoverReadyMeshes: THREE.Mesh[] = [];
    let hoverPendingMeshes: THREE.Mesh[] = [];
    let meshesDirty = true;
    let lastRegistryVersion = -1;
    let dirtyRafId: number | null = null;

    let hoverTimerId: number | null = null;
    let lastHoverTime = 0;
    let latestHoverClient: { x: number; y: number } | null = null;

    const clearPendingHover = () => {
      if (hoverTimerId !== null) {
        window.clearTimeout(hoverTimerId);
        hoverTimerId = null;
      }
      latestHoverClient = null;
    };

    const setCanvasCursor = (nextCursor: 'pointer' | 'auto') => {
      if (canvas.style.cursor !== nextCursor) {
        canvas.style.cursor = nextCursor;
      }
    };

    const isHierarchyVisible = (obj: THREE.Object3D): boolean => {
      let curr: THREE.Object3D | null = obj;
      while (curr) {
        if (!curr.visible) return false;
        curr = curr.parent;
      }
      return true;
    };

    const resolveMeshPartInfo = (mesh: THREE.Mesh): AnatomicalPartInfo => {
      const existing =
        (mesh.userData?.partInfo as AnatomicalPartInfo | undefined) ??
        (mesh.userData?.__cachedPartInfo as AnatomicalPartInfo | undefined);
      if (existing) return existing;
      const computed = parseAnatomicalMesh(mesh);
      mesh.userData.__cachedPartInfo = computed;
      return computed;
    };

    const promotePendingHoverMeshes = () => {
      for (let i = hoverPendingMeshes.length - 1; i >= 0; i--) {
        const mesh = hoverPendingMeshes[i];
        if (isGeometryHoverReady(mesh.geometry)) {
          hoverReadyMeshes.push(mesh);
          const lastIdx = hoverPendingMeshes.length - 1;
          if (i !== lastIdx) {
            hoverPendingMeshes[i] = hoverPendingMeshes[lastIdx];
          }
          hoverPendingMeshes.pop();
        }
      }
    };

    const ensureMeshCaches = () => {
      if (meshesDirty || registry.version !== lastRegistryVersion) {
        visibleMeshes = [];
        hoverReadyMeshes = [];
        hoverPendingMeshes = [];

        for (const mesh of registry.byUuid.values()) {
          if (
            mesh.visible &&
            !mesh.userData?.__isNoiseFiltered &&
            !mesh.userData?.__isNoiseSubmesh &&
            !mesh.userData?.__isStencilHelper &&
            isHierarchyVisible(mesh)
          ) {
            visibleMeshes.push(mesh);
            if (isGeometryHoverReady(mesh.geometry)) {
              hoverReadyMeshes.push(mesh);
            } else {
              hoverPendingMeshes.push(mesh);
            }
          }
        }

        lastRegistryVersion = registry.version;
        meshesDirty = false;
        return;
      }

      if (hoverPendingMeshes.length > 0) {
        promotePendingHoverMeshes();
      }
    };

    const unsubscribeStore = storeApi.subscribe((state, prev) => {
      if (
        state.activeSystems === prev.activeSystems &&
        state.hiddenPartIds === prev.hiddenPartIds &&
        state.isolatedPartId === prev.isolatedPartId &&
        state.biologicalSex === prev.biologicalSex &&
        state.customGlbUrl === prev.customGlbUrl &&
        state.activeAtlasPreset === prev.activeAtlasPreset &&
        state.systemOpacity === prev.systemOpacity &&
        state.anatomicalCatalog === prev.anatomicalCatalog
      ) {
        return;
      }
      meshesDirty = true;
      if (dirtyRafId === null) {
        // Re-mark dirty after React visibility effects finish mutating `mesh.visible`.
        dirtyRafId = window.requestAnimationFrame(() => {
          dirtyRafId = null;
          meshesDirty = true;
        });
      }
    });

    const runHoverRaycast = () => {
      hoverTimerId = null;
      const point = latestHoverClient;
      latestHoverClient = null;
      if (!point) return;

      if (
        downPos !== null ||
        cameraInteractionState.isOrbiting ||
        !canvas.isConnected
      ) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        point.x < rect.left ||
        point.x > rect.right ||
        point.y < rect.top ||
        point.y > rect.bottom
      ) {
        return;
      }

      lastHoverTime = performance.now();
      ensureMeshCaches();

      const state = storeApi.getState();
      if (hoverReadyMeshes.length === 0) {
        setCanvasCursor('auto');
        if (state.hoveredPart !== null) {
          state.setHoveredPart(null);
        }
        return;
      }

      ndcRef.current.set(
        ((point.x - rect.left) / rect.width) * 2 - 1,
        -((point.y - rect.top) / rect.height) * 2 + 1
      );

      (
        raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
      ).firstHitOnly = true;
      raycaster.setFromCamera(ndcRef.current, camera);

      const hits = raycaster.intersectObjects(hoverReadyMeshes, false);
      if (hits.length === 0) {
        setCanvasCursor('auto');
        if (state.hoveredPart !== null) {
          state.setHoveredPart(null);
        }
        return;
      }

      const hitMesh = hits[0].object as THREE.Mesh;
      const partInfo = resolveMeshPartInfo(hitMesh);
      setCanvasCursor('pointer');

      if (
        state.hoveredPart?.meshUuid !== partInfo.meshUuid ||
        state.isTouchInteraction
      ) {
        state.setHoveredPart(partInfo, { x: point.x, y: point.y }, false);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      clearPendingHover();
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      downPos = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
        pointerId: e.pointerId,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (
        e.buttons !== 0 ||
        downPos !== null ||
        cameraInteractionState.isOrbiting
      ) {
        clearPendingHover();
        setCanvasCursor('auto');
        return;
      }

      latestHoverClient = { x: e.clientX, y: e.clientY };
      if (hoverTimerId !== null) return;

      const elapsed = performance.now() - lastHoverTime;
      if (elapsed >= HOVER_RAYCAST_THROTTLE_MS) {
        runHoverRaycast();
      } else {
        hoverTimerId = window.setTimeout(
          runHoverRaycast,
          HOVER_RAYCAST_THROTTLE_MS - elapsed
        );
      }
    };

    const onPointerLeave = () => {
      clearPendingHover();
      setCanvasCursor('auto');
      const state = storeApi.getState();
      if (state.hoveredPart !== null) {
        state.setHoveredPart(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!downPos || e.pointerId !== downPos.pointerId) return;
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      const elapsed = performance.now() - downPos.time;
      downPos = null;
      if (dist >= 5 || elapsed >= 400) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      ndcRef.current.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      (
        raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
      ).firstHitOnly = true;
      raycaster.setFromCamera(ndcRef.current, camera);

      ensureMeshCaches();

      if (visibleMeshes.length === 0) {
        lastClick = null;
        storeApi.getState().selectPart(null);
        return;
      }

      const hits = raycaster.intersectObjects(visibleMeshes, false);
      const now = performance.now();

      if (hits.length === 0) {
        lastClick = null;
        storeApi.getState().selectPart(null);
        return;
      }

      const hitMesh = hits[0].object as THREE.Mesh;
      const partInfo = resolveMeshPartInfo(hitMesh);

      const isDoubleClick =
        lastClick !== null &&
        now - lastClick.time < 320 &&
        Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 10;

      lastClick = isDoubleClick
        ? null
        : { x: e.clientX, y: e.clientY, time: now };

      const state = storeApi.getState();
      state.selectPart(partInfo);
      if (isDoubleClick) {
        state.focusSelectedPart();
      }
    };

    const onPointerCancel = () => {
      downPos = null;
      clearPendingHover();
      setCanvasCursor('auto');
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerCancel, {
      passive: true,
    });

    return () => {
      unsubscribeStore();
      if (dirtyRafId !== null) {
        window.cancelAnimationFrame(dirtyRafId);
        dirtyRafId = null;
      }
      clearPendingHover();
      setCanvasCursor('auto');
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [gl, camera, raycaster, registry, storeApi]);

  return null;
};

export const AnatomicalModelManager: React.FC = () => {
  const registry = useSceneMeshRegistry();
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const registerCatalog = useAnatomyStore((s) => s.registerCatalog);
  const loadCustomGlb = useAnatomyStore((s) => s.loadCustomGlb);
  const activeAtlasPreset: OfficialAtlasPresetId = useAnatomyStore(
    (s) => s.activeAtlasPreset
  );

  const atlasAssemblyGroupRef = useRef<THREE.Group>(null);
  const nihRootGroupRef = useRef<THREE.Group>(null);
  const [nihSceneCatalog, setNihSceneCatalog] = useState<Record<
    BiologicalSex,
    NihOrganSceneItem[]
  > | null>(null);
  const [sketchfabModels, setSketchfabModels] = useState<
    SketchfabManifestModel[]
  >([]);

  const skinBoxBySexRef = useRef<Partial<Record<BiologicalSex, THREE.Box3>>>(
    {}
  );
  const [skinBoxesBySex, setSkinBoxesBySex] = useState<
    Partial<Record<BiologicalSex, THREE.Box3>>
  >({});
  const catalogRebuildTimerRef = useRef<number | null>(null);
  const [nihCatalogTick, setNihCatalogTick] = useState(0);
  const [femaleSupplementWarm, setFemaleSupplementWarm] = useState(
    () => biologicalSex === 'female'
  );

  // Lazy-mount the female organ overlay ONLY once the user actually switches to
  // Female mode; once warm it stays mounted (hidden in Male mode) for instant re-entry
  // without loading/anchoring 7 female GLBs on initial Male startup.
  useEffect(() => {
    if (biologicalSex === 'female') {
      setFemaleSupplementWarm(true);
    }
  }, [biologicalSex]);

  useEffect(() => {
    let cancelled = false;
    fetchNihSceneOrgans()
      .then((catalog) => {
        if (!cancelled) {
          setNihSceneCatalog(catalog);
        }
      })
      .catch(() => {
        // Fallback catalog resolution is already handled inside nihSceneService
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(resolveAssetUrl('/models/zanatomy/manifest.json?v=zanatomy-v4'), {
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SketchfabManifestResponse>;
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.models)) {
          setSketchfabModels(data.models);
        }
      })
      .catch(() => {
        // Manifest missing or unavailable; falls back cleanly to NIH HRA catalog if selected
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleCatalogRefresh = useCallback(() => {
    if (catalogRebuildTimerRef.current !== null) {
      window.clearTimeout(catalogRebuildTimerRef.current);
    }
    catalogRebuildTimerRef.current = window.setTimeout(() => {
      catalogRebuildTimerRef.current = null;
      setNihCatalogTick((v) => v + 1);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
      if (catalogRebuildTimerRef.current !== null) {
        window.clearTimeout(catalogRebuildTimerRef.current);
      }
    };
  }, []);

  const handleNihOrganMounted = useCallback(
    (entry: NihOrganSceneItem, scene: THREE.Object3D) => {
      if (
        entry.organKey === 'skin' ||
        entry.id.startsWith('skin-') ||
        entry.system === 'integumentary'
      ) {
        const measuredBox = computeSubtreeLocalBox(scene, entry.placement);
        if (!measuredBox.isEmpty()) {
          const prevBox = skinBoxBySexRef.current[entry.sex];
          const changedSignificantly =
            !prevBox ||
            prevBox.min.distanceToSquared(measuredBox.min) > 1e-6 ||
            prevBox.max.distanceToSquared(measuredBox.max) > 1e-6;
          if (changedSignificantly) {
            skinBoxBySexRef.current[entry.sex] = measuredBox;
            setSkinBoxesBySex((prev) => ({
              ...prev,
              [entry.sex]: measuredBox,
            }));
          }
        }
      }
      scheduleCatalogRefresh();
    },
    [scheduleCatalogRefresh]
  );

  const handleNihOrganUnmounted = useCallback(
    (_organId: string) => {
      scheduleCatalogRefresh();
    },
    [scheduleCatalogRefresh]
  );

  const activeNihOrgans = useMemo(() => {
    return nihSceneCatalog?.[biologicalSex] ?? [];
  }, [nihSceneCatalog, biologicalSex]);

  const activeSkinBox = skinBoxesBySex[biologicalSex] ?? null;
  const rootTransform: NihBodyNormalizationTransform = useMemo(
    () => computeBodyNormalizationTransform(activeSkinBox, biologicalSex),
    [activeSkinBox, biologicalSex]
  );

  // Automatically index live streamed/cached Z-Anatomy & NIH anatomical meshes into Omni-Search catalog
  // using pre-cached mesh metadata + O(1) sex flags so MALE <-> FEMALE switching takes < 1ms.
  const canMountFemaleZAnatomyOverlay =
    activeAtlasPreset === 'zanatomy-full-body' ||
    activeAtlasPreset === 'zanatomy-visceral';
  const showFemaleZAnatomyOrgans =
    biologicalSex === 'female' &&
    activeSystems.visceral &&
    canMountFemaleZAnatomyOverlay;

  useEffect(() => {
    if (customGlbUrl || registry.byUuid.size === 0) return;

    const parts: AnatomicalPartInfo[] = [];
    for (const mesh of registry.byUuid.values()) {
      if (
        mesh.userData?.__isStencilHelper ||
        mesh.userData?.__isNoiseFiltered ||
        mesh.userData?.__isNoiseSubmesh ||
        !mesh.name
      ) {
        continue;
      }
      if (
        mesh.userData?.__isFemaleZAnatomySupplement &&
        !showFemaleZAnatomyOrgans
      ) {
        continue;
      }
      if (
        biologicalSex === 'female' &&
        mesh.userData?.__isFemaleSuppressedHair
      ) {
        continue;
      }
      if (!isMeshVisibleForSex(mesh, biologicalSex)) continue;
      const parsed =
        (mesh.userData?.partInfo as AnatomicalPartInfo | undefined) ??
        (mesh.userData?.__cachedPartInfo as AnatomicalPartInfo | undefined) ??
        (() => {
          const computed = parseAnatomicalMesh(mesh);
          mesh.userData.__cachedPartInfo = computed;
          return computed;
        })();
      parts.push(parsed);
    }
    if (parts.length > 0 || nihCatalogTick > 0) {
      registerCatalog(parts);
    }
  }, [
    customGlbUrl,
    activeAtlasPreset,
    biologicalSex,
    nihCatalogTick,
    showFemaleZAnatomyOrgans,
    rootTransform,
    registerCatalog,
    registry,
  ]);

  const handleFemaleCatalogUpdated = useCallback(() => {
    setNihCatalogTick((v) => v + 1);
  }, []);

  const handleCustomGlbError = useCallback(
    (err: Error) => {
      window.dispatchEvent(
        new CustomEvent('aoa:glb-error', {
          detail: err?.message || 'Failed to parse custom .glb model',
        })
      );
      loadCustomGlb(null);
    },
    [loadCustomGlb]
  );

  // Strictly isolate Z-Anatomy coordinate space from NIH Visible Human coordinate space.
  const activeSketchfabModels = useMemo(() => {
    if (activeAtlasPreset === 'nih-visible-human') {
      return [];
    }
    const canMountZAnatomyModel = (m: SketchfabManifestModel) =>
      !(m.system === 'integumentary' && !activeSystems.integumentary);

    if (activeAtlasPreset === 'zanatomy-full-body') {
      return sketchfabModels.filter(
        (m) => activeSystems[m.system] && canMountZAnatomyModel(m)
      );
    }
    if (
      activeAtlasPreset === 'zanatomy-integumentary' &&
      !activeSystems.integumentary
    ) {
      return [];
    }
    const matched = sketchfabModels.find((m) => m.id === activeAtlasPreset);
    if (matched) {
      return canMountZAnatomyModel(matched) ? [matched] : [];
    }
    const fallback = sketchfabModels.find(canMountZAnatomyModel);
    return fallback ? [fallback] : [];
  }, [activeAtlasPreset, activeSystems, sketchfabModels]);

  // Mount NIH Visible Human organs strictly in the standalone `nih-visible-human` preset.
  const displayedNihOrgans = useMemo(() => {
    return activeAtlasPreset === 'nih-visible-human' ? activeNihOrgans : [];
  }, [activeAtlasPreset, activeNihOrgans]);

  // Pre-mount the 7 authentic NIH female pelvic & mammary organs once per Z-Anatomy session
  // and toggle only their group/mesh visibility (<1ms) so switching MALE <-> FEMALE never freezes.
  const allFemaleNihOrgans = useMemo(() => {
    return nihSceneCatalog?.female ?? [];
  }, [nihSceneCatalog]);

  const builtInAtlasContent = (
    <group
      ref={atlasAssemblyGroupRef}
      name={`Human_Body_Assembly_${activeAtlasPreset}_${biologicalSex}`}
    >
      {activeSketchfabModels.map((entry) => (
        <SketchfabSystemGlbNode
          key={entry.id}
          entry={entry}
          onSceneReady={scheduleCatalogRefresh}
        />
      ))}
      {displayedNihOrgans.length > 0 && (
        <group
          ref={nihRootGroupRef}
          name={`NIH_Visible_Human_${biologicalSex}`}
          position={rootTransform.position}
          scale={rootTransform.scale}
        >
          {displayedNihOrgans.map((entry) => (
            <NihOrganStreamNode
              key={entry.id}
              entry={entry}
              onOrganMounted={handleNihOrganMounted}
              onOrganUnmounted={handleNihOrganUnmounted}
            />
          ))}
        </group>
      )}
      {canMountFemaleZAnatomyOverlay &&
        (femaleSupplementWarm || showFemaleZAnatomyOrgans) && (
          <FemaleZAnatomyOrgansGroup
            visible={showFemaleZAnatomyOrgans}
            nihOrgans={allFemaleNihOrgans}
            atlasAssemblyGroupRef={atlasAssemblyGroupRef}
            onCatalogUpdated={handleFemaleCatalogUpdated}
          />
        )}
      <UniversalLandmarksLayer
        nihCatalog={nihSceneCatalog}
        catalogTick={nihCatalogTick}
        modelContext="master-atlas"
      />
    </group>
  );

  return (
    <group name="Anatomical_Atlas_Root">
      {customGlbUrl ? (
        <GLBErrorBoundary
          key={customGlbUrl}
          fallback={builtInAtlasContent}
          onError={handleCustomGlbError}
        >
          <Suspense fallback={null}>
            <CustomGlbModel url={customGlbUrl} />
          </Suspense>
        </GLBErrorBoundary>
      ) : (
        builtInAtlasContent
      )}
      <NativeCanvasClickPicker />
      <MeshHighlightController nihCatalogTick={nihCatalogTick} />
      <ExternalSpatialCalloutPin />
      <SlicingPlaneGizmo />
    </group>
  );
};
