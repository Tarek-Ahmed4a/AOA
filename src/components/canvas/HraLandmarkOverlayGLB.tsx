import React, {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  useAnatomyStore,
  type AnatomicalSystem,
} from '../../store/useAnatomyStore';
import type { AnatomicalPartInfo } from '../../utils/anatomyParser';
import { resolveAssetUrl } from '../../utils/assetUrl';
import {
  enqueueGeometryBVH,
  registerSceneMesh,
  unregisterSceneMesh,
  useSceneMeshRegistry,
} from '../../utils/bvhSetup';
import { registerCustomGlbExtensions } from '../../utils/gltfSpecularGlossinessExtension';
import { useClippingPlane } from '../../utils/slicingPlane';
import {
  getCachedHraSurgicalLandmarksSync,
  getHraSurgicalLandmarks,
  type HraLandmarkSubmesh,
  type HraSurgicalLandmarkGlb,
} from '../../services/hraLandmarkService';
import { resolveHraSubmeshClinicalCopy } from '../../data/anatomicalLandmarksCatalog';
import {
  computeCrossDatasetAlignment,
  type CrossDatasetTargetMatch,
} from '../../utils/universalLandmarkRegistration';

const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

/**
 * Semantic clinical fiducial color coding:
 * Vascular, ductal, and tubular conduits use clinical cyan (#38bdf8),
 * while surgical bisection planes, structural margins & chambers use clinical amber (#f59e0b).
 */
const CYAN_FIDUCIAL_REGEX =
  /arter|vein|aort|vena|cava|ureter|duct|biliary|bronch|trachea|pelvis|nerve/i;

function formatLandmarkTitle(raw: string): string {
  const cleaned = raw
    .replace(/^VH_[MF]_[a-z_]+?_landmark_/i, '')
    .replace(/^VH_[MF]_/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Anatomical Landmark';
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function inferLandmarkLaterality(
  text: string,
  parentSide: HraSurgicalLandmarkGlb['side']
): AnatomicalPartInfo['laterality'] {
  const lower = text.toLowerCase();
  if (lower.includes('left') || /_l(?:_|$)/.test(lower)) return 'Left';
  if (lower.includes('right') || /_r(?:_|$)/.test(lower)) return 'Right';
  if (parentSide === 'left') return 'Left';
  if (parentSide === 'right') return 'Right';
  return 'Median / Unpaired';
}

function normalizeNodeLookupKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/_primitive_\d+$/, '')
    .replace(/\.\d{3}$/, '');
}

function matchSubmeshForSceneNode(
  node: THREE.Object3D,
  root: THREE.Object3D,
  subMeshMap: Map<string, HraLandmarkSubmesh>
): HraLandmarkSubmesh | null {
  if (subMeshMap.size === 0) return null;
  let curr: THREE.Object3D | null = node;
  while (curr && curr !== root.parent) {
    if (curr.name) {
      const exactKey = curr.name.trim().toLowerCase();
      const exactMatch = subMeshMap.get(exactKey);
      if (exactMatch) return exactMatch;

      const normKey = normalizeNodeLookupKey(curr.name);
      const normMatch = subMeshMap.get(normKey);
      if (normMatch) return normMatch;
    }
    if (curr === root) break;
    curr = curr.parent;
  }
  return null;
}

class LandmarkGLBErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Gracefully skip unavailable remote landmark GLBs without interrupting the 3D scene
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Shared React hook providing the NIH HRA landmark GLB catalog immediately from sync/offline
 * fallback and lazily refreshing from GET /v1/rui-reference-data when enabled.
 */
export function useHraSurgicalLandmarksCatalog(
  enabled = true
): HraSurgicalLandmarkGlb[] {
  const [catalog, setCatalog] = useState<HraSurgicalLandmarkGlb[]>(() =>
    getCachedHraSurgicalLandmarksSync()
  );

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getHraSurgicalLandmarks().then((items) => {
      if (active && items.length > 0) {
        setCatalog(items);
      }
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return catalog;
}

export interface HraLandmarkOverlayGLBProps {
  landmark: HraSurgicalLandmarkGlb;
  parentSystem: AnatomicalSystem;
  hidden?: boolean;
  crossTarget?: CrossDatasetTargetMatch | null;
}

export const HraLandmarkOverlayGLB: React.FC<HraLandmarkOverlayGLBProps> = ({
  landmark,
  parentSystem,
  hidden = false,
  crossTarget = null,
}) => {
  const { invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);
  const slicingEnabled = useAnatomyStore((s) => s.slicing.enabled);
  const slicingScope = useAnatomyStore((s) => s.slicing.scope);
  const biologicalSex = useAnatomyStore((s) => s.biologicalSex);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const customGlbUrl = useAnatomyStore((s) => s.customGlbUrl);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);

  const wrapperRef = useRef<THREE.Group>(null);
  const resolvedUrl = useMemo(
    () => resolveAssetUrl(landmark.glbUrl),
    [landmark.glbUrl]
  );

  const gltf = useGLTF(resolvedUrl, true, true, registerCustomGlbExtensions);

  const relativeTransform = useMemo(() => {
    const mat = new THREE.Matrix4().fromArray(
      landmark.relativeMatrix.length === 16
        ? landmark.relativeMatrix
        : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    );
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    mat.decompose(pos, quat, scl);
    return {
      position: [pos.x, pos.y, pos.z] as [number, number, number],
      quaternion: quat,
      scale: [scl.x, scl.y, scl.z] as [number, number, number],
    };
  }, [landmark.relativeMatrix]);

  const { clonedScene, activeMeshes, fiducialMaterials } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.updateMatrixWorld(true);

    const subMeshMap = new Map<string, HraLandmarkSubmesh>();
    for (const sm of landmark.subMeshes) {
      if (sm.subNode) {
        subMeshMap.set(sm.subNode.trim().toLowerCase(), sm);
        subMeshMap.set(normalizeNodeLookupKey(sm.subNode), sm);
      }
    }

    const meshes: THREE.Mesh[] = [];
    const createdMaterials: THREE.MeshStandardMaterial[] = [];
    const fallbackLabel =
      landmark.subMeshes[0]?.label ||
      landmark.fileName.replace(/\.glb$/i, '');

    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;

      const matchedSub = matchSubmeshForSceneNode(mesh, clone, subMeshMap);
      if (subMeshMap.size > 0 && !matchedSub) {
        mesh.visible = false;
        mesh.raycast = NOOP_RAYCAST;
        return;
      }

      const subNodeName = matchedSub?.subNode || mesh.name || '';
      const rawDisplayName = matchedSub?.label || mesh.name || fallbackLabel;
      const cleanTitle = formatLandmarkTitle(rawDisplayName);
      const isCyan = CYAN_FIDUCIAL_REGEX.test(`${cleanTitle} ${subNodeName}`);

      const colorHex = isCyan ? '#38bdf8' : '#f59e0b';
      const emissiveHex = isCyan ? '#0284c7' : '#b45309';

      const fiducialMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        emissive: new THREE.Color(emissiveHex),
        emissiveIntensity: 0.24,
        roughness: 0.25,
        metalness: 0.08,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      fiducialMat.userData = {
        ...(fiducialMat.userData || {}),
        __baseColorHex: fiducialMat.color.getHex(),
        __baseEmissive: new THREE.Color(emissiveHex),
        __baseEmissiveIntensity: 0.24,
        __baseRoughness: 0.25,
        __baseOpacity: 0.62,
        __origSide: THREE.DoubleSide,
      };
      createdMaterials.push(fiducialMat);

      const organGroupId = `landmark::${landmark.parentOrganKey}::${
        subNodeName || cleanTitle
      }`;
      const clinicalCopy = resolveHraSubmeshClinicalCopy(
        cleanTitle,
        landmark.parentOrganLabel,
        subNodeName
      );
      const partInfo: AnatomicalPartInfo = {
        meshUuid: mesh.uuid,
        rawName: subNodeName || `${landmark.parentOrganSlug}_${cleanTitle}`,
        cleanName: cleanTitle,
        cleanNameAr: clinicalCopy.nameAr,
        latinName: `NIH HRA Fiducial • ${landmark.parentOrganLabel}`,
        laterality: inferLandmarkLaterality(
          `${cleanTitle} ${subNodeName}`,
          landmark.side
        ),
        system: parentSystem,
        ta98Code: 'HRA-LMK',
        organGroupId,
        worldCenter: [0, 0, 0],
        boundingRadius: 0.08,
        landmarkMeta: {
          id: organGroupId,
          nameEn: cleanTitle,
          nameAr: clinicalCopy.nameAr,
          latinName: `NIH HRA Fiducial • ${landmark.parentOrganLabel}`,
          parentOrganLabel: landmark.parentOrganLabel,
          parentOrganAr: clinicalCopy.nameAr.split(':')[0] || landmark.parentOrganLabel,
          localizationEn: clinicalCopy.localizationEn,
          localizationAr: clinicalCopy.localizationAr,
          significanceEn: clinicalCopy.significanceEn,
          significanceAr: clinicalCopy.significanceAr,
          region: 'NIH HRA CCF Surgical Landmark',
        },
      };

      mesh.name = `${subNodeName || cleanTitle} [${landmark.parentOrganSlug}]`;
      mesh.material = fiducialMat;
      mesh.renderOrder = 14;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData = {
        ...(mesh.userData || {}),
        partInfo,
        system: parentSystem,
        organGroupId,
        nihOrganId: landmark.parentOrganSlug,
        nihOrganKey: landmark.parentOrganKey,
        nihOntologyId: landmark.ontologyId,
        isSurgicalLandmark: true,
        landmarkLabel: cleanTitle,
        landmarkParentOrganLabel: landmark.parentOrganLabel,
        landmarkSubNode: subNodeName,
        landmarkGlbUrl: landmark.glbUrl,
        __isNoiseFiltered: false,
        __sharedMaterial: fiducialMat,
        __origRaycast: mesh.raycast,
      };

      meshes.push(mesh);
    });

    return {
      clonedScene: clone,
      activeMeshes: meshes,
      fiducialMaterials: createdMaterials,
    };
  }, [gltf.scene, landmark, parentSystem]);

  const lmLocalMetrics = useMemo(() => {
    if (activeMeshes.length === 0) return null;
    const relMat = new THREE.Matrix4().compose(
      new THREE.Vector3(...relativeTransform.position),
      relativeTransform.quaternion,
      new THREE.Vector3(...relativeTransform.scale)
    );
    const totalBox = new THREE.Box3();
    const meshBox = new THREE.Box3();
    clonedScene.updateMatrixWorld(true);

    for (const mesh of activeMeshes) {
      mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) continue;
      meshBox.copy(mesh.geometry.boundingBox);
      meshBox.applyMatrix4(mesh.matrixWorld);
      meshBox.applyMatrix4(relMat);
      totalBox.union(meshBox);
    }

    if (totalBox.isEmpty()) return null;
    return {
      center: totalBox.getCenter(new THREE.Vector3()),
      size: totalBox.getSize(new THREE.Vector3()),
    };
  }, [activeMeshes, clonedScene, relativeTransform]);

  const crossAlign = useMemo(() => {
    if (!crossTarget || !lmLocalMetrics) return null;
    return computeCrossDatasetAlignment({
      lmLocalCenter: lmLocalMetrics.center,
      lmLocalSize: lmLocalMetrics.size,
      target: crossTarget,
    });
  }, [crossTarget, lmLocalMetrics]);

  useEffect(() => {
    for (const m of activeMeshes) {
      registerSceneMesh(m, registry);
    }
    invalidate();
    return () => {
      for (const m of activeMeshes) {
        unregisterSceneMesh(m, registry);
      }
      invalidate();
    };
  }, [activeMeshes, registry, invalidate]);

  useEffect(() => {
    return () => {
      for (const m of activeMeshes) {
        const hi = m.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((mat) => mat?.dispose());
          m.userData.__highlightMaterial = undefined;
        }
      }
      for (const mat of fiducialMaterials) {
        mat.dispose();
      }
    };
  }, [activeMeshes, fiducialMaterials]);

  useEffect(() => {
    const slicedAll = slicingEnabled && slicingScope === 'all';
    for (const mat of fiducialMaterials) {
      mat.clippingPlanes = slicedAll ? clippingPlanesList : null;
      mat.clipShadows = slicedAll;
      mat.needsUpdate = true;
    }

    const rootObj = wrapperRef.current;
    if (rootObj) {
      rootObj.updateWorldMatrix(true, true);
    }

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    for (const mesh of activeMeshes) {
      const pi = mesh.userData.partInfo as AnatomicalPartInfo | undefined;
      if (pi?.landmarkMeta && crossTarget?.anchorMesh) {
        pi.landmarkMeta.parentMeshUuid = crossTarget.anchorMesh.uuid;
      }
      const isMeshPeeled =
        hiddenPartIds.includes(mesh.uuid) ||
        hiddenPartIds.includes(mesh.name) ||
        (pi
          ? hiddenPartIds.includes(pi.rawName) ||
            (Boolean(pi.organGroupId) && hiddenPartIds.includes(pi.organGroupId!))
          : false);
      const isVisible = !hidden && !isMeshPeeled && (!crossTarget || crossTarget.visible);

      mesh.visible = isVisible;
      if (!mesh.userData.__origRaycast) {
        mesh.userData.__origRaycast = mesh.raycast;
      }
      mesh.raycast = !isVisible
        ? NOOP_RAYCAST
        : (mesh.userData.__origRaycast as THREE.Mesh['raycast']);

      if (isVisible) {
        mesh.layers.enable(0);
        enqueueGeometryBVH(mesh.geometry);
        box.setFromObject(mesh);
        if (!box.isEmpty()) {
          box.getCenter(center);
          box.getSize(size);
          if (pi) {
            pi.worldCenter = [center.x, center.y, center.z];
            pi.boundingRadius = Math.max(0.025, size.length() * 0.5);
          }
        }
      } else {
        mesh.layers.disable(0);
      }
    }

    invalidate();
  }, [
    activeMeshes,
    fiducialMaterials,
    hidden,
    hiddenPartIds,
    crossTarget,
    crossAlign,
    slicingEnabled,
    slicingScope,
    clippingPlanesList,
    biologicalSex,
    activeAtlasPreset,
    customGlbUrl,
    invalidate,
  ]);

  if (crossTarget && crossAlign && lmLocalMetrics) {
    return (
      <group
        name={`CrossLandmarkOverlay_${landmark.parentOrganSlug}`}
        position={crossTarget.zaCenter}
        scale={crossAlign.scale}
        visible={!hidden && crossTarget.visible}
      >
        <group quaternion={crossAlign.quaternion}>
          <group
            position={[
              -lmLocalMetrics.center.x,
              -lmLocalMetrics.center.y,
              -lmLocalMetrics.center.z,
            ]}
          >
            <group
              ref={wrapperRef}
              name={`LandmarkOverlay_${landmark.parentOrganSlug}`}
              position={relativeTransform.position}
              quaternion={relativeTransform.quaternion}
              scale={relativeTransform.scale}
            >
              <primitive object={clonedScene} />
            </group>
          </group>
        </group>
      </group>
    );
  }

  return (
    <group
      ref={wrapperRef}
      name={`LandmarkOverlay_${landmark.parentOrganSlug}`}
      position={relativeTransform.position}
      quaternion={relativeTransform.quaternion}
      scale={relativeTransform.scale}
      visible={!hidden}
    >
      <primitive object={clonedScene} />
    </group>
  );
};

export interface HraLandmarkOverlayListProps {
  visible: boolean;
  landmarks?: HraSurgicalLandmarkGlb[];
  crossTargets?: Array<{
    landmark: HraSurgicalLandmarkGlb;
    target: CrossDatasetTargetMatch;
  }>;
  parentSystem: AnatomicalSystem;
  hidden?: boolean;
}

/**
 * Lazy-loading mount wrapper for zero-leak surgical landmark overlays.
 * Does not fetch landmark GLBs until `visible` becomes true.
 */
export const HraLandmarkOverlayList: React.FC<HraLandmarkOverlayListProps> = ({
  visible,
  landmarks = [],
  crossTargets,
  parentSystem,
  hidden = false,
}) => {
  if (!visible) return null;

  if (crossTargets && crossTargets.length > 0) {
    return (
      <>
        {crossTargets.map(({ landmark, target }) => (
          <LandmarkGLBErrorBoundary key={`${landmark.id}::${target.side}`}>
            <Suspense fallback={null}>
              <HraLandmarkOverlayGLB
                landmark={landmark}
                parentSystem={target.system ?? parentSystem}
                hidden={hidden || !target.visible}
                crossTarget={target}
              />
            </Suspense>
          </LandmarkGLBErrorBoundary>
        ))}
      </>
    );
  }

  if (landmarks.length === 0) return null;

  return (
    <>
      {landmarks.map((landmark) => (
        <LandmarkGLBErrorBoundary key={landmark.id}>
          <Suspense fallback={null}>
            <HraLandmarkOverlayGLB
              landmark={landmark}
              parentSystem={parentSystem}
              hidden={hidden}
            />
          </Suspense>
        </LandmarkGLBErrorBoundary>
      ))}
    </>
  );
};
