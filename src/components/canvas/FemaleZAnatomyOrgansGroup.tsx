import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useAnatomyStore } from '../../store/useAnatomyStore';
import {
  applyMeshPartOpacityOverride,
  disposeMeshOpacityClone,
  resolveMeshOpacityOverride,
} from '../../utils/partOpacityUtils';
import {
  parseAnatomicalMesh,
  type AnatomicalPartInfo,
} from '../../utils/anatomyParser';
import { resolveAssetUrl } from '../../utils/assetUrl';
import {
  enqueueGeometryBVH,
  getRegisteredSceneMesh,
  registerSceneMesh,
  unregisterSceneMesh,
  useSceneMeshRegistry,
} from '../../utils/bvhSetup';
import { registerCustomGlbExtensions } from '../../utils/gltfSpecularGlossinessExtension';
import { useClippingPlane } from '../../utils/slicingPlane';
import {
  applyRigidMacroExplodeOffset,
  resolveExplodeClusterId,
  type ExplodeClusterId,
} from '../../utils/explodeClusters';
import {
  calibrateFemaleZAnatomyMaterials,
  computeCohesivePelvicTransform,
  computeFilteredRawOrganBox,
  computeMammaryGlandTransform,
  FEMALE_MAMMARY_ORGAN_IDS,
  FEMALE_NOISE_SUBMESH_REGEX,
  FEMALE_PELVIC_ORGAN_IDS,
} from '../../utils/femaleZAnatomyRegistration';
import type { NihOrganSceneItem } from '../../services/nihSceneService';
import { matchLandmarksForOrgan, type HraSurgicalLandmarkGlb } from '../../services/hraLandmarkService';
import {
  HraLandmarkOverlayList,
  useHraSurgicalLandmarksCatalog,
} from './HraLandmarkOverlayGLB';
const NOOP_RAYCAST: THREE.Mesh['raycast'] = () => {};

interface FemaleOrganSpec {
  id: string;
  label: string;
  ta98Code: string;
  defaultLocalPath: string;
  side: 'Left' | 'Right' | 'Unpaired';
}

const FEMALE_ORGAN_SPECS: readonly FemaleOrganSpec[] = [
  {
    id: 'uterus-female',
    label: 'Uterus',
    ta98Code: 'A09.1.03.001',
    defaultLocalPath: '/models/nih/female/uterus-female.glb',
    side: 'Unpaired',
  },
  {
    id: 'ovary-female-left',
    label: 'Left Ovary',
    ta98Code: 'A09.1.01.001',
    defaultLocalPath: '/models/nih/female/ovary-female-left.glb',
    side: 'Left',
  },
  {
    id: 'ovary-female-right',
    label: 'Right Ovary',
    ta98Code: 'A09.1.01.001',
    defaultLocalPath: '/models/nih/female/ovary-female-right.glb',
    side: 'Right',
  },
  {
    id: 'fallopian-tube-female-left',
    label: 'Left Fallopian Tube (Uterine Tube)',
    ta98Code: 'A09.1.02.001',
    defaultLocalPath: '/models/nih/female/fallopian-tube-female-left.glb',
    side: 'Left',
  },
  {
    id: 'fallopian-tube-female-right',
    label: 'Right Fallopian Tube (Uterine Tube)',
    ta98Code: 'A09.1.02.001',
    defaultLocalPath: '/models/nih/female/fallopian-tube-female-right.glb',
    side: 'Right',
  },
  {
    id: 'mammary-gland-female-left',
    label: 'Left Mammary Gland',
    ta98Code: 'A16.0.02.001',
    defaultLocalPath: '/models/nih/female/mammary-gland-female-left.glb',
    side: 'Left',
  },
  {
    id: 'mammary-gland-female-right',
    label: 'Right Mammary Gland',
    ta98Code: 'A16.0.02.001',
    defaultLocalPath: '/models/nih/female/mammary-gland-female-right.glb',
    side: 'Right',
  },
];

interface LoadedFemalePieceState {
  spec: FemaleOrganSpec;
  scene: THREE.Group;
  rawBox: THREE.Box3;
  meshes: THREE.Mesh[];
}

function findLandmarkBox(
  assemblyRoot: THREE.Group | null,
  matcher: (meshName: string) => boolean,
  maxRadiusMeters = 0.45
): THREE.Box3 | null {
  if (!assemblyRoot) return null;
  assemblyRoot.updateMatrixWorld(true);
  const combined = new THREE.Box3();
  const temp = new THREE.Box3();
  const sphere = new THREE.Sphere();
  let matched = false;

  assemblyRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!matcher(mesh.name || '')) return;
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;
    temp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    temp.getBoundingSphere(sphere);
    if (sphere.radius > 0.005 && sphere.radius < maxRadiusMeters) {
      combined.union(temp);
      matched = true;
    }
  });

  return matched && !combined.isEmpty() ? combined : null;
}

const FemaleOrganPieceLoader: React.FC<{
  spec: FemaleOrganSpec;
  url: string;
  landmarksCatalog: HraSurgicalLandmarkGlb[];
  onLoaded: (piece: LoadedFemalePieceState) => void;
  onDisposed: (id: string) => void;
}> = ({ spec, url, landmarksCatalog, onLoaded, onDisposed }) => {
  const registry = useSceneMeshRegistry();
  const showSurgicalLandmarks = useAnatomyStore((s) => s.showSurgicalLandmarks);
  const landmarkFilterMode = useAnatomyStore((s) => s.landmarkFilterMode);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const landmarkOffsetRef = useRef<THREE.Group>(null);
  const [hasVisibleParentMesh, setHasVisibleParentMesh] = useState(true);
  const gltf = useGLTF(
    resolveAssetUrl(url),
    true,
    true,
    registerCustomGlbExtensions
  );

  const prepared = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.name = `NIH_Female_ZAnatomy_${spec.id}`;
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);

    calibrateFemaleZAnatomyMaterials(spec.id, clone);
    const rawBox = computeFilteredRawOrganBox(clone);

    const meshes: THREE.Mesh[] = [];
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (
        mesh.userData?.__isNoiseSubmesh === true ||
        FEMALE_NOISE_SUBMESH_REGEX.test(mesh.name || '')
      ) {
        mesh.visible = false;
        mesh.raycast = NOOP_RAYCAST;
        return;
      }

      mesh.userData.__origRaycast = mesh.raycast;
      mesh.userData.__sharedMaterial = mesh.material;
      mesh.userData.originalMaterial = mesh.material;
      mesh.userData.system = 'visceral';
      mesh.userData.__anatomicalSystem = 'visceral';
      mesh.userData.parentModelContext = 'nih_visible_human';
      mesh.userData.organGroupId = spec.id;
      mesh.userData.nihOrganId = spec.id;
      mesh.userData.ta98Code = spec.ta98Code;
      mesh.userData.__restPosition = mesh.position.clone();
      mesh.userData.__isFemaleZAnatomySupplement = true;
      mesh.userData.__isFemaleOnly = true;
      mesh.userData.__isMaleOnly = false;
      mesh.userData.__explodeClusterId = resolveExplodeClusterId(
        `${spec.label} ${mesh.name}`,
        'visceral',
        new THREE.Vector3(
          spec.side === 'Left' ? 0.086 : spec.side === 'Right' ? -0.086 : 0,
          spec.id.includes('mammary') ? 1.268 : 0.838,
          0.02
        )
      );

      meshes.push(mesh);
    });

    return {
      spec,
      scene: clone,
      rawBox,
      meshes,
    };
  }, [gltf.scene, spec]);

  useEffect(() => {
    prepared.meshes.forEach((m) => registerSceneMesh(m, registry));
    onLoaded(prepared);
    return () => {
      prepared.meshes.forEach((m) => {
        const hi = m.userData?.__highlightMaterial as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (hi) {
          (Array.isArray(hi) ? hi : [hi]).forEach((mat) => mat?.dispose());
          m.userData.__highlightMaterial = undefined;
        }
        disposeMeshOpacityClone(m);
        const mats = Array.isArray(m.userData?.__sharedMaterial)
          ? (m.userData.__sharedMaterial as THREE.Material[])
          : [m.userData?.__sharedMaterial as THREE.Material | undefined];
        mats.forEach((mat) => {
          if (mat && !mat.userData?.__isPooledMaterial) {
            mat.dispose();
          }
        });
        unregisterSceneMesh(m, registry);
      });
      onDisposed(spec.id);
    };
  }, [prepared, registry, onLoaded, onDisposed, spec.id]);

  const organLandmarks = useMemo(() => {
    if (!showSurgicalLandmarks) return [];
    return matchLandmarksForOrgan(
      {
        organKey: spec.id,
        organLabel: spec.label,
        glbUrl: url,
        sex: 'female',
      },
      landmarksCatalog
    );
  }, [showSurgicalLandmarks, spec.id, spec.label, url, landmarksCatalog]);

  useEffect(() => {
    if (!showSurgicalLandmarks) return;
    let rafId = 0;
    rafId = window.requestAnimationFrame(() => {
      const anyVisible = prepared.meshes.some((m) => m.visible);
      setHasVisibleParentMesh(anyVisible);

      const offsetGroup = landmarkOffsetRef.current;
      const refMesh = prepared.meshes[0];
      const restPos = refMesh?.userData?.__restPosition as
        | THREE.Vector3
        | undefined;
      if (!offsetGroup || !refMesh || !restPos) return;

      offsetGroup.updateWorldMatrix(true, false);
      refMesh.parent?.updateWorldMatrix(true, false);
      const refParent = refMesh.parent;
      const outParent = offsetGroup.parent;
      if (!refParent || !outParent) {
        offsetGroup.position.copy(refMesh.position).sub(restPos);
        return;
      }

      const worldNow = refMesh.position.clone().applyMatrix4(refParent.matrixWorld);
      const worldRest = restPos.clone().applyMatrix4(refParent.matrixWorld);
      const worldDelta = worldNow.sub(worldRest);
      const invMat3 = new THREE.Matrix3().setFromMatrix4(
        outParent.matrixWorld.clone().invert()
      );
      offsetGroup.position.copy(worldDelta.applyMatrix3(invMat3));
    });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    showSurgicalLandmarks,
    prepared.meshes,
    explodeFactor,
    activeSystems,
    activeAtlasPreset,
    hiddenPartIds,
    isolatedPartId,
    xrayGhostMode,
  ]);

  return (
    <>
      <primitive object={prepared.scene} />
      {showSurgicalLandmarks &&
        activeSystems.visceral &&
        hasVisibleParentMesh &&
        (landmarkFilterMode !== 'selected' ||
          (selectedPart !== null &&
            prepared.meshes.some(
              (m) =>
                m.uuid === selectedPart.meshUuid ||
                m.name === selectedPart.rawName ||
                (selectedPart.organGroupId &&
                  m.userData?.organGroupId === selectedPart.organGroupId)
            ))) &&
        organLandmarks.length > 0 && (
        <group
          ref={landmarkOffsetRef}
          name={`FemaleOrganLandmarks_${spec.id}`}
          visible={hasVisibleParentMesh}
        >
          <HraLandmarkOverlayList
            visible={showSurgicalLandmarks && activeSystems.visceral}
            landmarks={organLandmarks}
            parentSystem="visceral"
            hidden={!hasVisibleParentMesh}
          />
        </group>
      )}
    </>
  );
};

export interface FemaleZAnatomyOrgansGroupProps {
  visible?: boolean;
  nihOrgans: NihOrganSceneItem[];
  atlasAssemblyGroupRef: React.RefObject<THREE.Group | null>;
  onCatalogUpdated: () => void;
}

export const FemaleZAnatomyOrgansGroup: React.FC<
  FemaleZAnatomyOrgansGroupProps
> = ({ visible = true, nihOrgans, atlasAssemblyGroupRef, onCatalogUpdated }) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const pelvicGroupRef = useRef<THREE.Group>(null);
  const mammaryLeftGroupRef = useRef<THREE.Group>(null);
  const mammaryRightGroupRef = useRef<THREE.Group>(null);

  const showSurgicalLandmarks = useAnatomyStore((s) => s.showSurgicalLandmarks);
  const landmarksCatalog = useHraSurgicalLandmarksCatalog(
    showSurgicalLandmarks && visible
  );
  const loadedPiecesRef = useRef<Map<string, LoadedFemalePieceState>>(
    new Map()
  );
  const anchoredVersionRef = useRef<number>(-1);
  const hasRealLandmarksRef = useRef<boolean>(false);
  const [mountVersion, setMountVersion] = useState(0);

  const { invalidate } = useThree();
  const registry = useSceneMeshRegistry();
  const clippingPlane = useClippingPlane();
  const clippingPlanesList = useMemo(() => [clippingPlane], [clippingPlane]);

  const activeAtlasPreset = useAnatomyStore((s) => s.activeAtlasPreset);
  const activeSystems = useAnatomyStore((s) => s.activeSystems);
  const systemOpacity = useAnatomyStore((s) => s.systemOpacity);
  const hiddenPartIds = useAnatomyStore((s) => s.hiddenPartIds);
  const isolatedPartId = useAnatomyStore((s) => s.isolatedPartId);
  const partOpacityOverrides = useAnatomyStore((s) => s.partOpacityOverrides);
  const xrayGhostMode = useAnatomyStore((s) => s.xrayGhostMode);
  const explodeFactor = useAnatomyStore((s) => s.explodeFactor);
  const slicing = useAnatomyStore((s) => s.slicing);
  const selectedPart = useAnatomyStore((s) => s.selectedPart);
  const setSupplementalCatalogParts = useAnatomyStore(
    (s) => s.setSupplementalCatalogParts
  );
  const catalogLength = useAnatomyStore((s) => s.baseCatalogParts.length);
  const onCatalogUpdatedRef = useRef(onCatalogUpdated);
  onCatalogUpdatedRef.current = onCatalogUpdated;
  const setSupplementalCatalogPartsRef = useRef(setSupplementalCatalogParts);
  setSupplementalCatalogPartsRef.current = setSupplementalCatalogParts;

  const nihUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of nihOrgans) {
      if (item.sex === 'female') {
        map.set(item.id, item.activeUrl || item.localPath);
      }
    }
    return map;
  }, [nihOrgans]);

  const handlePieceLoaded = useCallback((piece: LoadedFemalePieceState) => {
    loadedPiecesRef.current.set(piece.spec.id, piece);
    setMountVersion((v) => v + 1);
  }, []);

  const handlePieceDisposed = useCallback((id: string) => {
    loadedPiecesRef.current.delete(id);
    setMountVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    return () => {
      setSupplementalCatalogPartsRef.current([]);
      onCatalogUpdatedRef.current();
    };
  }, []);

  // Dynamically anchor & register all 7 female organs inside Z-Anatomy coordinates once loaded
  useEffect(() => {
    const pieces = loadedPiecesRef.current;
    if (pieces.size === 0) return;
    if (
      anchoredVersionRef.current === mountVersion &&
      hasRealLandmarksRef.current
    ) {
      return;
    }

    const assemblyRoot = atlasAssemblyGroupRef.current;

    // 1. Cohesive 5-organ pelvic group transform (`Uterus + Ovaries L/R + Fallopian Tubes L/R`)
    const pelvicUnionBox = new THREE.Box3();
    for (const id of FEMALE_PELVIC_ORGAN_IDS) {
      const piece = pieces.get(id);
      if (piece && !piece.rawBox.isEmpty()) {
        pelvicUnionBox.union(piece.rawBox);
      }
    }
    const bladderWorldBox = findLandmarkBox(assemblyRoot, (n) =>
      /urinary[\s_]*bladder/i.test(n)
    );
    if (!pelvicUnionBox.isEmpty() && pelvicGroupRef.current) {
      const pelvicTx = computeCohesivePelvicTransform(
        pelvicUnionBox,
        bladderWorldBox
      );
      pelvicGroupRef.current.position.copy(pelvicTx.position);
      pelvicGroupRef.current.scale.copy(pelvicTx.scale);
      pelvicGroupRef.current.updateMatrixWorld(true);
    }

    // 2. Mammary gland L/R transforms (`Pectoralis Major` anterior thoracic wall anchor)
    const pecLeftBox = findLandmarkBox(assemblyRoot, (n) =>
      /pectoralis[\s_]*major.*left/i.test(n)
    );
    const pecRightBox = findLandmarkBox(assemblyRoot, (n) =>
      /pectoralis[\s_]*major.*right/i.test(n)
    );

    const leftMammary = pieces.get('mammary-gland-female-left');
    if (
      leftMammary &&
      !leftMammary.rawBox.isEmpty() &&
      mammaryLeftGroupRef.current
    ) {
      const leftTx = computeMammaryGlandTransform(
        'left',
        leftMammary.rawBox,
        pecLeftBox
      );
      mammaryLeftGroupRef.current.position.copy(leftTx.position);
      mammaryLeftGroupRef.current.scale.copy(leftTx.scale);
      mammaryLeftGroupRef.current.updateMatrixWorld(true);
    }

    const rightMammary = pieces.get('mammary-gland-female-right');
    if (
      rightMammary &&
      !rightMammary.rawBox.isEmpty() &&
      mammaryRightGroupRef.current
    ) {
      const rightTx = computeMammaryGlandTransform(
        'right',
        rightMammary.rawBox,
        pecRightBox
      );
      mammaryRightGroupRef.current.position.copy(rightTx.position);
      mammaryRightGroupRef.current.scale.copy(rightTx.scale);
      mammaryRightGroupRef.current.updateMatrixWorld(true);
    }

    anchoredVersionRef.current = mountVersion;
    if (bladderWorldBox || pecLeftBox || pecRightBox) {
      hasRealLandmarksRef.current = true;
    }

    // 3. Recompute exact world-space part metadata & cluster IDs after anchoring
    const parts: AnatomicalPartInfo[] = [];
    let partIdx = 9000;
    const tempBox = new THREE.Box3();
    const tempCenter = new THREE.Vector3();

    for (const piece of pieces.values()) {
      piece.scene.updateMatrixWorld(true);
      for (const mesh of piece.meshes) {
        partIdx += 1;
        if (mesh.geometry && !mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        if (mesh.geometry?.boundingBox) {
          tempBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
          tempBox.getCenter(tempCenter);
          mesh.userData.__restCenter = tempCenter.clone();
          mesh.userData.__spatialBounds = {
            center: tempCenter.clone(),
            minY: tempBox.min.y,
            maxZ: tempBox.max.z,
            radius: tempBox.getBoundingSphere(new THREE.Sphere()).radius,
            system: 'visceral',
          };
          mesh.userData.__explodeClusterId = resolveExplodeClusterId(
            `${piece.spec.label} ${mesh.name}`,
            'visceral',
            tempCenter
          );
          if (!mesh.userData.__localCenter && mesh.geometry.boundingBox) {
            mesh.userData.__localCenter = mesh.geometry.boundingBox.getCenter(
              new THREE.Vector3()
            );
          }
        }
        const parsed = parseAnatomicalMesh(mesh, 'visceral', partIdx);
        mesh.userData.anatomicalName = parsed.cleanName;
        mesh.userData.partInfo = parsed;
        mesh.userData.__cachedPartInfo = parsed;
        parts.push(parsed);
      }
    }

    setSupplementalCatalogPartsRef.current(parts);
    onCatalogUpdatedRef.current();
  }, [
    mountVersion,
    catalogLength,
    activeSystems.muscular,
    atlasAssemblyGroupRef,
  ]);

  // Apply rigid macro-unit Explode View displacement seamlessly alongside Z-Anatomy clusters
  useEffect(() => {
    const pieces = loadedPiecesRef.current;
    if (pieces.size === 0) return;

    const explodeCtx = { activeAtlasPreset, activeSystems };
    pelvicGroupRef.current?.updateWorldMatrix(true, true);
    mammaryLeftGroupRef.current?.updateWorldMatrix(true, true);
    mammaryRightGroupRef.current?.updateWorldMatrix(true, true);

    for (const piece of pieces.values()) {
      for (const mesh of piece.meshes) {
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
    }
  }, [mountVersion, explodeFactor, activeAtlasPreset, activeSystems]);

  // Synchronize Peel, Isolate, X-Ray Ghost, Visceral Opacity & Cross-Section Slicing Planes
  useEffect(() => {
    const pieces = loadedPiecesRef.current;
    if (rootGroupRef.current) {
      rootGroupRef.current.visible = visible && activeSystems.visceral;
    }
    if (pieces.size === 0) return;

    const visOpacity = systemOpacity.visceral ?? 1.0;

    const isolatedMesh = isolatedPartId
      ? getRegisteredSceneMesh(isolatedPartId, isolatedPartId, registry)
      : null;
    const isolatedGroupId = isolatedMesh?.userData?.organGroupId as
      | string
      | undefined;

    for (const piece of pieces.values()) {
      for (const mesh of piece.meshes) {
        const organGrp = (mesh.userData?.organGroupId as string) || piece.spec.id;
        const isHidden =
          hiddenPartIds.includes(mesh.uuid) ||
          hiddenPartIds.includes(mesh.name) ||
          hiddenPartIds.includes(organGrp);
        const matchesIsolation =
          isolatedPartId === null ||
          isolatedPartId === mesh.uuid ||
          isolatedPartId === mesh.name ||
          isolatedPartId === organGrp ||
          (Boolean(isolatedGroupId) && isolatedGroupId === organGrp);

        const isVisible =
          visible &&
          activeSystems.visceral &&
          visOpacity >= 0.02 &&
          !isHidden &&
          (matchesIsolation || xrayGhostMode);

        mesh.visible = isVisible;
        mesh.raycast = isVisible
          ? ((mesh.userData.__origRaycast as THREE.Mesh['raycast']) ??
            THREE.Mesh.prototype.raycast)
          : NOOP_RAYCAST;
        if (isVisible) {
          mesh.layers.enable(0);
          enqueueGeometryBVH(mesh.geometry);
        } else {
          mesh.layers.disable(0);
        }

        const isFocusTarget =
          selectedPart !== null &&
          (selectedPart.meshUuid === mesh.uuid ||
            selectedPart.rawName === mesh.name ||
            selectedPart.organGroupId === organGrp);
        const isGhost = xrayGhostMode && !matchesIsolation;
        const effectiveOpacity = isGhost ? 0.1 : visOpacity;
        const isTranslucent = xrayGhostMode || effectiveOpacity < 0.85;

        const shouldSlice =
          slicing.enabled &&
          (slicing.scope === 'all' ||
            (slicing.scope === 'selected' && isFocusTarget));

        const targetMats = [
          mesh.userData?.__sharedMaterial,
          mesh.userData?.__highlightMaterial,
          mesh.material,
        ];
        const visited = new Set<THREE.Material>();
        for (const mEntry of targetMats) {
          if (!mEntry) continue;
          const list = Array.isArray(mEntry) ? mEntry : [mEntry];
          for (const rawMat of list) {
            if (!rawMat || visited.has(rawMat)) continue;
            visited.add(rawMat);
            const mat = rawMat as THREE.MeshStandardMaterial;
            mat.clippingPlanes = shouldSlice ? clippingPlanesList : null;
            mat.clipShadows = shouldSlice;
            mat.transparent = isTranslucent || effectiveOpacity < 1;
            mat.opacity = effectiveOpacity;
            mat.depthWrite = !isTranslucent && effectiveOpacity >= 0.99;
            mat.side = shouldSlice ? THREE.DoubleSide : THREE.FrontSide;
            mat.shadowSide = mat.side;
          }
        }

        const overrideOpacity = resolveMeshOpacityOverride(
          mesh,
          partOpacityOverrides
        );
        applyMeshPartOpacityOverride(
          mesh,
          overrideOpacity,
          isTranslucent || effectiveOpacity < 1 ? 10 : 2
        );
      }
    }
    invalidate();
  }, [
    mountVersion,
    visible,
    activeSystems.visceral,
    systemOpacity.visceral,
    hiddenPartIds,
    isolatedPartId,
    partOpacityOverrides,
    xrayGhostMode,
    slicing.enabled,
    slicing.scope,
    selectedPart,
    invalidate,
  ]);

  const pelvicSpecs = useMemo(
    () =>
      FEMALE_ORGAN_SPECS.filter((s) =>
        (FEMALE_PELVIC_ORGAN_IDS as readonly string[]).includes(s.id)
      ),
    []
  );
  const mammaryLeftSpec = useMemo(
    () =>
      FEMALE_ORGAN_SPECS.find(
        (s) => s.id === FEMALE_MAMMARY_ORGAN_IDS[0]
      )!,
    []
  );
  const mammaryRightSpec = useMemo(
    () =>
      FEMALE_ORGAN_SPECS.find(
        (s) => s.id === FEMALE_MAMMARY_ORGAN_IDS[1]
      )!,
    []
  );

  return (
    <group
      ref={rootGroupRef}
      visible={visible && activeSystems.visceral}
      name="Female_ZAnatomy_Internal_Organs"
    >
      <group
        ref={pelvicGroupRef}
        name="Female_Pelvic_Visceral_Complex"
      >
        {pelvicSpecs.map((spec) => (
          <Suspense key={spec.id} fallback={null}>
            <FemaleOrganPieceLoader
              spec={spec}
              url={nihUrlMap.get(spec.id) || spec.defaultLocalPath}
              landmarksCatalog={landmarksCatalog}
              onLoaded={handlePieceLoaded}
              onDisposed={handlePieceDisposed}
            />
          </Suspense>
        ))}
      </group>

      <group
        ref={mammaryLeftGroupRef}
        name="Female_Mammary_Gland_Left"
      >
        <Suspense fallback={null}>
          <FemaleOrganPieceLoader
            spec={mammaryLeftSpec}
            url={
              nihUrlMap.get(mammaryLeftSpec.id) ||
              mammaryLeftSpec.defaultLocalPath
            }
            landmarksCatalog={landmarksCatalog}
            onLoaded={handlePieceLoaded}
            onDisposed={handlePieceDisposed}
          />
        </Suspense>
      </group>

      <group
        ref={mammaryRightGroupRef}
        name="Female_Mammary_Gland_Right"
      >
        <Suspense fallback={null}>
          <FemaleOrganPieceLoader
            spec={mammaryRightSpec}
            url={
              nihUrlMap.get(mammaryRightSpec.id) ||
              mammaryRightSpec.defaultLocalPath
            }
            landmarksCatalog={landmarksCatalog}
            onLoaded={handlePieceLoaded}
            onDisposed={handlePieceDisposed}
          />
        </Suspense>
      </group>
    </group>
  );
};
