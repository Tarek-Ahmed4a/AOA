import React, {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  cameraInteractionState,
  useAnatomyStore,
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
  sceneMeshByUuid,
  unregisterSceneMesh,
} from '../../utils/bvhSetup';
import {
  ACTIVE_CLIPPING_PLANE,
  INTERNAL_TISSUE_COLORS,
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
  setClinicalDimFactor,
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
  type SharedSystemMaterialEntry,
} from './NihManifestOrgan';
import { SlicingPlaneGizmo } from './SlicingPlaneGizmo';
import {
  isFemaleOnlyMesh,
  isMaleOnlyMesh,
  isMeshVisibleForSex,
  isPartVisibleForSex,
} from '../../utils/sexDimorphismFilter';

// Configure Draco decoder to Google's official versioned CDN for Phase 2+ high-density GLBs
useGLTF.setDecoderPath(
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
);

const CLIPPING_PLANES_LIST: THREE.Plane[] = [ACTIVE_CLIPPING_PLANE];
const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

const CalloutCardContent: React.FC<{ part: AnatomicalPartInfo }> = ({ part }) => (
  <div className="pointer-events-none relative select-none">
    <span className="absolute -left-1.5 -top-1.5 flex h-3 w-3 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full border border-white/80 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.95)]" />
    </span>

    <svg
      width="36"
      height="28"
      viewBox="0 0 36 28"
      className="absolute left-0 -top-7 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points="0,28 16,8 36,8"
        fill="none"
        stroke="rgba(56, 189, 248, 0.75)"
        strokeWidth="1.25"
      />
    </svg>

    <div className="ml-9 -mt-12 min-w-[170px] max-w-[240px] rounded-lg border border-sky-400/35 bg-zinc-950/90 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md">
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

const CustomGlbModel: React.FC<{ url: string }> = ({ url }) => {
  const resolvedUrl = resolveAssetUrl(url);
  const gltf = useGLTF(resolvedUrl);

  const customGlbName = useAnatomyStore((s) => s.customGlbName);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);

  const selectPart = useAnatomyStore((s) => s.selectPart);
  const setHoveredPart = useAnatomyStore((s) => s.setHoveredPart);
  const focusSelectedPart = useAnatomyStore((s) => s.focusSelectedPart);
  const registerCatalog = useAnatomyStore((s) => s.registerCatalog);

  const lastHoverTimestampRef = useRef(0);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stencilGroupRef = useRef<THREE.Group>(null);
  const tempPosRef = useRef(new THREE.Vector3());
  const tempQuatRef = useRef(new THREE.Quaternion());
  const tempScaleRef = useRef(new THREE.Vector3());

  const { clonedScene, catalogParts, sharedMaterials, registeredMeshes } =
    useMemo(() => {
      const clone = gltf.scene.clone(true);
      clone.updateMatrixWorld(true);

      // Preserve anatomical proportions: full-body GLBs scale to 1.76m height centered at Y=0.9,
      // while isolated regional organs fit comfortably at 0.78m max dimension centered at Y=1.0.
      const overallBox = new THREE.Box3().setFromObject(clone);
      if (!overallBox.isEmpty()) {
        const size = new THREE.Vector3();
        overallBox.getSize(size);
        const horizMax = Math.max(size.x, size.z, 1e-4);
        const isFullBodyAspect = size.y / horizMax > 2.1;
        const targetDim = isFullBodyAspect ? 1.76 : 0.78;
        const refDim = isFullBodyAspect
          ? Math.max(size.y, 1e-4)
          : Math.max(size.y, size.x, size.z, 1e-4);
        const uniformScale = targetDim / refDim;
        clone.scale.multiplyScalar(uniformScale);
        clone.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(clone);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        const targetCenterY = isFullBodyAspect ? 0.9 : 1.0;
        clone.position.add(
          new THREE.Vector3(
            0 - scaledCenter.x,
            targetCenterY - scaledCenter.y,
            0 - scaledCenter.z
          )
        );
        clone.updateMatrixWorld(true);
      }

      void ATLAS_PROCESSING_REV;
      const parts: AnatomicalPartInfo[] = [];
      const seenRawNames = new Map<string, number>();
      const matCache = new Map<string, SharedSystemMaterialEntry>();
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

        if (mesh.geometry) {
          if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox();
          }
          enqueueGeometryBVH(mesh.geometry);
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

        const configureMaterial = (
          m: THREE.Material
        ): THREE.MeshStandardMaterial =>
          getOrCreateSharedStandardMaterial(
            matCache,
            m,
            parsed.system,
            hasVertexColors,
            tissueColor,
            parsed.cleanName
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
        sharedMaterials: Array.from(matCache.values()),
        registeredMeshes: meshes,
      };
    }, [gltf.scene, customGlbName]);

  useEffect(() => {
    registeredMeshes.forEach(registerSceneMesh);
    return () => {
      registeredMeshes.forEach(unregisterSceneMesh);
    };
  }, [registeredMeshes]);

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

  // Resolve active stencil target mesh when isolated or selected slicing is active
  const stencilTargetInfo = useMemo(() => {
    if (!slicing.enabled) return null;

    let candidate: THREE.Mesh | null = null;
    for (const mesh of registeredMeshes) {
      const isMatch =
        (isolatedPartId !== null &&
          (mesh.uuid === isolatedPartId || mesh.name === isolatedPartId)) ||
        (slicing.scope === 'selected' &&
          selectedPart &&
          (selectedPart.meshUuid === mesh.uuid ||
            selectedPart.rawName === mesh.name));
      if (isMatch) {
        candidate = mesh;
        break;
      }
    }

    if (!candidate) return null;
    const targetMesh = candidate;
    const sys = (targetMesh.userData?.system as AnatomicalSystem) ?? 'visceral';
    const isHidden =
      hiddenPartIds.includes(targetMesh.uuid) ||
      hiddenPartIds.includes(targetMesh.name);
    const isIsolatedOut =
      isolatedPartId !== null &&
      !xrayGhostMode &&
      isolatedPartId !== targetMesh.uuid &&
      isolatedPartId !== targetMesh.name;
    const isFocusTarget =
      isolatedPartId !== null
        ? isolatedPartId === targetMesh.uuid ||
          isolatedPartId === targetMesh.name
        : selectedPart !== null &&
          (selectedPart.meshUuid === targetMesh.uuid ||
            selectedPart.rawName === targetMesh.name);
    const isGhost = xrayGhostMode && !isFocusTarget;

    const visible =
      activeSystems[sys] &&
      !isHidden &&
      !isIsolatedOut &&
      !isGhost &&
      systemOpacity[sys] >= 0.99;

    if (!visible || !targetMesh.geometry) return null;
    return targetMesh;
  }, [
    registeredMeshes,
    slicing.enabled,
    slicing.scope,
    isolatedPartId,
    selectedPart,
    hiddenPartIds,
    xrayGhostMode,
    activeSystems,
    systemOpacity,
  ]);

  // Apply rigid macro-unit explode offsets & sync stencil transform declaratively
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

    if (stencilTargetInfo && stencilGroupRef.current) {
      stencilTargetInfo.updateWorldMatrix(true, false);
      stencilTargetInfo.matrixWorld.decompose(
        tempPosRef.current,
        tempQuatRef.current,
        tempScaleRef.current
      );
      stencilGroupRef.current.position.copy(tempPosRef.current);
      stencilGroupRef.current.quaternion.copy(tempQuatRef.current);
      stencilGroupRef.current.scale.copy(tempScaleRef.current);
    }
  }, [
    clonedScene,
    registeredMeshes,
    explodeFactor,
    activeAtlasPreset,
    activeSystems,
    stencilTargetInfo,
  ]);

  useEffect(() => {
    const isInternalSelection =
      selectedPart !== null && selectedPart.system !== 'integumentary';
    const backgroundDimFactor = selectedPart !== null ? 0.8 : 1.0;
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

      mat.clippingPlanes = sharedSliced ? CLIPPING_PLANES_LIST : null;
      mat.clipShadows = sharedSliced;
      mat.side = THREE.DoubleSide;
      mat.transparent = effectiveTransparent;
      mat.opacity = effectiveOpacity;
      mat.depthWrite = effectiveDepthWrite;
      setClinicalDimFactor(mat, backgroundDimFactor);

      const baseEmissive =
        (mat.userData?.__baseEmissive as THREE.Color | undefined) ??
        ZERO_EMISSIVE_COLOR;
      const baseIntensity =
        (mat.userData?.__baseEmissiveIntensity as number | undefined) ?? 0;
      if (xrayGhostMode) {
        mat.emissive.copy(GHOST_EMISSIVE_COLOR);
        mat.emissiveIntensity = 0.4;
      } else {
        mat.emissive.copy(baseEmissive);
        mat.emissiveIntensity = baseIntensity;
      }
    }

    const hiddenGroupIds = new Set<string>();
    for (const hid of hiddenPartIds) {
      const hiddenMesh = getRegisteredSceneMesh(hid, hid);
      const grp = hiddenMesh?.userData?.organGroupId as string | undefined;
      if (grp) hiddenGroupIds.add(grp);
    }
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId)
      : null;
    const isolatedGroupId = isolatedMesh?.userData?.organGroupId as
      | string
      | undefined;

    for (const mesh of registeredMeshes) {
      const rawId = mesh.name;
      const sys = (mesh.userData?.system as AnatomicalSystem) ?? 'visceral';
      const organGroupId = mesh.userData?.organGroupId as string | undefined;
      const isSysActive = activeSystems[sys];
      const sysOpacity = systemOpacity[sys];

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
      } else {
        mesh.layers.disable(0);
      }

      let effectiveOpacity = xrayGhostMode ? 0.1 : sysOpacity;
      if (sys === 'integumentary' && isInternalSelection) {
        effectiveOpacity = xrayGhostMode ? 0.08 : Math.min(sysOpacity, 0.12);
      }
      const isTranslucentLayer = xrayGhostMode || effectiveOpacity < 0.85;
      const effectiveTransparent = isTranslucentLayer || effectiveOpacity < 1;

      mesh.renderOrder = effectiveTransparent ? 10 : 2;
    }
  }, [
    registeredMeshes,
    sharedMaterials,
    biologicalSex,
    activeSystems,
    systemOpacity,
    selectedPart,
    hiddenPartIds,
    isolatedPartId,
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
  ]);

  return (
    <>
      <primitive
        object={clonedScene}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (cameraInteractionState.isOrbiting) return;
          const dx = e.clientX - pointerDownPosRef.current.x;
          const dy = e.clientY - pointerDownPosRef.current.y;
          if (Math.hypot(dx, dy) >= 5) return;
          if ((e.object as THREE.Mesh).isMesh && e.object.visible) {
            e.stopPropagation();
            selectPart(parseAnatomicalMesh(e.object as THREE.Mesh));
          }
        }}
        onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
          if (cameraInteractionState.isOrbiting) return;
          const dx = e.clientX - pointerDownPosRef.current.x;
          const dy = e.clientY - pointerDownPosRef.current.y;
          if (Math.hypot(dx, dy) >= 5) return;
          if ((e.object as THREE.Mesh).isMesh && e.object.visible) {
            e.stopPropagation();
            selectPart(parseAnatomicalMesh(e.object as THREE.Mesh));
            focusSelectedPart();
          }
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (cameraInteractionState.isOrbiting) return;
          const mesh = e.object as THREE.Mesh;
          if (!mesh.isMesh || !mesh.visible) return;
          e.stopPropagation();
          const now = performance.now();
          if (now - lastHoverTimestampRef.current < 60) return;
          lastHoverTimestampRef.current = now;
          document.body.style.cursor = 'pointer';
          if (mesh.uuid === useAnatomyStore.getState().hoveredPart?.meshUuid) {
            return;
          }
          setHoveredPart(
            parseAnatomicalMesh(mesh),
            { x: e.clientX, y: e.clientY },
            e.pointerType === 'touch'
          );
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const currentHovered = useAnatomyStore.getState().hoveredPart;
          if (currentHovered?.meshUuid === e.object.uuid) {
            setHoveredPart(null);
          }
          document.body.style.cursor = 'auto';
        }}
      />

      {stencilTargetInfo && (
        <group ref={stencilGroupRef}>
          <mesh
            geometry={stencilTargetInfo.geometry}
            renderOrder={3}
            userData={{ __isStencilHelper: true }}
            raycast={() => null}
          >
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={false}
              depthTest={false}
              side={THREE.BackSide}
              stencilWrite
              stencilFunc={THREE.AlwaysStencilFunc}
              stencilFail={THREE.IncrementWrapStencilOp}
              stencilZFail={THREE.IncrementWrapStencilOp}
              stencilZPass={THREE.IncrementWrapStencilOp}
              clippingPlanes={CLIPPING_PLANES_LIST}
            />
          </mesh>
          <mesh
            geometry={stencilTargetInfo.geometry}
            renderOrder={3}
            userData={{ __isStencilHelper: true }}
            raycast={() => null}
          >
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={false}
              depthTest={false}
              side={THREE.FrontSide}
              stencilWrite
              stencilFunc={THREE.AlwaysStencilFunc}
              stencilFail={THREE.DecrementWrapStencilOp}
              stencilZFail={THREE.DecrementWrapStencilOp}
              stencilZPass={THREE.DecrementWrapStencilOp}
              clippingPlanes={CLIPPING_PLANES_LIST}
            />
          </mesh>
        </group>
      )}
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
  const gltf = useGLTF(resolveAssetUrl(entry.localPath));

  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);

  const selectPart = useAnatomyStore((s) => s.selectPart);
  const setHoveredPart = useAnatomyStore((s) => s.setHoveredPart);
  const focusSelectedPart = useAnatomyStore((s) => s.focusSelectedPart);

  const lastHoverTimestampRef = useRef(0);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

        if (mesh.geometry) {
          if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox();
          }
          enqueueGeometryBVH(mesh.geometry);
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
              structureHint
            )
          );
        } else if (mesh.material) {
          mesh.material = getOrCreateSharedStandardMaterial(
            matCache,
            mesh.material,
            meshSystem,
            hasVertexColors,
            tissueColor,
            structureHint
          );
        }

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
          __spatialBounds: spatialBounds,
          __restPosition: mesh.position.clone(),
          __restScale: mesh.scale.clone(),
          __restCenter: sharedWorldCenter.clone(),
          __localCenter: geomLocalCenter,
          __explodeClusterId: explodeClusterId,
          __sharedMaterial: mesh.material,
          __origRaycast: mesh.raycast,
        };

        meshes.push(mesh);
      }

      return {
        alignedRoot: clone,
        normTransform: { position, scale },
        sharedMaterials: Array.from(matCache.values()),
        registeredMeshes: meshes,
      };
    }, [gltf.scene, entry]);

  useEffect(() => {
    registeredMeshes.forEach(registerSceneMesh);
    onSceneReady();
    return () => {
      registeredMeshes.forEach(unregisterSceneMesh);
      onSceneReady();
    };
  }, [alignedRoot, registeredMeshes, onSceneReady]);

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
    const backgroundDimFactor = selectedPart !== null ? 0.8 : 1.0;
    const sharedSliced = slicing.enabled && slicing.scope === 'all';
    const hasInternalSystemsVisible =
      activeAtlasPreset !== 'zanatomy-integumentary' &&
      (activeSystems.skeletal ||
        activeSystems.muscular ||
        activeSystems.visceral ||
        activeSystems.nervous ||
        activeSystems.cardiovascular);

    for (const { mat, system: meshSystem } of sharedMaterials) {
      if (mat.userData.__origColor === undefined) {
        mat.userData.__origColor = mat.color.clone();
        mat.userData.__origRoughness = mat.roughness;
      }
      const origColor = mat.userData.__origColor as THREE.Color;
      const origRoughness =
        (mat.userData.__origRoughness as number | undefined) ?? 0.6;

      const matNameTrimmed = (mat.name || '').trim();
      const isFemaleZAnatomySkinMat =
        biologicalSex === 'female' &&
        Boolean(entry.alignment?.useSharedOrigin) &&
        meshSystem === 'integumentary' &&
        !/^(?:fascia|black|nail|ligament)/i.test(matNameTrimmed);

      if (isFemaleZAnatomySkinMat) {
        mat.color.set('#e2b9a6');
        mat.roughness = 0.45;
      } else {
        mat.color.copy(origColor);
        mat.roughness = origRoughness;
      }

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

      mat.side = THREE.DoubleSide;
      mat.clippingPlanes = sharedSliced ? CLIPPING_PLANES_LIST : [];
      mat.clipShadows = sharedSliced;
      mat.transparent = needsTransparency;
      mat.opacity = targetOpacity;
      mat.depthWrite = xrayGhostMode
        ? false
        : meshSystem === 'integumentary'
          ? targetOpacity > 0.85
          : !needsTransparency;
      setClinicalDimFactor(mat, backgroundDimFactor);

      const baseEmissive =
        (mat.userData?.__baseEmissive as THREE.Color | undefined) ??
        ZERO_EMISSIVE_COLOR;
      const baseIntensity =
        (mat.userData?.__baseEmissiveIntensity as number | undefined) ?? 0;
      if (xrayGhostMode) {
        mat.emissive.copy(GHOST_EMISSIVE_COLOR);
        mat.emissiveIntensity = 0.22;
      } else {
        mat.emissive.copy(baseEmissive);
        mat.emissiveIntensity = baseIntensity;
      }
    }

    const hiddenGroupIds = new Set<string>();
    for (const hid of hiddenPartIds) {
      const hiddenMesh = getRegisteredSceneMesh(hid, hid);
      const grp = hiddenMesh?.userData?.organGroupId as string | undefined;
      if (grp) hiddenGroupIds.add(grp);
    }
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId)
      : null;
    const isolatedGroupId = isolatedMesh?.userData?.organGroupId as
      | string
      | undefined;

    for (const mesh of registeredMeshes) {
      const meshSystem =
        (mesh.userData?.system as AnatomicalSystem | undefined) ?? entry.system;
      const rawId = mesh.name;
      const organGroupId = mesh.userData?.organGroupId as string | undefined;
      const displayHint = `${rawId} ${String(mesh.userData?.anatomicalName || '')}`;
      const isFemaleSuppressedHair =
        biologicalSex === 'female' &&
        meshSystem === 'integumentary' &&
        Boolean(entry.alignment?.useSharedOrigin) &&
        /\b(?:hairs?[\s_]+of[\s_]+head|pubic[\s_]+hairs?)\b/i.test(displayHint);

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

      mesh.renderOrder =
        meshSystem === 'integumentary' && targetOpacity < 0.98
          ? 5
          : xrayGhostMode
            ? 2
            : 0;
    }
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
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
  ]);

  // Apply rigid macro-unit explode offsets & female skeletal pelvic dimorphism declaratively
  useEffect(() => {
    alignedRoot.parent?.updateWorldMatrix(true, false);
    alignedRoot.updateMatrixWorld(true);
    const explodeCtx = { activeAtlasPreset, activeSystems };

    for (const mesh of registeredMeshes) {
      const restPos = mesh.userData.__restPosition as THREE.Vector3 | undefined;
      const restScale = mesh.userData.__restScale as THREE.Vector3 | undefined;
      const clusterId = mesh.userData.__explodeClusterId as
        | ExplodeClusterId
        | undefined;
      const isFemalePelvis =
        biologicalSex === 'female' && Boolean(mesh.userData?.__isPelvicGirdle);

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

  const resolveMesh = useCallback((e: ThreeEvent<PointerEvent>) => {
    const obj = e.object as THREE.Mesh;
    if (!obj || !obj.isMesh || !obj.visible || obj.userData?.__isNoiseFiltered) {
      return null;
    }
    return obj;
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (cameraInteractionState.isOrbiting) return;
      const dx = e.clientX - pointerDownPosRef.current.x;
      const dy = e.clientY - pointerDownPosRef.current.y;
      if (Math.hypot(dx, dy) >= 5) return;
      e.stopPropagation();
      const obj = e.object as THREE.Mesh;
      if (!obj || !obj.isMesh || !obj.visible || obj.userData?.__isNoiseFiltered) {
        return;
      }
      selectPart(parseAnatomicalMesh(obj));
    },
    [selectPart]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (cameraInteractionState.isOrbiting) return;
      const dx = e.clientX - pointerDownPosRef.current.x;
      const dy = e.clientY - pointerDownPosRef.current.y;
      if (Math.hypot(dx, dy) >= 5) return;
      e.stopPropagation();
      const obj = e.object as THREE.Mesh;
      if (!obj || !obj.isMesh || !obj.visible || obj.userData?.__isNoiseFiltered) {
        return;
      }
      selectPart(parseAnatomicalMesh(obj));
      focusSelectedPart();
    },
    [selectPart, focusSelectedPart]
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (cameraInteractionState.isOrbiting) return;
      e.stopPropagation();
      const mesh = resolveMesh(e);
      if (!mesh) return;
      const now = performance.now();
      if (now - lastHoverTimestampRef.current < 60) return;
      lastHoverTimestampRef.current = now;
      document.body.style.cursor = 'pointer';
      if (mesh.uuid === useAnatomyStore.getState().hoveredPart?.meshUuid) {
        return;
      }
      setHoveredPart(
        parseAnatomicalMesh(mesh),
        { x: e.clientX, y: e.clientY },
        e.pointerType === 'touch'
      );
    },
    [resolveMesh, setHoveredPart]
  );

  const handlePointerOut = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const obj = e.object as THREE.Mesh;
      if (!obj || !obj.isMesh) return;
      const currentHover = useAnatomyStore.getState().hoveredPart;
      if (
        currentHover?.meshUuid === obj.uuid ||
        currentHover?.rawName === obj.name
      ) {
        setHoveredPart(null);
        document.body.style.cursor = 'auto';
      }
    },
    [setHoveredPart]
  );

  return (
    <group
      name={`Sketchfab_System_${entry.system}`}
      position={normTransform.position}
      scale={normTransform.scale}
    >
      <primitive
        object={alignedRoot}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
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
  const pinGroupRef = useRef<THREE.Group>(null);
  const livePosTempRef = useRef(new THREE.Vector3());

  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);

  useEffect(() => {
    if (!pinGroupRef.current || !selectedPart) return;
    const obj = getRegisteredSceneMesh(
      selectedPart.meshUuid,
      selectedPart.rawName
    );
    const localCenter = obj?.userData?.__localCenter as
      | THREE.Vector3
      | undefined;

    if (obj && localCenter) {
      obj.updateWorldMatrix(true, false);
      livePosTempRef.current.copy(localCenter).applyMatrix4(obj.matrixWorld);
      pinGroupRef.current.position.copy(livePosTempRef.current);
    } else {
      pinGroupRef.current.position.set(...selectedPart.worldCenter);
    }
  }, [selectedPart, explodeFactor]);

  if (!selectedPart) return null;

  const selectedMeshObj = getRegisteredSceneMesh(
    selectedPart.meshUuid,
    selectedPart.rawName
  );
  const selectedGroupId = selectedMeshObj?.userData?.organGroupId as
    | string
    | undefined;
  const isolatedMeshObj = isolatedPartId
    ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId)
    : null;
  const isolatedGroupId = isolatedMeshObj?.userData?.organGroupId as
    | string
    | undefined;

  const isVisible =
    activeSystems[selectedPart.system] &&
    !hiddenPartIds.includes(selectedPart.meshUuid) &&
    !hiddenPartIds.includes(selectedPart.rawName) &&
    (isolatedPartId === null ||
      xrayGhostMode ||
      isolatedPartId === selectedPart.meshUuid ||
      isolatedPartId === selectedPart.rawName ||
      (Boolean(selectedGroupId) && selectedGroupId === isolatedGroupId));

  if (!isVisible) return null;

  return (
    <group ref={pinGroupRef} position={selectedPart.worldCenter}>
      <Html zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
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
const MeshHighlightController: React.FC<{ nihCatalogTick: number }> = ({
  nihCatalogTick,
}) => {
  const hoveredPart = useAnatomyStore((s) => s.hoveredPart);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const slicingEnabled = useAnatomyStore((s) => s.slicing.enabled);
  const slicingScope = useAnatomyStore((s) => s.slicing.scope);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const anatomicalCatalog = useAnatomyStore((s) => s.anatomicalCatalog);

  const highlightedMeshesRef = useRef<Set<THREE.Mesh>>(new Set());

  useEffect(() => {
    void nihCatalogTick;
    void activeSystems;
    void systemOpacity;
    void hiddenPartIds;
    void biologicalSex;
    void customGlbUrl;
    void activeAtlasPreset;
    void anatomicalCatalog;

    const restoreAll = () => {
      for (const mesh of highlightedMeshesRef.current) {
        const hi = mesh.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((m) => m?.dispose());
          mesh.userData.__highlightMaterial = undefined;
        }
        if (mesh.userData?.__sharedMaterial) {
          mesh.material = mesh.userData.__sharedMaterial;
        }
      }
      highlightedMeshesRef.current.clear();
    };

    restoreAll();

    const selectedMesh = selectedPart
      ? getRegisteredSceneMesh(selectedPart.meshUuid, selectedPart.rawName)
      : null;
    const hoveredMesh = hoveredPart
      ? getRegisteredSceneMesh(hoveredPart.meshUuid, hoveredPart.rawName)
      : null;
    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId)
      : null;

    const collectGroupSiblings = (anchor: THREE.Mesh | null): THREE.Mesh[] => {
      if (!anchor || !anchor.visible) return [];
      const grp = anchor.userData?.organGroupId as string | undefined;
      if (!grp) return [anchor];
      const matches: THREE.Mesh[] = [];
      for (const m of sceneMeshByUuid.values()) {
        if (m.visible && m.userData?.organGroupId === grp) {
          matches.push(m);
        }
      }
      return matches.length > 0 ? matches : [anchor];
    };

    const targets: { mesh: THREE.Mesh; role: 'selected' | 'hover' | 'isolated' }[] = [];
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
      const shared = mesh.userData?.__sharedMaterial as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!shared) continue;

      const isFocusTarget =
        isolatedMesh !== null ? mesh === isolatedMesh : mesh === selectedMesh;
      const isMeshSliced =
        slicingEnabled &&
        (slicingScope === 'all' ||
          mesh === selectedMesh ||
          mesh === isolatedMesh);

      const configureClone = (srcMat: THREE.Material) => {
        const cloned = cloneClinicalHighlightMaterial(srcMat);
        if (role === 'selected') {
          setClinicalHighlightState(cloned, 2, 1.0);
        } else if (role === 'hover') {
          setClinicalHighlightState(cloned, 1, 1.0);
        } else {
          setClinicalHighlightState(cloned, 0, 1.0);
        }

        if (xrayGhostMode && isFocusTarget) {
          cloned.opacity = 1.0;
          cloned.transparent = false;
          cloned.depthWrite = true;
        }

        cloned.clippingPlanes = isMeshSliced ? CLIPPING_PLANES_LIST : null;
        cloned.clipShadows = isMeshSliced;
        return cloned;
      };

      const nextMat = Array.isArray(shared)
        ? shared.map(configureClone)
        : configureClone(shared);

      mesh.userData.__highlightMaterial = nextMat;
      mesh.material = nextMat;
      highlightedMeshesRef.current.add(mesh);
    }

    return restoreAll;
  }, [
    hoveredPart,
    selectedPart,
    activeSystems,
    systemOpacity,
    hiddenPartIds,
    isolatedPartId,
    xrayGhostMode,
    slicingEnabled,
    slicingScope,
    biologicalSex,
    customGlbUrl,
    activeAtlasPreset,
    anatomicalCatalog,
    nihCatalogTick,
  ]);

  return null;
};

export const AnatomicalModelManager: React.FC = () => {
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
  useEffect(() => {
    if (customGlbUrl || !atlasAssemblyGroupRef.current) return;
    atlasAssemblyGroupRef.current.updateMatrixWorld(true);

    const parts: AnatomicalPartInfo[] = [];
    atlasAssemblyGroupRef.current.traverse((obj) => {
      if (
        (obj as THREE.Mesh).isMesh &&
        !obj.userData?.__isStencilHelper &&
        !obj.userData?.__isNoiseFiltered &&
        Boolean(obj.name)
      ) {
        const mesh = obj as THREE.Mesh;
        if (!isMeshVisibleForSex(mesh, biologicalSex)) return;
        const parsed = parseAnatomicalMesh(mesh);
        if (!isPartVisibleForSex(parsed, biologicalSex)) return;
        parts.push(parsed);
      }
    });
    if (parts.length > 0 || nihCatalogTick > 0) {
      registerCatalog(parts);
    }
  }, [
    customGlbUrl,
    activeAtlasPreset,
    activeSystems,
    biologicalSex,
    nihCatalogTick,
    rootTransform,
    registerCatalog,
  ]);

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
      <MeshHighlightController nihCatalogTick={nihCatalogTick} />
      <ExternalSpatialCalloutPin />
      <SlicingPlaneGizmo />
    </group>
  );
};
