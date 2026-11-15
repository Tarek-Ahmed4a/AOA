# AOA Technical Diagnostic Report (Read-Only Snapshot)

> **Mode:** Strict Read-Only Diagnostic Inspection (zero source files, assets, scripts, or configs modified).  
> **Goal:** Document exact factual root causes across performance, Tab 2 (`Live 3D Explorer`), Tab 3 (`Reference Books PDF`) + Android `404` / top header layout, and packaging/build asset sizes.

---

## Executive Summary of Findings

1. **WebGL & `Full Body` Lag (Tab 1 & Tab 2):**
   - **2 concurrent WebGL `<Canvas>` contexts** can live in VRAM once Tab 2 loads a native model (`App.tsx:54`, `LiveScientificExplorer.tsx:1502`), though the inactive one pauses via `frameloop="never"`.
   - When active, `<Canvas frameloop="always">` (`AnatomyViewport.tsx:409`) re-renders **2,134 unmerged draw calls / 3,416,994 triangles** in Male `Full Body` (`skeletal + muscular + visceral`) — or **2,171 draw calls / 4,070,546 triangles** with the 7 female organs loaded, and up to **4,268 draw calls / 7,673,312 triangles** with all 6 Z-Anatomy GLBs visible — at up to `1.35` DPR continuously every frame, with **zero mesh merging or instancing**.
   - Corrections vs. initial hypotheses: `<Canvas shadows={false}>` (`AnatomyViewport.tsx:410`), `BVH` (`computeBoundsTree()`) runs **asynchronously in 5-geometry idle chunks** (`bvhSetup.ts:118-149`), and Z-Anatomy meshes share **`61` pooled `MeshStandardMaterial`s** (`NihManifestOrgan.tsx:116-165`), **not** `5,784` per-mesh cloned materials or `5,784` sync BVH builds (only the 7 NIH female organs clone per mesh — `37` meshes — in `femaleZAnatomyRegistration.ts:188`, plus temporary highlight clones in `MeshHighlightController`).
2. **Tab 2 (`Live 3D Explorer`) Broken Models & Controls:**
   - Sketchfab `<iframe>` (`CLOUD STAGE`) is gone; Tab 2 now opens everything inside a second `<AnatomyViewport />` via `launchInLocalEngine` (`LiveScientificExplorer.tsx:1367-1492`).
   - **Cardiovascular / Nervous / Integumentary / Heart / Brain / Spinal Cord models open completely blank/invisible** because `loadCustomGlb` (`useAnatomyStore.ts:769`) resets `activeSystems` to `DEFAULT_ACTIVE_SYSTEMS` (`useAnatomyStore.ts:189-196`, where `cardiovascular: false, nervous: false, integumentary: false`), and `CustomGlbModel` (`AnatomicalModelManager.tsx:680, 700`) sets `mesh.visible = false` for disabled systems.
   - Sketchfab queries frequently hit empty Z-Anatomy matches -> point clouds (`faces: 0`) / `8000ms` timeout aborts -> fall back to `resolveLocalFallbackGlb` (`cloudDissectionBridge.ts:235-285`), which maps **`stomach|gastric` to `small-intestine-{sex}.glb`** (wrong organ!), routes single organs to partial NIH cutouts, and triggers `CRANIAL_SKULL_REQUEST_REGEX` / `CRANIAL_MESH_KEEP_REGEX` (`AnatomicalModelManager.tsx:281-330`) cropping `skeletal.glb` when loading skull queries.
   - Dissection wiring bugs: `ExternalSpatialCalloutPin` (`AnatomicalModelManager.tsx:1946, 1965, 1973`) omits the `registry` argument (querying Tab 1's `defaultSceneMeshRegistry` instead of Tab 2's `explorerRegistry`), and `AnatomicalInspectorSidebar.tsx:47, 62` reads `activeTab` from the viewport store (`'master-atlas'`) instead of `useAppNavigationStore`.
3. **Tab 3 (`Reference Books PDF`) Mobile `404` & Top Bar Check:**
   - **Mobile `404` root cause:** `PdfReferenceBooksView.tsx:321` hardcodes `const [localStatus] = useState<'checking' | 'ready' | 'missing'>('ready');` (without checking `HEAD` on `localResolvedUrl`), so on Capacitor Native (`isNative === true`), `activeAndroidStreamUrl` (`PdfReferenceBooksView.tsx:547-553`) unconditionally sends `https://localhost/books/book1-netters-atlas-7ed.pdf` to PDF.js even after `cleanMobileBuild.mjs --strip-pdfs` stripped both `.pdf` binaries from `dist/books/`.
   - **Top switcher check:** In current `HEAD`, **only** `MinimalHud.tsx:571-616` renders `<nav role="tablist" aria-label="Workspace View Switcher">`; `PdfReferenceBooksView.tsx:993-1034` renders no header/switcher (verified both in TSX and as a single occurrence in compiled `dist/assets/index-CV-lY44r.js`).
4. **Build & Asset Packaging Sizes:**
   - `package.json` contains **no `"build"` key**; `electron-builder.yml` is the sole config (`304.55 MiB` PDFs included in PC `app.asar`; unused `61.56 MiB` `dist/models/female/` excluded).
   - `dist/` currently totals **`458.34 MB` (`437.10 MiB`)** (including desktop PDFs and unused `female/`). `android/app/src/main/assets/public/` does not exist locally until `npm run cap:sync` runs `cleanMobileBuild.mjs --strip-pdfs`, which strips `dist/books/*.pdf`, `dist/models/female/`, and non-7-female NIH `.glb`s.

---

## Section 1: WebGL & `Full Body` Performance Bottleneck Analysis

### 1.1 `<Canvas>` Instances Across `App.tsx` and Child Components

- **Source declarations:** There is **1** R3F `<Canvas>` definition (`src/components/canvas/AnatomyViewport.tsx:408`), inside `<AnatomyViewport />`. (`PdfReferenceBooksView.tsx:289, 623` uses 2D HTML `<canvas>` elements for PDF.js rendering/ink drawing, not WebGL.)
- **Simultaneous runtime WebGL `<Canvas>` mounts:** **Up to 2 WebGL `<Canvas>` contexts are mounted simultaneously**:
  1. **Tab 1 (`3D Master Atlas`) — Permanently mounted** in `src/App.tsx:51-57`:
     ```tsx
     {/* Persistent Tab 1: 3D Master Atlas Canvas */}
     <AnatomyStoreProvider store={masterAnatomyStore}>
       <SceneMeshRegistryProvider registry={defaultSceneMeshRegistry}>
         <ClippingPlaneProvider plane={ACTIVE_CLIPPING_PLANE}>
           <AnatomyViewport active={activeTab === 'master-atlas'} />
         </ClippingPlaneProvider>
       </SceneMeshRegistryProvider>
     </AnatomyStoreProvider>
     ```
  2. **Tab 2 (`Live 3D Explorer`) — Permanently retained after first native model launch** in `src/App.tsx:59-66` and `src/components/canvas/LiveScientificExplorer.tsx:1501-1507`:
     ```tsx
     {hasMountedNativeStage && (
       <AnatomyViewport
         active={isNativeStageVisible}
         mountScene={hasMountedNativeStage}
         showStreamingHud={false}
       />
     )}
     ```
  - Inactive viewports are visually hidden (`invisible pointer-events-none -z-10`) and set `frameloop="never"` (`AnatomyViewport.tsx:403-409`), so only one renders per frame, **but both WebGL contexts, GLTF scenes, geometries, and GPU buffers stay resident in memory simultaneously** across tab switches.

### 1.2 Exact `<Canvas>` JSX, Lighting, Effects & Shadow Flags (`src/components/canvas/AnatomyViewport.tsx`)

- **Lighting & IBL Environment (`src/components/canvas/AnatomyViewport.tsx:257-326`):**
  ```tsx
  const ClinicalEnvironment: React.FC = () => {
    const { gl, scene } = useThree();

    useEffect(() => {
      const pmremGenerator = new THREE.PMREMGenerator(gl);
      pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);

      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.36;

      return () => {
        scene.environment = null;
        envTarget.dispose();
        roomEnv.dispose();
        pmremGenerator.dispose();
      };
    }, [gl, scene]);

    return null;
  };

  /**
   * Universal camera-locked 3-point surgical raking light rig.
   * Parented once to the active PerspectiveCamera so oblique surface relief
   * rotates automatically with zero per-frame JS work.
   */
  export const CameraRakingLightRig: React.FC = () => {
    const { camera } = useThree();

    useEffect(() => {
      const keyLight = new THREE.DirectionalLight('#fffcf5', 1.85);
      keyLight.position.set(3.2, 2.8, 1.0);
      keyLight.target.position.set(0, 0, -3.2);

      const fillLight = new THREE.DirectionalLight('#fff7ed', 0.65);
      fillLight.position.set(-4.0, -2.05, 0.8);
      fillLight.target.position.set(0, 0, -3.2);

      const rimLight = new THREE.DirectionalLight('#bae6fd', 0.55);
      rimLight.position.set(1.7, 2.44, -8.4);
      rimLight.target.position.set(0, 0, -3.2);

      const attached: THREE.Object3D[] = [
        keyLight,
        keyLight.target,
        fillLight,
        fillLight.target,
        rimLight,
        rimLight.target,
      ];
      attached.forEach((obj) => camera.add(obj));

      return () => {
        attached.forEach((obj) => camera.remove(obj));
      };
    }, [camera]);

    return <ambientLight intensity={0.28} color="#f8fafc" />;
  };

  const StudioLighting: React.FC = () => {
    return (
      <>
        <ClinicalEnvironment />
        <CameraRakingLightRig />
      </>
    );
  };
  ```

- **Exact `<Canvas>` JSX (`src/components/canvas/AnatomyViewport.tsx:408-439`):**
  ```tsx
      <Canvas
        frameloop={isAtlasActive ? 'always' : 'never'}
        shadows={false}
        dpr={[0.8, maxDpr]}
        gl={{
          antialias: true,
          stencil: true,
          alpha: false,
          logarithmicDepthBuffer: false,
          powerPreference: 'high-performance',
          localClippingEnabled: true,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <color attach="background" args={['#000000']} />
        <ViewportFrameloopSync active={isAtlasActive} />
        <AdaptiveDpr pixelated />

        <PerspectiveCamera
          makeDefault
          fov={40}
          near={0.05}
          far={15}
          position={[0, 1.2, 3.2]}
        />

        <StudioLighting />
        <CameraRig />
        {mountScene && <AnatomicalModelManager />}
      </Canvas>
  ```

- **Shadow & Postprocessing Audit:**
  - `shadows={false}` on `<Canvas>` (`AnatomyViewport.tsx:410`), and none of the 3 `DirectionalLight`s set `castShadow`.
  - None of the Z-Anatomy meshes or main NIH manifest organs set `castShadow` / `receiveShadow`. Only the **7 female supplement organs** (`37` meshes) set `mesh.castShadow = true; mesh.receiveShadow = true;` in `src/utils/femaleZAnatomyRegistration.ts:207-208` — a GPU no-op while `<Canvas shadows={false}>` is set.
  - **Postprocessing:** **None** (no `EffectComposer`, SSAO, bloom, or postprocessing passes). Only `<AdaptiveDpr pixelated />`, PMREM `RoomEnvironment`, and ACESFilmic tone mapping (`1.05`).

### 1.3 Exact `public/models/zanatomy/*.glb` Sizes, Mesh/Primitive Counts & Vertices/Triangles

Measured directly on disk via `@gltf-transform/core` + `draco3d`:

| File (`public/models/zanatomy/`) | Exact Bytes | Size (MiB) | Size (MB) | GLTF Meshes | Primitives (Three.js Draw Calls) | Vertices | Triangles | GLTF Materials | Extensions / Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `cardiovascular.glb` | 7,438,496 | 7.09 MiB | 7.44 MB | 676 | 676 | 2,292,918 | 1,575,424 | 7 | `KHR_draco_mesh_compression` |
| `integumentary.glb` | 1,922,620 | 1.83 MiB | 1.92 MB | 310 | 750 | 478,240 | 284,994 | 6 | `KHR_draco_mesh_compression` |
| `muscular.glb` | 12,559,192 | 11.98 MiB | 12.56 MB | 624 | 853 | 3,605,564 | 1,759,152 | 7 | `KHR_draco_mesh_compression`, `KHR_mesh_quantization`, `extras.aoaMeshoptSimplified: true` |
| `nervous.glb` | 11,094,548 | 10.58 MiB | 11.09 MB | 582 | 708 | 3,156,568 | 2,395,900 | 17 | `KHR_draco_mesh_compression`, `KHR_mesh_quantization` |
| `skeletal.glb` | 4,917,452 | 4.69 MiB | 4.92 MB | 682 | 980 | 1,401,408 | 826,967 | 9 | `KHR_draco_mesh_compression`, `extras.aoaMeshoptSimplified: true` |
| `visceral.glb` | 2,985,752 | 2.85 MiB | 2.99 MB | 282 | 301 | 540,754 | 830,875 | 15 | `KHR_draco_mesh_compression` |
| **Total (6 Z-Anatomy GLBs)** | **40,918,060** | **39.02 MiB** | **40.92 MB** | **3,156** | **4,268** | **11,475,452** | **7,673,312** | **61** | `+ manifest.json` (`5,992` B) = `40,924,052` B (`39.03 MiB`), `0` textures |

- **Default `Full Body` Visible Subset (`DEFAULT_ACTIVE_SYSTEMS`: `skeletal + muscular + visceral`):**
  - **Male mode:** `980 + 853 + 301` = **`2,134` draw calls**, **`5,547,726` vertices**, **`3,416,994` triangles**.
  - **Female mode supplement (`public/models/nih/female/` 7 `.glb` files pre-mounted when warm):** `2,360,220` bytes total (`uterus-female.glb` `145,204` B / `11` prims / `40,950` tris; `ovary-female-left.glb` `3,184` B / `424` tris; `ovary-female-right.glb` `3,124` B / `410` tris; `fallopian-tube-female-left.glb` `67,416` B / `18,281` tris; `fallopian-tube-female-right.glb` `64,724` B / `17,770` tris; `mammary-gland-female-left.glb` `970,112` B / `8` prims / `270,791` tris; `mammary-gland-female-right.glb` `1,106,456` B / `8` prims / `304,926` tris) = **`+37` primitives / `+955,153` verts / `+653,552` tris**, bringing visible `Full Body` female mode to **`2,171` draw calls / `4,070,546` triangles**.
- **Standalone NIH folder (`public/models/nih/`, all `73` `.glb` files):** `25.88 MiB` (`27.14 MB` GLB bytes; `+ manifest.json` = `25.94 MiB` / `27,194,928` B), `1,516` meshes / `1,516` primitives, `6,207,391` vertices, `6,423,747` triangles. (Note: `4,268` Z-Anatomy primitives + `1,516` NIH primitives = `5,784` audited meshes total across manifests.)

### 1.4 `AnatomicalModelManager.tsx`, `useFrame`, `useEffect`, BVH, Draw Calls & Materials

1. **`useFrame` hooks:**
   - **`AnatomicalModelManager.tsx` contains `0` `useFrame` hooks.**
   - Across all of `src/`, there is **only `1` `useFrame` hook**: `CameraRig` in `src/components/canvas/AnatomyViewport.tsx:218`, which only lerps camera/OrbitControls target during active `'reset'` or `'focus'` camera flights and early-returns when `flightModeRef.current === 'idle'`.
   - **Important:** Because `<Canvas frameloop={isAtlasActive ? 'always' : 'never'}>` (`AnatomyViewport.tsx:409`) runs in `'always'` mode whenever a 3D tab is open, R3F + WebGL still re-renders the entire scene (**2,134–4,268 draw calls / 3.42M–7.67M triangles**) continuously at 60Hz even while completely idle.

2. **`useEffect` hooks in `AnatomicalModelManager.tsx` (plus child/helper components):**
   - `CustomGlbModel`:
     - Line `558`: Registers/unregisters all `registeredMeshes` in `SceneMeshRegistry`.
     - Line `565`: Filters `catalogParts` and updates store via `registerCatalog`.
     - Line `572`: Unmount cleanup / geometry-material disposal.
     - Line `595`: Iterates all `registeredMeshes` applying `applyRigidMacroExplodeOffset` on `explodeFactor` change.
     - Line `625`: Iterates `sharedMaterials` and all `registeredMeshes` updating clipping plane, opacity, sex filter, peel/hide, isolate, layers, raycast, and `renderOrder`.
   - `SketchfabSystemGlbContent`:
     - Line `1670`: Registers/unregisters all `registeredMeshes` in `SceneMeshRegistry` and invokes `onSceneReady`.
     - Line `1679`: Unmount cleanup / disposal.
     - Line `1698`: Iterates `sharedMaterials` and **all `registeredMeshes` (up to `4,268` Z-Anatomy primitives)** updating opacity, clipping plane, `mesh.visible` (`activeSystems`, sex filter, hidden/isolated state), and `renderOrder` whenever system toggles, opacity, sex, slicing, peel, or isolate state changes.
     - Line `1855`: Iterates all `registeredMeshes` applying `FEMALE_PELVIS_SCALE_*` and `applyRigidMacroExplodeOffset`.
   - `ExternalSpatialCalloutPin`:
     - Line `1944`: Recomputes 3D callout pin world coordinates on `selectedPart` / `explodeFactor` change.
   - `MeshHighlightController`:
     - Line `2027`: Calls `restoreAll()` and iterates `registry.byUuid.values()` (up to `~4,300` entries) in `collectGroupSiblings` on hover/selection/system/catalog changes, swapping highlight clones onto matching meshes.
   - `NativeCanvasClickPicker`:
     - Line `2180`: Attaches `pointerdown`/`pointerup` tap listener (`<5px` & `<400ms`) on `gl.domElement`; on tap, iterates `registry.byUuid.values()` to collect visible meshes and runs `firstHitOnly` BVH raycasting.
   - `AnatomicalModelManager`:
     - Line `2334`: `1100ms` timeout setting `femaleSupplementWarm = true` (pre-mounts the 7 female `.glb`s when warm).
     - Line `2346`: Fetches NIH manifest (`fetchNihSceneOrgans`).
     - Line `2362`: Fetches `/models/zanatomy/manifest.json`.
     - Line `2394`: Cleanup.
     - Line `2458`: Iterates all `registry.byUuid.values()` on `activeAtlasPreset` / `activeSystems` / `biologicalSex` change to rebuild the searchable part catalog via `registerCatalog(parts)`.
   - Companion components: `NihManifestOrgan.tsx` (`4` `useEffect`s at lines `366, 376, 396, 421`), `FemaleZAnatomyOrgansGroup.tsx` (`4` `useEffect`s including lines `293, 301, 439, 448, 479`), and `SlicingPlaneGizmo.tsx` (`2` `useEffect`s at lines `73, 80` plus `useLayoutEffect` at `130`).

3. **Does `computeBoundsTree()` (BVH) run synchronously on all 5,784 meshes during load?**
   - **No.** `enqueueGeometryBVH` (`src/utils/bvhSetup.ts:118-149`) processes queued `BufferGeometry` instances asynchronously in **5-geometry chunks** via `requestIdleCallback(processBvhChunk, { timeout: 50 })` (or `setTimeout(..., 16)` fallback). However, with `4,268` Z-Anatomy primitives loaded concurrently, that spreads ~850 idle callbacks over multiple seconds after startup. Also `fastConditionalRaycast` (`bvhSetup.ts:151-159`) skips raycasting while `cameraInteractionState.isOrbiting` is true.

4. **Are meshes merged/instanced, or separate draw calls?**
   - **Zero merging and zero instancing.** Every primitive in Z-Anatomy (`2,134` in Male `Full Body`, up to `4,268` across all 6 systems, `+37` female organs) and NIH is rendered as an **individual `THREE.Mesh` draw call**. Combined with `3.42M–7.67M` triangles, `RoomEnvironment` PBR IBL + 3 `DirectionalLight`s, DPR up to `1.35`, and `frameloop="always"`, this draw-call and triangle load directly bottlenecks CPU WebGL command submission and mobile/integrated GPUs.

5. **Are materials `.clone()`d for every single mesh?**
   - **No (for Z-Anatomy & main NIH organs), Yes (only for the 7 female organs & active highlight siblings):**
     - `NihManifestOrgan.tsx:116-165` (`getOrCreateSharedStandardMaterial`) pools `THREE.MeshStandardMaterial` by visual signature, so the **`3,156` Z-Anatomy meshes / `4,268` primitives share only `61` materials** (`7+6+7+17+9+15`).
     - Per-mesh `.clone()` occurs only in `calibrateFemaleZAnatomyMaterials` (`femaleZAnatomyRegistration.ts:188`, cloning `37` materials for the 7 female `.glb` files) and dynamically in `MeshHighlightController` (`clinicalReliefShader.ts` / `AnatomicalModelManager.tsx:2027`) for the currently hovered/selected/isolated structure group.
     - Therefore, the `Full Body` lag is driven primarily by **2,134–4,268 unmerged draw calls + 3.42M–7.67M triangles + continuous 60Hz `frameloop="always"` rendering + `~4,300`-mesh JS `useEffect` traversals on state change**, rather than 5,784 distinct material shader switches.

---

## Section 2: Tab 2 (`Live 3D Explorer`) Model Loading & Dissection Wiring

### 2.1 Exact Flow When Clicking `"Load in 3D Engine"` (`src/components/canvas/LiveScientificExplorer.tsx:1367-1492`)

When the user clicks `"Load in 3D Engine"` on any card (Sketchfab, NIH, BodyParts3D, or Z-Anatomy), `launchInLocalEngine(card)` executes:

```tsx
  const launchInLocalEngine = useCallback(
    async (card: ExplorerModelCard) => {
      setLoadingCardId(card.id);
      setStatusMessage(null);

      try {
        if (card.glbUrl) {
          loadExplorerCloudModel(null);
          loadCustomGlb(resolveAssetUrl(card.glbUrl), card.title);
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'native',
            glbUrl: card.glbUrl,
            system: card.system,
          });
          return;
        }

        const matchedBundle = card.localBundlePreset
          ? {
              preset: card.localBundlePreset,
              system: card.system,
              isFullBody: card.localBundlePreset === 'zanatomy-full-body',
            }
          : card.sourceKind === 'z-anatomy'
            ? matchZAnatomySystemBundle(card.title)
            : null;

        if (matchedBundle) {
          loadExplorerCloudModel(null);
          const bundleGlbUrl = ZANATOMY_PRESET_GLB_URL[matchedBundle.preset];
          if (bundleGlbUrl && !matchedBundle.isFullBody) {
            loadCustomGlb(resolveAssetUrl(bundleGlbUrl), card.title);
          } else {
            setActiveAtlasPreset('zanatomy-full-body');
          }
          setExplorerOpenedModel({
            key: card.id,
            title: card.title,
            sourceLabel: card.sourceLabel,
            kind: 'native',
            presetId: matchedBundle.preset,
            glbUrl: bundleGlbUrl ?? undefined,
            system: matchedBundle.system,
          });
          return;
        }

        if (card.uid) {
          const headers = buildAuthHeaders();
          const dlAbort = new AbortController();
          const timeoutId = window.setTimeout(() => dlAbort.abort(), 8000);
          try {
            const dlRes = await fetch(
              `https://api.sketchfab.com/v3/models/${card.uid}/download`,
              { headers, signal: dlAbort.signal }
            );
            if (!dlRes.ok) {
              throw new Error(`Sketchfab download API HTTP ${dlRes.status}`);
            }
            const dlJson = (await dlRes.json()) as {
              glb?: { url?: string };
              gltf?: { url?: string };
            };
            const assetUrl = dlJson.glb?.url;
            if (!assetUrl) {
              throw new Error(
                'Sketchfab model does not provide a direct GLB binary.'
              );
            }
            const binaryRes = await fetch(assetUrl, {
              signal: dlAbort.signal,
            });
            if (!binaryRes.ok) {
              throw new Error(`GLB stream HTTP ${binaryRes.status}`);
            }
            const blob = await binaryRes.blob();
            const objectUrl = URL.createObjectURL(blob);

            loadExplorerCloudModel(null);
            loadCustomGlb(objectUrl, card.title);
            setExplorerOpenedModel({
              key: card.id,
              title: card.title,
              sourceLabel: card.sourceLabel,
              kind: 'native',
              glbUrl: objectUrl,
              system: card.system,
            });
            return;
          } finally {
            window.clearTimeout(timeoutId);
          }
        }

        throw new Error('No direct GLB URL available; falling back to local atlas.');
      } catch {
        const fallback = resolveLocalFallbackGlb(
          card.title,
          card.system,
          card.sex ?? biologicalSex
        );
        loadExplorerCloudModel(null);
        loadCustomGlb(resolveAssetUrl(fallback.glbUrl), card.title);
        setExplorerOpenedModel({
          key: card.id,
          title: card.title,
          sourceLabel: `${card.sourceLabel} (Local Engine)`,
          kind: 'native',
          glbUrl: fallback.glbUrl,
          system: fallback.system,
        });
      } finally {
        setLoadingCardId(null);
      }
    },
    [
      biologicalSex,
      loadCustomGlb,
      loadExplorerCloudModel,
      setActiveAtlasPreset,
      setExplorerOpenedModel,
    ]
  );
```

Trace by card source:
- **NIH / BodyParts3D cards (`card.glbUrl` set):** Take Branch 1 (`1373-1385`) directly into `loadCustomGlb(resolveAssetUrl(card.glbUrl), card.title)`.
- **Z-Anatomy cards (`card.localBundlePreset` or `card.sourceKind === 'z-anatomy'`):** Take Branch 2 (`1387-1415`), loading `ZANATOMY_PRESET_GLB_URL[matchedBundle.preset]` via `loadCustomGlb` (for individual systems) or `setActiveAtlasPreset('zanatomy-full-body')`.
- **Sketchfab cards (`card.uid` set, no `glbUrl` / `matchedBundle`):** Attempt `GET https://api.sketchfab.com/v3/models/${card.uid}/download` + GLB binary download with an `8000ms` abort timer (`1417-1462`). On any error, non-GLB archive, or 8s timeout, Branch 4 (`1465-1481`) silently catches and invokes `resolveLocalFallbackGlb(...)` (`src/utils/cloudDissectionBridge.ts`).

### 2.2 Why Models Open Incomplete, Wrong, or Invisible in Tab 2

1. **`loadCustomGlb` turns OFF `cardiovascular`, `nervous`, and `integumentary` (`useAnatomyStore.ts:189-196, 769` + `AnatomicalModelManager.tsx:680, 700`):**
   - `DEFAULT_ACTIVE_SYSTEMS` sets `integumentary: false`, `cardiovascular: false`, `nervous: false`, while `skeletal`, `muscular`, and `visceral` default to `true`.
   - `loadCustomGlb` resets `activeSystems: { ...DEFAULT_ACTIVE_SYSTEMS }`, and `CustomGlbModel` sets `mesh.visible = activeSystems[sys]`.
   - Opening **`Angiology`** (`cardiovascular.glb`), **`Neurology`** (`nervous.glb`), **`Integumentary`**, or any NIH/Sketchfab card tagged `'cardiovascular' | 'nervous' | 'integumentary'` (e.g. heart, brain, spinal cord) leaves **every loaded mesh hidden (`mesh.visible = false`)** unless the user notices and enables that system in Layer Manager!

2. **Sketchfab `/download` Failures & `8000ms` Timeout Aborts:**
   - Live Sketchfab search queries (such as `"Human Female Skull"`) return empty for `user=Z-Anatomy` and fall back to generic `science-technology` results containing point clouds (`faces: 0`, e.g., `47107f5d88f24cc9b051642501a64a9e` `VHF Skull Point Cloud` and `208 MB` `76115e69f3304172835cfce7cc6714a8` `Full CT Head Point Cloud`).
   - Although `/v3/models/{uid}/download` returns `200`, streaming multi-hundred-MB archives exceeds the `8000ms` `AbortController` (`LiveScientificExplorer.tsx:1420`) or lacks `dlJson.glb?.url`, throwing into `catch` -> `resolveLocalFallbackGlb`.

3. **Broken Fallbacks in `resolveLocalFallbackGlb` (`src/utils/cloudDissectionBridge.ts:235-285`) & Skull Cropping (`AnatomicalModelManager.tsx:281-330`):**
   - Look at `cloudDissectionBridge.ts:259-270`:
     ```ts
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
     ```
     **Any `Stomach` / `Gastric` search card falls back to `small-intestine-{sex}.glb`**, loading the small intestine instead of a stomach!
   - Broad search queries containing organ keywords (`pancreas`, `spleen`, `colon`, `thymus`, etc.) fall back to a **single small NIH `.glb` sub-organ file** (`public/models/nih/`), which is an isolated anatomical cutout rather than a full regional/system model.
   - **Skull clipping:** When skull queries route to `skeletal.glb`, `CustomGlbModel` applies `CRANIAL_SKULL_REQUEST_REGEX` / `CRANIAL_MESH_KEEP_REGEX` (`AnatomicalModelManager.tsx:281-330`) to hide meshes below `skullLowerBound`, which can hide/crop skeletal structures whose mesh names fail the regex.

### 2.3 How the 3D Stage & Dissection Controls Work Inside `LiveScientificExplorer.tsx` vs. Tab 1

- **Exact 3D Stage JSX in `src/components/canvas/LiveScientificExplorer.tsx:1494-1521`:**
  ```tsx
  const isCloudTabActive = activeTab === 'cloud-explorer';
  const isNativeStageVisible =
    isCloudTabActive && explorerOpenedModel?.kind === 'native';
  const isCatalogVisible = isCloudTabActive && explorerOpenedModel === null;

  return (
    <>
      {hasMountedNativeStage && (
        <AnatomyViewport
          active={isNativeStageVisible}
          mountScene={hasMountedNativeStage}
          showStreamingHud={false}
        />
      )}

      {isNativeStageVisible && (
        <button
          type="button"
          onClick={() => {
            loadExplorerCloudModel(null);
            setExplorerOpenedModel(null);
          }}
          className="pointer-events-auto fixed bottom-14 left-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-950/90 px-3.5 py-2 font-mono text-[11px] font-semibold text-zinc-100 shadow-2xl backdrop-blur-xl transition-all hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-white active:scale-95 md:bottom-4 md:left-4"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-sky-400" />
          <span>Back to Search Results</span>
        </button>
      )}
  ```

- **Why Tab 2 (`LiveScientificExplorer`) Controls Behave Differently or Break vs. Tab 1:**
  - `LiveScientificExplorer.tsx` does **not** render its own custom `Isolate`/`Peel`/`Slice`/`Explode` buttons anymore; `App.tsx:71-84` switches the shared `<MinimalHud />`, `<SystemLayerManager />`, and `<AnatomicalInspectorSidebar />` to `explorerAnatomyStore`, `explorerRegistry`, and `explorerClippingPlane` when `isExplorerNativeActive` is true.
  - However, wiring gaps still break parity with Tab 1:
    1. **`ExternalSpatialCalloutPin` uses the wrong registry** (`AnatomicalModelManager.tsx:1946, 1965, 1973`): calls `getRegisteredSceneMesh(...)` **without** passing the local `registry` from `useSceneMeshRegistry()`, so it looks up meshes in Tab 1's `defaultSceneMeshRegistry` instead of Tab 2's `explorerRegistry`.
    2. **`AnatomicalInspectorSidebar` reads stale `activeTab`** (`AnatomicalInspectorSidebar.tsx:47, 62`): reads `useAnatomyStore((s) => s.activeTab)` (stuck on `'master-atlas'`) rather than `useAppNavigationStore`.
    3. **`CustomGlbModel` + `DEFAULT_ACTIVE_SYSTEMS` mismatches:** Any custom `.glb` classified as `cardiovascular`, `nervous`, or `integumentary` starts with its meshes hidden (`visible = false`), and single-mesh NIH fallback models have only `1` primitive/mesh — making `Isolate`, `Peel` (hides the only object), and `Explode` (zero sibling clusters to separate) appear broken compared to Tab 1's multi-mesh Z-Anatomy preset.

---

## Section 3: Tab 3 (`Reference Books PDF`) & Mobile Top Bar Duplication

### 3.1 Top Bar Switcher Check (`MinimalHud.tsx` vs. `PdfReferenceBooksView.tsx`)

- **Are both components rendering `[3D Atlas | Explorer | Books]` simultaneously in current `HEAD`?**
  - **No.** In current `src/` (`HEAD`) and in the built bundle (`dist/assets/index-CV-lY44r.js`):
    - **`MinimalHud.tsx` (`571-616`) is the ONLY component in the codebase rendering `<nav role="tablist" aria-label="Workspace View Switcher">`** (`"Workspace View Switcher"` and `"3D Master Atlas"` each occur **exact count = `1`** in `dist/assets/index-CV-lY44r.js`).
    - **`PdfReferenceBooksView.tsx` (`993-1034`) renders NO header and NO tab switcher** — only the full-screen library grid padded down by `pt-[46px] md:pt-[52px]` to sit beneath `MinimalHud`'s fixed top `<header>`.
    - Compiled CSS (`dist/assets/index-Dy9lFH_s.css`) also confirms `.hidden{display:none}` is emitted before `@media(min-width:768px){... .md:inline{display:inline} ... .md:hidden{display:none}}`, so responsive mobile/desktop labels never double-render.
  - **Explanation for reported Android duplication / header crowding:** Any double `[3D Atlas | Explorer | Books]` bar seen on an installed Android APK would come from an **older APK build synced before `MinimalHud` unification** (or stale `android/app/src/main/assets/public` prior to `cleanMobileBuild.mjs`), **or** from Tab 3 placing its 3-button Book selector `[📘 1 | 📗 2 | ⚖️]` (`MinimalHud.tsx:366-417`) on the same horizontally scrollable row immediately to the left of `[3D Atlas | Explorer | Books]` (`571-616`).

- **Exact Top Header JSX in `src/components/ui/MinimalHud.tsx:352-417, 570-649, 700-723` (Tab 3 active branch; focused-organ badge lines `419-440` and chapter `<select>` options lines `650-699` omitted cleanly outside code blocks):**
  ```tsx
      {/* Single Unified Top Header Bar (horizontally scrollable on mobile phones, zero squish/overflow) */}
      <header
        aria-label="Primary Studio Top Navigation"
        className={cn(
          'pointer-events-auto fixed left-0 right-0 z-50 flex items-center justify-between overflow-x-auto overflow-y-hidden flex-nowrap whitespace-nowrap touch-pan-x no-scrollbar scroll-smooth px-2 gap-2 md:left-3 md:right-3 md:px-0 md:overflow-visible',
          activeTab === 'pdf-books'
            ? 'top-1.5 h-10 md:top-2 md:h-11'
            : 'top-2 h-10 md:top-3 md:h-12'
        )}
      >
        {/* Top-Left Zone */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 md:min-w-0 md:flex-1">
          {activeTab === 'pdf-books' ? (
            <>
              <div
                role="group"
                aria-label="Reference Book Layout Selector"
                className="flex h-7 md:h-8 shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-0.5 shadow-xl backdrop-blur-md"
              >
                <button
                  type="button"
                  onClick={() => setPdfViewMode('book1')}
                  aria-pressed={pdfViewMode === 'book1'}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                    pdfViewMode === 'book1'
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                      : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                  )}
                >
                  <span>📘</span>
                  <span className="md:hidden"> 1</span>
                  <span className="hidden md:inline"> Book 1</span>
                  <span className="hidden xl:inline">: Atlas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfViewMode('book2')}
                  aria-pressed={pdfViewMode === 'book2'}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                    pdfViewMode === 'book2'
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                      : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                  )}
                >
                  <span>📗</span>
                  <span className="md:hidden"> 2</span>
                  <span className="hidden md:inline"> Book 2</span>
                  <span className="hidden xl:inline">: Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfViewMode('split')}
                  aria-pressed={pdfViewMode === 'split'}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-[10.5px] font-medium transition-all active:scale-95',
                    pdfViewMode === 'split'
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
                      : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                  )}
                >
                  <span>⚖️</span>
                  <span className="hidden md:inline"> Split View</span>
                </button>
              </div>
              {/* (+ optional focusedPdfBadge pill, lines 419-440) */}
            </>
          ) : (
            /* 3D preset & sex controls when activeTab !== 'pdf-books' (lines 443-567) */
            null
          )}
        </div>

        {/* Top-Center Zone: 3-Tab Minimalist Cockpit Switcher */}
        <nav
          role="tablist"
          aria-label="Workspace View Switcher"
          dir="ltr"
          className="pointer-events-auto flex shrink-0 items-center gap-0.5 md:gap-1 rounded-full border border-white/10 bg-[#0a0a0c]/90 p-0.5 md:p-1 shadow-2xl backdrop-blur-md"
        >
          {(
            [
              {
                id: 'master-atlas',
                mobileLabel: '3D Atlas',
                label: '3D Master Atlas',
              },
              {
                id: 'cloud-explorer',
                mobileLabel: 'Explorer',
                label: 'Live 3D Explorer',
              },
              {
                id: 'pdf-books',
                mobileLabel: 'Books',
                label: 'Reference Books (PDF)',
              },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[9.5px] md:px-3 md:text-[11px] font-medium tracking-wide transition-all active:scale-95',
                  isActive
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.16)]'
                    : 'border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                )}
              >
                <span className="md:hidden">{tab.mobileLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Top-Right Zone (when activeTab === 'pdf-books') */}
        <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-1.5 md:min-w-0 md:flex-1">
          {isNativeViewportActive && <AnatomicalSearchBar />}
          {activeTab === 'pdf-books' && (
            <>
              <form
                onSubmit={handlePdfPageSubmit}
                className="flex h-7 md:h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-[#0a0a0c]/90 px-1.5 md:px-2 shadow-xl backdrop-blur-md"
              >
                <label
                  htmlFor="header-pdf-page-jump"
                  className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-zinc-400"
                >
                  Pg
                </label>
                <input
                  id="header-pdf-page-jump"
                  type="number"
                  min={1}
                  value={pdfPageInput}
                  onChange={(e) => setPdfPageInput(e.target.value)}
                  aria-label="Quick Page Jump"
                  className="w-8 md:w-11 bg-transparent text-center font-mono text-[10.5px] md:text-[11px] tabular-nums text-white outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-white/10 px-1.5 md:px-2 py-0.5 font-mono text-[9.5px] md:text-[10px] font-medium text-zinc-200 transition-colors hover:bg-sky-500/20 hover:text-sky-300"
                >
                  Go
                </button>
              </form>
              {/* (+ chapter <select>, lines 650-698) */}
              <button
                type="button"
                onClick={() => pdfFileInputRef.current?.click()}
                title="Open a local .pdf file into active reader pane"
                className="flex h-7 md:h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-[#0a0a0c]/90 px-2 md:px-2.5 font-mono text-[10px] font-medium text-zinc-200 shadow-xl backdrop-blur-md transition-all hover:border-sky-500/40 hover:bg-sky-500/15 hover:text-sky-300 active:scale-95"
              >
                <span aria-hidden="true">📂</span>
                <span className="hidden lg:inline">Open PDF</span>
              </button>
            </>
          )}
        </div>
      </header>
  ```

- **Exact Root Container JSX in `src/components/ui/PdfReferenceBooksView.tsx:993-1034` (confirms no top bar/switcher):**
  ```tsx
  return (
    <section
      ref={rootRef}
      aria-label="Reference Anatomy Textbooks Library"
      className={cn(
        'fixed inset-0 z-20 flex h-dvh w-dvw flex-col bg-black',
        isFullscreen ? 'p-1.5' : 'px-1.5 pb-1 pt-[46px] md:pt-[52px]'
      )}
    >
      <div
        className={cn(
          'grid h-full min-h-0 flex-1 gap-2',
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {(viewMode === 'book1' || viewMode === 'split') && (
          <PdfFramePane
            book={book1}
            customUrl={customOverrides.book1?.url}
            pageNumber={book1Page}
            navNonce={book1Nonce}
            searchKeyword={searchKeyword}
            onJumpPage={jumpBook1}
            onSelectLocalFile={(file) => loadLocalPdf('book1', file)}
          />
        )}

        {(viewMode === 'book2' || viewMode === 'split') && (
          <PdfFramePane
            book={book2}
            customUrl={customOverrides.book2?.url}
            pageNumber={book2Page}
            navNonce={book2Nonce}
            searchKeyword={searchKeyword}
            onJumpPage={jumpBook2}
            onSelectLocalFile={(file) => loadLocalPdf('book2', file)}
          />
        )}
      </div>
    </section>
  );
  ```

### 3.2 Why Android Returns `404` for `https://localhost/books/book1-netters-atlas-7ed.pdf`

1. **Exact Book Files & Sizes on Disk:**

   | Directory | Exists Locally? | Exact Contents & Sizes |
   | --- | --- | --- |
   | `public/books/` | Yes (`3` files, `304.55 MiB` / `319.34 MB`) | `book1-netters-atlas-7ed.pdf`: `120,610,693` B (`115.02 MiB`)<br>`book2-grays-anatomy-4ed.pdf`: `198,719,430` B (`189.51 MiB`)<br>`manifest.json`: `13,914` B (`0.01 MiB`) |
   | `dist/books/` | Yes (`3` files, `304.55 MiB` / `319.34 MB`) | `book1-netters-atlas-7ed.pdf`: `120,610,693` B (`115.02 MiB`)<br>`book2-grays-anatomy-4ed.pdf`: `198,719,430` B (`189.51 MiB`)<br>`manifest.json`: `13,914` B (`0.01 MiB`) |
   | `android/app/src/main/assets/public/books/` | **MISSING** (`android/app/src/main/assets/public` absent locally; `/android/` is in `.gitignore`) | When built in CI or via `npm run cap:sync`, `node scripts/cleanMobileBuild.mjs --strip-pdfs` (`cleanMobileBuild.mjs:112-116`) **deletes all `.pdf` files from `dist/books/` BEFORE `npx cap sync android`**, so the APK's `assets/public/books/` contains **only `manifest.json` (`13,914` B) and `0` `.pdf` binaries**. |

2. **Root Cause in `PdfReferenceBooksView.tsx` (`319-321`, `541-578`, `160-173`):**
   - Look at `PdfFramePane` (`PdfReferenceBooksView.tsx:319-321, 546-578`):
     ```tsx
     const isNative = useMemo(() => isCapacitorNative(), []);
     const localResolvedUrl = resolveAssetUrl(customUrl ?? book.url);
     const [localStatus] = useState<'checking' | 'ready' | 'missing'>('ready');
     const [remoteStreamActive, setRemoteStreamActive] = useState(false);
     ...
     const canRenderIframe = localStatus === 'ready' && !isNative;
     const activeAndroidStreamUrl = customUrl
       ? localResolvedUrl
       : localStatus === 'ready'
         ? localResolvedUrl
         : remoteStreamActive && book.remoteFallbackUrl
           ? book.remoteFallbackUrl
           : null;
     ```
   - **Exact failure chain on Android:**
     1. `localStatus` is **hardcoded** to `'ready'` (the previous `HEAD` probe checking whether the local `.pdf` exists was removed).
     2. On Android, `isCapacitorNative()` is `true` -> `canRenderIframe` is `false`.
     3. Because `localStatus === 'ready'`, `activeAndroidStreamUrl` skips both `remoteFallbackUrl` and the fallback UI (`579-590`) and unconditionally passes `localResolvedUrl` (`https://localhost/books/book1-netters-atlas-7ed.pdf` and `book2-grays-anatomy-4ed.pdf`) into `<PdfJsCanvasViewer pdfUrl={activeAndroidStreamUrl} ... />`.
     4. `PdfJsCanvasViewer` calls `pdfjs.getDocument({ url: pdfUrl, disableAutoFetch: true, disableStream: false })` (`161-165`), requesting `https://localhost/books/*.pdf` from Capacitor's local WebView asset server — which returns **`404`** because `cleanMobileBuild.mjs --strip-pdfs` deleted both `.pdf` binaries from `dist/books/` prior to `npx cap sync android`.

3. **Exact Metadata & Structure of `public/books/manifest.json` (`lines 1-100` & `590-671`):**
   ```json
   {
     "generatedAt": "2026-11-14T20:43:15.332Z",
     "books": [
       {
         "id": "book1",
         "slot": 1,
         "role": "atlas",
         "title": "Book 1 — Atlas & Illustrations",
         "shortLabel": "Book 1: Atlas & Organs (Plates)",
         "sourceTitle": "Netter's Atlas of Human Anatomy 7ed",
         "originalFilename": "Netter's Atlas of Human Anatomy 7ed.pdf",
         "filename": "book1-netters-atlas-7ed.pdf",
         "sizeBytes": 120610693,
         "pageCount": 791,
         "url": "/books/book1-netters-atlas-7ed.pdf",
         "remoteFallbackUrl": "https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/book1-netters-atlas-7ed.pdf",
         "linkMethod": "bundled",
         "chapters": [
           { "title": "Atlas of Human Anatomy", "page": 5 },
           { "title": "1 Introduction", "page": 35 },
           { "title": "2 Head and Neck", "page": 61 },
           { "title": "3 Back and Spinal Cord", "page": 241 },
           { "title": "4 Thorax", "page": 284 },
           { "title": "5 Abdomen", "page": 366 },
           { "title": "6 Pelvis and Perineum", "page": 488 },
           { "title": "7 Upper Limb", "page": 575 },
           { "title": "8 Lower Limb", "page": 661 },
           { "title": "References", "page": 746 },
           { "title": "Index", "page": 750 }
         ],
         "plateOffsetEstimate": 36,
         "plateToPage": {
           "1": 37,
           "2": 38,
           "...": "[lines 68-599 omitted: plates 3..534]",
           "535": 727
         }
       },
       {
         "id": "book2",
         "slot": 2,
         "role": "textbook",
         "title": "Book 2 — Textbook & Explanations",
         "shortLabel": "Book 2: Clinical Text & Explanations",
         "sourceTitle": "Gray's Anatomy for Students 4th Edition NO Watermark",
         "originalFilename": "Gray's Anatomy for Students 4th Edition NO Watermark.pdf",
         "filename": "book2-grays-anatomy-4ed.pdf",
         "sizeBytes": 198719430,
         "pageCount": 1234,
         "url": "/books/book2-grays-anatomy-4ed.pdf",
         "remoteFallbackUrl": "https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/book2-grays-anatomy-4ed.pdf",
         "linkMethod": "bundled",
         "chapters": [
           { "title": "What is anatomy?", "page": 5 },
           { "title": "Imaging", "page": 8 },
           { "title": "Body systems", "page": 15 },
           { "title": "Clinical cases", "page": 51 },
           { "title": "Conceptual overview", "page": 52 },
           { "title": "Regional anatomy", "page": 63 },
           { "title": "Median nerve.", "page": 755 },
           { "title": "Introduction", "page": 1154 },
           { "title": "Part I: Nervous system overview", "page": 1155 },
           { "title": "Part II: Brain", "page": 1161 },
           { "title": "Part III: Thalamus", "page": 1174 },
           { "title": "Part IV: Brainstem", "page": 1177 }
         ],
         "plateOffsetEstimate": null,
         "plateToPage": {}
       }
     ]
   }
   ```

---

## Section 4: Build Scripts & `package.json` Pipeline

### 4.1 Complete `"scripts"` (and `"build"` Config) in `package.json` & `electron-builder.yml`

`package.json` (`lines 1-59`) contains **only `"scripts"` — there is NO `"build"` section in `package.json`**:

```json
{
  "name": "anatomy-atlas-3d",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "main": "electron/main.cjs",
  "scripts": {
    "postinstall": "node scripts/reassembleLargeAssets.mjs",
    "prebuild": "node scripts/reassembleLargeAssets.mjs",
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "electron:dev": "electron .",
    "electron:pack": "npm run build && electron-builder --config electron-builder.yml --win --x64 --publish never",
    "cap:sync": "npm run build && node scripts/cleanMobileBuild.mjs --strip-pdfs && node scripts/configureAndroidGradle.mjs && npx cap sync android",
    "android:assets": "node scripts/cleanMobileBuild.mjs --strip-pdfs",
    "assets:compress": "node scripts/compressAssetsLossless.mjs",
    "prepare:assets": "node scripts/prepareGitSafeAssets.mjs",
    "reassemble:assets": "node scripts/reassembleLargeAssets.mjs",
    "audit:medical": "node scripts/medicalProfessorAudit.mjs",
    "fetch:bodies": "node scripts/fetchNihBodies.mjs",
    "fetch:sketchfab": "node scripts/fetchSketchfabAnatomy.mjs",
    "setup:books": "node scripts/setupPdfBooks.mjs"
  },
```

Windows Desktop packaging configuration lives exclusively in `electron-builder.yml` (`lines 1-32`):

```yaml
appId: com.tarek.anatomyatlas3d
productName: Anatomy Atlas 3D
copyright: Copyright © 2026 Tarek Ahmed
directories:
  output: release
files:
  - dist/**/*
  - '!dist/**/*.part*'
  - '!dist/**/*.chunks.json'
  - '!dist/**/*.zip'
  - '!dist/models/female/**'
  - electron/**/*
  - build/icon.png
  - package.json
asar: true
compression: maximum
win:
  icon: build/icon.ico
  target:
    - target: nsis
      arch:
        - x64
nsis:
  oneClick: true
  perMachine: false
  runAfterFinish: true
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Anatomy Atlas 3D
  artifactName: AnatomyAtlas3D-Setup.exe
```

### 4.2 Scripts Pipeline & Measured Asset Sizes (`public/`, `dist/`, `android/...`)

- **Scripts executed automatically during build / install / pack / Android sync:**
  1. `scripts/reassembleLargeAssets.mjs` (`3,770` B) — triggered on **`postinstall`** and **`prebuild`** (runs right before `npm run build`). Scans `large-asset-chunks/`, `public/books/`, and `public/models/` for `*.chunks.json` and reassembles split binaries (producing the two PDFs in `public/books/`).
  2. `scripts/cleanMobileBuild.mjs` (`4,247` B) — triggered during **`npm run cap:sync`**, **`npm run android:assets`**, and CI Android APK workflow (`.github/workflows/build-release.yml:111`). When run with `--strip-pdfs`, it:
     - Deletes stale `android/app/src/main/assets/public/` (`cleanMobileBuild.mjs:92-98`).
     - Deletes `.part*`, `.chunks.json`, `.zip`, etc. inside `dist/` (`101-107`).
     - Deletes `dist/books/*.pdf` (`112-116`, freeing `304.55 MiB`, while leaving `manifest.json` -> triggering the mobile PDF `404` in Section 3.2!).
     - Deletes unused `dist/models/female/` (`119-124`, freeing `61.56 MiB`).
     - Deletes all `dist/models/nih/*.glb` except `manifest.json` and the 7 female supplement organs (`127-131`, freeing `~23.6 MiB`).
     - **Important side effect:** `cleanMobileBuild.mjs` mutates `dist/` directly in place! Running `cap:sync` leaves `dist/` stripped on disk unless `npm run build` is re-run afterwards.
  3. `scripts/configureAndroidGradle.mjs` (`2,782` B) — runs after `cleanMobileBuild.mjs` in **`npm run cap:sync`** and CI (`.github/workflows/build-release.yml:119`).
  - *(Other manual scripts present in `scripts/`: `compressAssetsLossless.mjs`, `optimizeGlbModels.mjs`, `prepareGitSafeAssets.mjs`, `medicalProfessorAudit.mjs`, `setupPdfBooks.mjs`, `fetchNihBodies.mjs`, `fetchFemaleAnatomy.mjs`, `fetchSketchfabAnatomy.mjs`, `extractAnatomyPdfs.mjs`, `processUserZip.mjs`, `restoreOriginalZipModels.mjs`, `export_zanatomy_blender.py`.)*

- **Exact Folder Sizes Currently on Disk:**

  | Directory | File Count | Exact Size (MiB) | Exact Size (MB) | Composition Notes |
  | --- | ---: | ---: | ---: | --- |
  | `public/` | 93 | **431.92 MiB** | **452.90 MB** | `public/books/` (`304.55 MiB` / `319.34 MB`) + `public/models/` (`126.52 MiB`: `zanatomy` `39.03 MiB`, `nih` `25.94 MiB`, unused legacy `female/` `61.56 MiB`) + small icons/workers |
  | `dist/` | 98 | **437.10 MiB** | **458.34 MB** | Vite copies all of `public/` into `dist/`, including unused `61.56 MiB` `dist/models/female/`, `25.94 MiB` `dist/models/nih/`, and `304.55 MiB` `dist/books/*.pdf` |
  | `android/app/src/main/assets/public/` | — | **MISSING** | **MISSING** | `/android/` is gitignored and absent locally; created only when `npx cap sync android` copies the stripped `dist/` payload (`437.10 MiB` minus `304.55 MiB` PDFs, `61.56 MiB` `female/`, and `~23.6 MiB` non-female NIH GLBs -> inferred `~47 MiB`) |
  | *(Related)* `large-asset-chunks/` | 7 | 304.54 MiB | 319.33 MB | Git-tracked chunks used by `prebuild` (`reassembleLargeAssets.mjs`) to materialize `public/books/*.pdf` |
  | *(Related)* `release/` | 166 | 1,985.72 MiB | 2,082.18 MB | Stale local `electron-builder` output (`AnatomyAtlas3D-Setup.exe` `652.71 MB` + `win-unpacked` `1,428.78 MB`) |
