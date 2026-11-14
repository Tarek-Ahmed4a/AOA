# Anatomy Atlas 3D — Interactive Clinical Human Anatomy Platform
# أطلس التشريح البشري ثلاثي الأبعاد — التحميل والتشغيل بضغطة واحدة

---

## تحميل البرنامج بضغطة واحدة (بدون خبرة تقنية أو GitHub) | One-Click Download

اضغط على الزر بالأسفل لتحميل ملف واحد فقط (`AnatomyAtlas3D-Setup.exe`)، ثم اضغط عليه مرتين وسيقوم بتثبيت وتشغيل البرنامج بالكامل تلقائياً على جهازك دون أي إعدادات.

| Platform / المنصة | One-Click Direct Download / رابط التحميل المباشر | How to Run / طريقة التشغيل |
| :--- | :---: | :--- |
| **Windows PC (64-bit)** | [![Download for Windows](https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Download_Windows_Installer_(AnatomyAtlas3D--Setup.exe)-0ea5e9?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/AnatomyAtlas3D-Setup.exe) | **اضغط مرتين فقط على `AnatomyAtlas3D-Setup.exe`** — تثبيت صامت وتشغيل تلقائي + أيقونة على سطح المكتب بدون أي خطوات.<br>Double-click `AnatomyAtlas3D-Setup.exe` — silent 1-click install, creates Desktop shortcut, and opens automatically. |
| **Android Mobile / Tablet** | [![Download for Android](https://img.shields.io/badge/%E2%AC%87%EF%B8%8F_Download_Android_APK_(AnatomyAtlas3D--Android.apk)-10b981?style=for-the-badge&logo=android&logoColor=white)](https://github.com/Tarek-Ahmed4a/AOA/releases/latest/download/AnatomyAtlas3D-Android.apk) | افتح ملف **`AnatomyAtlas3D-Android.apk`** على هاتفك لتثبيت التطبيق بالكامل مع دعم اللمس والتحريك ثنائي الأصابع.<br>Tap `AnatomyAtlas3D-Android.apk` on Android to install the full offline 3D atlas with touch navigation. |

> **هل قمت بتحميل الكود عن طريق `Download ZIP` بالخطأ؟**
> لا تقلق — افتح المجلد واضغط مرتين فقط على ملف **`Run_Anatomy_Atlas_3D.bat`** أو **`تشغيل_وتحميل_البرنامج_تلقائيا.bat`**، وسيقوم تلقائياً بتحميل وتشغيل البرنامج على جهازك!
>
> **Downloaded the repository ZIP by mistake?** Simply double-click **`Run_Anatomy_Atlas_3D.bat`** (or **`تشغيل_وتحميل_البرنامج_تلقائيا.bat`**) — it automatically launches the app or downloads `AnatomyAtlas3D-Setup.exe` directly to your Desktop and runs it for you.

---

## Key Features / المميزات الرئيسية

1. **Tab 1 — `3D Master Atlas` (الأطلس الرئيسي ثلاثي الأبعاد)**
   - **6 Complete Anatomical Systems:** Skeletal (`980` meshes), Muscular (`853` meshes), Visceral Organs (`301` meshes), Cardiovascular (`676` meshes), Nervous (`708` meshes), and Integumentary (`750` meshes) from Z-Anatomy plus **73 NIH Human Reference Atlas (HRA)** high-detail organs (`5,784` audited meshes total).
   - **Biological Sex Dimorphism (`MALE ♂` / `FEMALE ♀`):** Strictly segregated reproductive and mammary anatomy with anatomical pose isolation and zero cross-dataset clipping.
   - **Surgical Dissection & Real-Time Cross-Section Slicer:** Interactive Axial, Sagittal, and Coronal WebGL clipping planes, **Cohesive Macro-Unit Explode View**, mesh peeling/isolation, and BVH-accelerated sub-millimeter raycasting.
   - **Clinical Relief GLSL Shader:** Real-time WebGL2 screen-space curvature and Fresnel relief shader (`src/utils/clinicalReliefShader.ts`) enhancing gyri/sulci, muscle striations, bone tuberosities, and vascular branching at 60 FPS.
   - **Bilingual Inspector & Live References:** English, **IFAA Terminologia Anatomica (`TA98` / `TA2`)** Latin nomenclature, and **WHO Unified Medical Dictionary** Arabic (`العربية`) clinical documentation, paired with textbook knowledge and live `AR Wiki ↗`, `EN Wiki ↗`, and `TA98 / Wikidata ↗` links.

2. **Tab 2 — `Live 3D Explorer` (المستكشف ثلاثي الأبعاد المباشر)**
   - Unified catalog explorer across local Z-Anatomy, **NIH HRA & BodyParts3D**, **NIH 3D Biomedical Portal**, and **Sketchfab** medical assets.
   - **3-Stage Hybrid Thumbnail Engine** pairing Wikimedia REST anatomical imagery with an offscreen Three.js `.glb` 3D thumbnail baker (`src/utils/glbThumbnailBaker.ts`).

3. **Tab 3 — `Reference Books (PDF)` (الكتب المرجعية الطبية)**
   - Full-viewport side-by-side dual PDF reference textbook reader bundling both reference atlases (`Netter's Atlas of Human Anatomy 7ed` & `Gray's Anatomy for Students 4th Edition`), seamlessly reassembled during installation/build via `scripts/reassembleLargeAssets.mjs`.

---

## Clinical Accuracy Audit / التحقق والتدقيق التشريحي

All `5,784` 3D meshes, laterality rules (`±X` Standard Anatomical Position), visceral peritoneal noise filters, cohesive explode clusters, sex-dimorphism boundaries, and `67` core clinical entries pass automated verification with **0 failures** (`TOTAL AUDIT FAILURES: 0`).

- Audit Script: [`scripts/medicalProfessorAudit.mjs`](./scripts/medicalProfessorAudit.mjs)
- Full Bilingual Audit Report: [`MEDICAL_ACCURACY_AUDIT_REPORT.md`](./MEDICAL_ACCURACY_AUDIT_REPORT.md)

```bash
npm run audit:medical
```

---

## Developer Guide & GitHub Safe Asset Splitting / دليل المطورين

Files exceeding `95 MB` inside `public/books/` or `public/models/` are split into `< 90 MB` `.partN` chunks + `.chunks.json` manifests by `scripts/prepareGitSafeAssets.mjs` (staying under GitHub's `100 MB` file push limit without Git LFS). `scripts/reassembleLargeAssets.mjs` automatically runs during `npm install` (`postinstall`) and `npm run build` (`prebuild`) to reassemble every binary with SHA-256 verification before Vite bundles `dist/`.

### Local Commands

```bash
# Install dependencies (automatically reassembles split PDF textbooks)
npm install

# Run web dev server
npm run dev

# Reassemble split assets, typecheck, and build production bundle
npm run typecheck
npm run build
npm run audit:medical

# Build 1-click Windows installer into release/AnatomyAtlas3D-Setup.exe
npm run electron:pack

# Build Android APK (requires JDK 21 + Android SDK)
npm run build
npx cap add android
npx cap sync android
node scripts/configureAndroidGradle.mjs
cd android && ./gradlew assembleDebug
```

### Triggering Automated `.exe` & `.apk` GitHub Releases

Push a version tag to trigger [`.github/workflows/build-release.yml`](./.github/workflows/build-release.yml) and automatically publish **`AnatomyAtlas3D-Setup.exe`** and **`AnatomyAtlas3D-Android.apk`** to **Releases → Latest**:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or open **Actions → Build & Publish Cross-Platform Releases → Run workflow** to build downloadable artifacts manually.

---

## Scientific Data & 3D Asset Attributions / حقوق الملكية والمصادر العلمية

- **Z-Anatomy Open 3D Human Anatomy Atlas:** Licensed under [**CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/) (Gauthier Kervyn & Z-Anatomy contributors).
- **BodyParts3D (DBCLS — Database Center for Life Science):** Licensed under [**CC BY-SA 2.1 JP / CC BY-SA 4.0**](https://creativecommons.org/licenses/by-sa/4.0/).
- **NIH Human Reference Atlas (HRA / HuBMAP CCF Reference Organs):** Licensed under [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/).
- **Terminology Standards:** IFAA *Terminologia Anatomica* (`TA98` / `TA2`) & WHO Unified Medical Dictionary (UMD Arabic).

---

## License / الرخصة

Application source code in this repository is licensed under the **MIT License** — see [`LICENSE`](./LICENSE). Upstream anatomical meshes remain subject to their respective **CC BY-SA 4.0** / **CC BY 4.0** attributions listed above.
