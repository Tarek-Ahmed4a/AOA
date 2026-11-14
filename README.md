# Anatomy Atlas 3D — Interactive Clinical & Biomedical Human Anatomy Platform
# أطلس التشريح البشري ثلاثي الأبعاد — المنصة التفاعلية للتشريح السريري والطبية الحيوية

A high-precision, interactive **3D Human Anatomy Atlas** built with **React 18**, **Three.js / React Three Fiber**, **WebGL2 custom clinical GLSL shaders**, **Tailwind CSS**, and offline **Electron (Windows `.exe`)** + **Capacitor (Android `.apk`)** packaging.

---

## Key Features / المميزات الرئيسية

1. **Tab 1 — `3D Master Atlas` (الأطلس الرئيسي ثلاثي الأبعاد)**
   - **6 Complete Anatomical Systems:** Skeletal (`980` meshes), Muscular (`853` meshes), Visceral Organs (`301` meshes), Cardiovascular (`676` meshes), Nervous (`708` meshes), and Integumentary (`750` meshes) from Z-Anatomy plus **73 NIH Human Reference Atlas (HRA)** high-detail organs (`5,784` audited meshes total).
   - **Biological Sex Dimorphism (`MALE ♂` / `FEMALE ♀`):** Strictly segregated reproductive and mammary anatomy with anatomical pose isolation and zero cross-dataset clipping.
   - **Surgical Dissection & Real-Time Cross-Section Slicer:** Interactive Axial, Sagittal, and Coronal WebGL clipping planes, **Cohesive Macro-Unit Explode View**, mesh peeling/isolation, and BVH-accelerated sub-millimeter raycasting.
   - **Clinical Relief GLSL Shader:** Real-time WebGL2 screen-space curvature and Fresnel relief shader (`src/utils/clinicalReliefShader.ts`) enhancing gyri/sulci, muscle striations, bone tuberosities, and vascular branching at 60 FPS.
   - **Bilingual Inspector & Live References:** Supports English, **IFAA Terminologia Anatomica (TA98/TA2)** Latin nomenclature, and **WHO Unified Medical Dictionary** Arabic (`العربية`) clinical documentation, paired with textbook knowledge and live `AR Wiki ↗`, `EN Wiki ↗`, and `TA98 / Wikidata ↗` links.

2. **Tab 2 — `Live 3D Explorer` (المستكشف ثلاثي الأبعاد المباشر)**
   - Unified catalog explorer across local Z-Anatomy, **NIH HRA & BodyParts3D**, **NIH 3D Biomedical Portal**, and **Sketchfab** medical assets.
   - **3-Stage Hybrid Thumbnail Engine** pairing Wikimedia REST anatomical imagery with an offscreen Three.js `.glb` 3D thumbnail baker (`src/utils/glbThumbnailBaker.ts`).

3. **Tab 3 — `Reference Books (PDF)` (الكتب المرجعية الطبية)**
   - Full-viewport side-by-side dual PDF reference textbook reader powered by local book discovery (`npm run setup:books`) with indexed textbook lookup integrated into the Clinical Inspector.

---

## Clinical Accuracy Audit / التحقق والتدقيق التشريحي

All `5,784` 3D meshes, laterality rules (`±X` Standard Anatomical Position), visceral peritoneal noise filters, cohesive explode clusters, sex-dimorphism boundaries, and `67` core clinical entries pass automated verification with **0 failures** (`TOTAL AUDIT FAILURES: 0`).

- Audit Script: [`scripts/medicalProfessorAudit.mjs`](./scripts/medicalProfessorAudit.mjs)
- Full Bilingual Audit Report: [`MEDICAL_ACCURACY_AUDIT_REPORT.md`](./MEDICAL_ACCURACY_AUDIT_REPORT.md)

```bash
npm run audit:medical
```

---

## Development & Cross-Platform Packaging / التطوير وبناء النسخ التنفيذية

### Prerequisites / المتطلبات الأساسية
- **Node.js 20+** and **npm 10+**
- *(Optional for Android local builds)* **JDK 21** + **Android SDK**
- *(Optional for local PDF Textbooks)* Place your licensed anatomy PDFs in the project root directory and run `npm run setup:books`.

### 1. Web Development / تشغيل بيئة الويب

```bash
npm install
npm run dev
```

### 2. Verification & Production Build / التحقق والبناء الإنتاجي

```bash
npm run typecheck
npm run build
npm run audit:medical
```

### 3. Windows Desktop App (Electron) / تطبيق سطح المكتب لنظام ويندوز

```bash
npm run build
npm run electron:dev     # Launch Desktop App locally using Vite dist/
npm run electron:pack    # Build NSIS Installer & Portable Windows .exe into release/
```

Desktop binaries output to `release/`:
- `AnatomyAtlas3D-Windows-x64-Setup.exe` (NSIS installer)
- `AnatomyAtlas3D-Windows-x64.exe` (Standalone portable executable)

### 4. Android Mobile App (Capacitor) / تطبيق أندرويد

```bash
npm run build
npx cap add android      # First-time native Android workspace setup
npx cap sync android
node scripts/configureAndroidGradle.mjs
cd android && ./gradlew assembleDebug
```

Touch navigation on mobile is mapped directly to Three.js `OrbitControls`:
- **1-finger drag:** Rotate 3D anatomy camera
- **2-finger pinch / drag:** Zoom & pan
- **Tap mesh:** Select anatomical structure & open bilingual Clinical Inspector

---

## Automated GitHub Releases (`.exe` & `.apk`) / الإصدارات التلقائية عبر GitHub Actions

This repository includes an automated CI/CD workflow in [`.github/workflows/build-release.yml`](./.github/workflows/build-release.yml) with three jobs:
1. **`build-windows-exe`** (`windows-latest`) — Builds NSIS Installer & Portable Windows `.exe`.
2. **`build-android-apk`** (`ubuntu-latest`) — Syncs Capacitor Android workspace, applies Gradle memory & `noCompress` `.glb` optimizations, and compiles `.apk` builds.
3. **`publish-github-release`** — Automatically publishes a GitHub Release with all 4 downloadable installers (`AnatomyAtlas3D-Windows-x64.exe`, `AnatomyAtlas3D-Windows-x64-Setup.exe`, `AnatomyAtlas3D-Android.apk`, `AnatomyAtlas3D-Android-unsigned.apk`).

### Triggering a New Release / كيفية إصدار نسخة جديدة

**Option A — Push a version tag (recommended / نشر وسم إصدار):**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Option B — Manual workflow dispatch (التشغيل اليدوي من GitHub Actions):**
- Open **Actions → Build & Publish Cross-Platform Releases → Run workflow** to build downloadable `.exe` and `.apk` workflow artifacts from any branch.

---

## Scientific Data & 3D Asset Attributions / حقوق الملكية والمصادر العلمية

This software respects all upstream open biomedical asset licenses:

- **Z-Anatomy Open 3D Human Anatomy Atlas:** Licensed under [**CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/) (Gauthier Kervyn & Z-Anatomy contributors).
- **BodyParts3D (DBCLS — Database Center for Life Science):** Licensed under [**CC BY-SA 2.1 JP / CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/).
- **NIH Human Reference Atlas (HRA / HuBMAP CCF Reference Organs):** Licensed under [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/).
- **Terminology Standards:** IFAA *Terminologia Anatomica* (`TA98` / `TA2`) & WHO Unified Medical Dictionary (UMD Arabic).

> Note: User-supplied copyrighted PDF textbooks (`/*.pdf`, `public/books/*.pdf`) and environment secrets (`.env*`) are strictly excluded from version control via `.gitignore`.

---

## License / الرخصة

Application source code in this repository is licensed under the **MIT License** — see [`LICENSE`](./LICENSE). Upstream anatomical meshes remain subject to their respective **CC BY-SA 4.0** / **CC BY 4.0** attributions listed above.
