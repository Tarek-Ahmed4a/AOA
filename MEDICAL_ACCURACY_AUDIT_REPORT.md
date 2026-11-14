# 5-Pillar Clinical Anatomy & Biomedical Ontology Audit Report
# تقرير التدقيق السريري والتشريحي الخماسي الشامل (IFAA TA98/TA2 · Gray's · Netter's · WHO Arabic)

**Project / المشروع:** Interactive 3D Human Anatomy Atlas (`d:/AOA`)  
**Audit Harness / أداة التدقيق الآلي:** [medicalProfessorAudit.mjs](file:///d:/AOA/scripts/medicalProfessorAudit.mjs)  
**Production Verification / التحقق من البناء الإنتاجي:** `node scripts/medicalProfessorAudit.mjs` (`0` failures across `5,784` meshes) · `npx tsc --noEmit` (`exit 0`) · `npm run build` (`tsc -b && vite build`, `2,195` modules, `exit 0`)

---

## 1. Executive Clinical Verdict & Accuracy Scorecard
## 1. الحكم السريري التنفيذي وبطاقة الدقة التشريحية

**Final Verdict / الحكم النهائي:** **PASSED — 100.0% Audit Compliance (`0` failures across `5,784` 3D meshes and `67` core clinical structures)**  
**النتيجة النهائية:** **اجتياز كامل بنسبة تطابق 100.0% (`0` أخطاء عبر `5,784` مجسمًا ثلاثي الأبعاد و`67` بنية سريرية رئيسية).**

The entire 3D Human Anatomy Atlas scene graph (`Z-Anatomy` full-body GLBs + `73` `NIH` GLBs, totaling **`5,784` meshes**), spatial parsing pipeline, explode mechanics, sex-dimorphism rules, and clinical neurovascular/TA98/Arabic baseline passed all automated Pillar 1–5 checks after remediation.

| Audit Domain / مجال التدقيق | Scope Audited / نطاق الفحص | Defects Found & Fixed / الأعطال المكتشفة والمصلحة | Verified Failures / الإخفاقات الحالية | Compliance / نسبة التطابق |
| :--- | :--- | :--- | :---: | :---: |
| **Pillar 1 — Terminological, TA98/TA2 & Laterality** | `5,784` meshes (Z-Anatomy + 73 NIH GLBs) + spatial probes | Fixed `2,015` generic multi-primitive child labels (`mesh_0_1`), `4` swapped GLB `Right/Left` meshes, `2` intrinsic cardiac bilateral misclassifications, and duplicate `tibia` map key | **0** | **100%** |
| **Pillar 2 — Skeletal System Topology** | `zanatomy:skeletal` (`980` meshes) + limb/vertebra explode | Fixed skeletal explode stem regexes (`vertebr[a-z]*`, `humer[a-z]*`, `metacarp[a-z]*`, `calcane[a-z]*`); verified Standard Anatomical Position Y-bounds | **0** | **100%** |
| **Pillar 2 — Muscular System & Cohesive Explode** | `zanatomy:muscular` (`853` meshes) + multi-head belly/tendon clusters | Unified multi-head muscle cluster matching (`Short_head_of_biceps_brachii` + `Long_head_of_biceps_brachii` & all 17 muscle/limb groups); eliminated tendon splits | **0** | **100%** |
| **Pillar 2 — Visceral System & Noise Filtering** | `zanatomy:visceral` (`301` meshes) + NIH catalog entries | Fixed `_` boundary matching in `isNoisyZAnatomyVisceralMesh` (hides `Mesocolon`, preserves `Colon` & `Omental_taenia`) + added `lymph[-_\s]?node` filter | **0** | **100%** |
| **Pillar 2 — Cardiovascular System Topology** | `zanatomy:cardiovascular` (`676` meshes) | Isolated intrinsic cardiac papillary/coronary structures as `'Median / Unpaired'` and validated aortic/portal/pulmonary clinical baselines | **0** | **100%** |
| **Pillar 2 — Nervous System Topology** | `zanatomy:nervous` (`708` meshes) | Added cranial/peripheral nerve TA98 & clinical entries (CN V, CN VII, CN X, Phrenic, Median, Ulnar, Radial, Femoral, Obturator, Tibial, Common Fibular) | **0** | **100%** |
| **Pillar 2 — Integumentary System & Dataset Isolation** | `zanatomy:integumentary` (`750` meshes) + Z-Anatomy vs NIH mutual exclusion | Verified strict Z-Anatomy / NIH pose separation (`crossDatasetIsolated: true`) with zero overlapping limbs | **0** | **100%** |
| **Pillar 3 — Biological Sex Dimorphism (`MALE ♂` / `FEMALE ♀`)** | Female (`7` NIH organs inside Z-Anatomy `FEMALE ♀`) · Male (`prostate-male`) · Groin neurovasculature & hair suppression | Mounted & precision-aligned all `7` female pelvic/mammary organs in Z-Anatomy (`0` failures), pruned male groin vessels/nerves (`|X|<0.062, Y∈(0.68,0.805), Z>0.048`), and verified `0` male/female leaks | **0** | **100%** |
| **Pillar 4 — Clinical Textbook, Neurovascular & WHO Arabic** | `67` Core Structures + all `5,784` Z-Anatomy/NIH meshes | Blocked truncated `textbookKnowledge.json` overwrites, replaced generic fallbacks with `19` regional clinical rules, expanded TA98 & Arabic lexicons | **0** | **100%** |

---

## 2. Z-Anatomy World-Space Bounding Verification (Standard Anatomical Position)
## 2. التحقق من الإحداثيات الفضائية لأنظمة Z-Anatomy في الوضعية التشريحية القياسية

All 6 Z-Anatomy systems sit coherently centered along the midline sagittal plane (`X ≈ 0`, Subject's Left = `+X`, Subject's Right = `-X`) with anatomically consistent cranio-caudal (`minY`–`maxY`) spans in meters:

| Z-Anatomy System Layer | Mesh Count (`meshCount`) | World Center `[X, Y, Z]` (m) | Vertical Span `[minY, maxY]` (m) | Spatial Probe Status |
| :--- | :---: | :--- | :--- | :---: |
| `zanatomy:skeletal` | `980` | `[0, 0.8858, 0.0137]` | `0.0298 – 1.7418` | `0` failures |
| `zanatomy:muscular` | `853` | `[-0, 0.8857, 0.0005]` | `0.0275 – 1.7439` | `0` failures |
| `zanatomy:visceral` | `301` | `[0, 0.8376, 0.0089]` | `0.0200 – 1.6553` | `0` failures |
| `zanatomy:cardiovascular` | `676` | `[0, 0.8811, 0.0133]` | `0.0245 – 1.7378` | `0` failures |
| `zanatomy:nervous` | `708` | `[0, 0.8824, 0.0104]` | `0.0280 – 1.7369` | `0` failures |
| `zanatomy:integumentary` | `750` | `[0, 0.9003, -0]` | `0.0206 – 1.7800` | `0` failures |

- **Sex-Dimorphic NIH Structures Audited:**
  - **`FEMALE ♀` Organs (`7`):** `fallopian-tube-female-left`, `fallopian-tube-female-right`, `mammary-gland-female-left`, `mammary-gland-female-right`, `ovary-female-left`, `ovary-female-right`, `uterus-female`.
  - **`MALE ♂` Organ (`1`):** `prostate-male`.
  - **Female Integumentary Hair Suppression:** `2` male scalp/pubic integumentary hair meshes suppressed (`P3 Female integumentary head/pubic hair suppressed: 2`).

---

## 3. Complete Catalog of Anatomical Errors Discovered & Fixed
## 3. السجل الكامل للأخطاء التشريحية المكتشفة وإصلاحاتها البرمجية

### Pillar 1 — Terminological Normalization, TA98/TA2 Mapping & Laterality
### الركيزة الأولى — توحيد المصطلحات والتصنيف اللاتيني TA98/TA2 والجانبية (يمين/يسار)

1. **Multi-Primitive Child Mesh Labeling (`2,015` Generic Failures Eliminated):**
   - **Defect / الخلل:** Three.js `GLTFLoader` splits multi-primitive nodes into child meshes named `mesh_0_1` / `_primitive_\d+` / `submesh`. Prior hierarchy resolution accepted those generic child names and appended fallback suffixes, causing `2,015` generic label failures on initial audit.
   - **Fix / الإصلاح:** Updated `stripBlenderAndMeshSuffixes`, exported `isGenericNodeName`, tightened `GENERIC_MESH_NAME_RE` (`sub[_\-\s]*mesh`), and updated `parseAnatomicalMesh` in [anatomyParser.ts](file:///d:/AOA/src/utils/anatomyParser.ts) plus `resolveHierarchyName` in [AnatomicalModelManager.tsx](file:///d:/AOA/src/components/canvas/AnatomicalModelManager.tsx#L227) to walk ancestor nodes up to the first non-generic anatomical name (e.g., resolving `mesh_0_1` under `Tibia_Right` cleanly) while preserving vertebral and costal numbers (`Vertebra_C6`, `Rib_1`).
2. **Swapped Z-Anatomy Left/Right Labels (`4` GLB Meshes Corrected):**
   - **Defect / الخلل:** Four Z-Anatomy meshes (`Lateral_temporomandibular_ligament_Right`, `Lateral_temporomandibular_ligament_Left`, `Eyelashes_Right`, `Eyelashes_Left`) carried swapped `.glb` node names relative to true world-space coordinates in Standard Anatomical Position (`Subject's Left = +X`, `Subject's Right = -X`).
   - **Fix / الإصلاح:** Added spatial world-`X` coordinate verification (`inStandingAtlas && Math.abs(centerVec.x) > 0.025`) inside `parseAnatomicalMesh` in [anatomyParser.ts](file:///d:/AOA/src/utils/anatomyParser.ts) so true anatomical position overrides inverted source labels (`P1 Laterality errors (GLB): 0`).
3. **Intrinsic Cardiac Chamber vs. Laterality Classification (`2` Heart Meshes Fixed):**
   - **Defect / الخلل:** Cardiac structures containing anatomical chamber/vessel directional words (`Anterior_papillary_muscle_of_right_ventricle`, `Right_inferolateral_branch_of_right_coronary_artery`) were mistakenly marked `'Right'` bilateral structures instead of median thoracic organ components.
   - **Fix / الإصلاح:** Added `INTRINSIC_CARDIAC_STRUCTURE_RE` & `isIntrinsicCardiacStructure` inside `detectLaterality` in [anatomyParser.ts](file:///d:/AOA/src/utils/anatomyParser.ts), classifying intrinsic ventricular/coronary structures as `'Median / Unpaired'`.
4. **Expanded TA98/Latin Dictionary & Duplicate Property Fix:**
   - **Defect & Fix:** Expanded `TERMINOLOGY_MAP` in [anatomyParser.ts](file:///d:/AOA/src/utils/anatomyParser.ts) with 55+ additional IFAA TA98 & Latin entries (lower/upper limb muscles, tarsals, major peripheral/cranial nerves, pulmonary trunk, portal vein) and removed a duplicate `tibia` object key that triggered TypeScript error `TS1117`.

### Pillar 2 — Topographical Alignment, Visceral Noise Suppression & Cohesive Explode
### الركيزة الثانية — التطابق الطوبوغرافي وتنقية الأحشاء والتفكيك المتماسك

1. **Cross-Dataset Pose Isolation & Noisy Visceral Overlays:**
   - **Defect / الخلل:** Underscore characters (`_`) in GLB node names behaved as word characters (`\w`), allowing peritoneal overlays such as `Mesocolon` / `Transverse_mesocolon` / `Sigmoid_mesocolon` to bypass boundary regexes in `isNoisyZAnatomyVisceralMesh` via partial `colon` protection matching. Lymph node spheres in NIH catalogs also needed explicit exclusion.
   - **Fix / الإصلاح:** Normalized `_ -> ' '` in `isNoisyZAnatomyVisceralMesh` in [AnatomicalModelManager.tsx](file:///d:/AOA/src/components/canvas/AnatomicalModelManager.tsx#L1350), added an explicit `isOmentalTaenia` protection guard before `isPeritonealOverlay`, enforced `\bcolon\b` boundaries, and added `lymph[-_\s]?node` to `isNoisyNonOrganEntry` in [nihSceneService.ts](file:///d:/AOA/src/services/nihSceneService.ts#L152).
   - **Result:** `P2 Cross-dataset isolated: true`, `P2 Visceral noisy visible leaks: 0 []`, `P2 Visceral protected hidden accidentally: 0 []`.
2. **Rigid Macro-Unit Explode Synchronization:**
   - **Defect / الخلل:** Multi-head muscles and anatomical suffixes caused head/tendon sub-meshes (e.g., `Short_head_of_biceps_brachii` vs `Long_head_of_biceps_brachii`) to resolve to different explode targets and tear apart in Explode View.
   - **Fix / الإصلاح:** Updated `SKELETAL_*` and `MUSCULAR_*` stem regexes (`vertebr[a-z]*`, `humer[a-z]*`, `metacarp[a-z]*`, `calcane[a-z]*`, `supraspinat[a-z]*`, `infraspinat[a-z]*`, `subscapular[a-z]*`, `coracobrachial[a-z]*`, `biceps brach[a-z]*`, `triceps brach[a-z]*`, `quadricep[a-z]*`, `triceps surae|surae`, `extensor digitorum(?! (?:longus|brevis))`) in [explodeClusters.ts](file:///d:/AOA/src/utils/explodeClusters.ts) and verified vector equality via `resolveExplodeClusterId` / `applyRigidMacroExplodeOffset` (`P2 Explode splits: 0 []`).

### Pillar 3 — Biological Sex Dimorphism (`MALE ♂` vs. `FEMALE ♀`)
### الركيزة الثالثة — التمايز التشريحي الجنسي

- Verified strict runtime segregation, subpubic neurovascular pruning, and aligned `FEMALE ♀` organ registration across NIH and Z-Anatomy structures:
  - `P3 Female mode -> male leaks: 0 []`
  - `P3 Male mode -> female leaks: 0 []`
  - `P3 Female Z-Anatomy aligned organs (7/7): 0 failures` (`uterus-female [0, 0.8235, 0.016]`, `ovary-female-left [0.0522, 0.8534, 0.0282]`, `ovary-female-right [-0.0516, 0.8534, 0.0281]`, `fallopian-tube-female-left [0.0405, 0.8554, 0.0306]`, `fallopian-tube-female-right [-0.0389, 0.8545, 0.0263]`, `mammary-gland-female-left [0.086, 1.268, 0.092]`, `mammary-gland-female-right [-0.086, 1.268, 0.092]`)
  - `P3 Female integumentary head/pubic hair suppressed: 2`
  - Dedicated `FEMALE ♀` structures (`7` NIH models mounted inside Z-Anatomy `Full Body` / `Visceral` with `VH_F_Skin` and `VH_F_Pelvis` strictly excluded) and `MALE ♂` structure (`prostate-male`) remain strictly gated to their biological sex mode.

### Pillar 4 — Clinical Textbook Integrity, Neurovascular Accuracy & WHO Arabic Localization
### الركيزة الرابعة — الدقة السريرية والتغذية العصبية/الشريانية والتوطين العربي

1. **Blocked Truncated PDF Overwrites & Generic Fallbacks:**
   - **Defect / الخلل:** Truncated textbook extraction fragments (e.g., `"Profunda femoris and"` on `Rectus Femoris`) previously overwrote verified dictionary fields, while unmapped visceral structures such as `Duodenum` and `Oesophagus` fell through to integumentary fallback guidance.
   - **Fix / الإصلاح:** Added `isTruncatedTextbookFragment`, `pickCleanTextbookField`, `pickResolvedTa98Code` (preserving legitimate `.0.00.` root TA98 codes while overriding hashed fallbacks), `inferRegionalTa98Fallback`, and whole-phrase matching (`paddedCanonical.includes(...)`) in `resolveClinicalBaseline` inside [clinicalBaseline.ts](file:///d:/AOA/src/data/clinicalBaseline.ts).
2. **Complete Clinical Dictionary, Regional Rules & Arabic Lexicon:**
   - Extended `BaselineEntry` with `region`, `origin`, `insertion`, `action`, and `relationsEn`.
   - Added 40+ complete *Gray's*/*Netter's* + WHO Arabic + IFAA TA98 entries to `BASELINE_DICTIONARY` plus `ENTRY_ALIASES` (vertebrae, hand/foot bones, aorta, soleus, quadriceps, rotator cuff, forearm/thigh compartments, cranial & peripheral nerves, portal vein, pulmonary trunk).
   - Replaced legacy system fallback text with 19-rule `REGIONAL_CLINICAL_GUIDANCE_RULES` (`resolveRegionalClinicalGuidance`), including an explicit `systems: ['visceral']` rule, and expanded `ARABIC_MODIFIER_MAP` + `ARABIC_NOUN_MAP` (140+ terms).
   - **Result:** `P4 Core 67 structures failures: 0`, `P4 Z-Anatomy exhaustive baseline failures: 0`.

---

## 4. Core 67 Verified Anatomical Structures — Clinical & Terminological Matrix
## 4. مصفوفة التحقق السريري والمصطلحي للبنى التشريحية الـ 67 الرئيسية

Every entry below was extracted directly from `node scripts/medicalProfessorAudit.mjs --dump-core-table` (`TOTAL AUDIT FAILURES: 0`) via the live clinical baseline resolver:

| # | Structure (English) | الاسم العربي (WHO Arabic) | Latin Name (TA2 / TA) | TA98 Code | System | Arterial Supply | Innervation |
| :---: | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| 1 | **Pectoralis Major** | العضلة الصدرية الكبرى | *Musculus pectoralis major* | `A04.4.01.002` | `muscular` | Pectoral branch of thoracoacromial artery, perforating branches of internal thoracic artery | Medial and lateral pectoral nerves |
| 2 | **Deltoid** | العضلة الدالية | *Musculus deltoideus* | `A04.6.02.002` | `muscular` | Posterior circumflex humeral artery, deltoid branch of thoracoacromial artery | Axillary nerve |
| 3 | **Biceps Brachii** | العضلة ذات الرأسين العضدية | *Musculus biceps brachii* | `A04.6.02.013` | `muscular` | Muscular branches of brachial artery | Musculocutaneous nerve |
| 4 | **Triceps Brachii** | العضلة ثلاثية الرؤوس العضدية | *Musculus triceps brachii* | `A04.6.02.019` | `muscular` | Branch of profunda brachii artery | Radial nerve |
| 5 | **Latissimus Dorsi** | العضلة العريضة الظهرية | *Musculus latissimus dorsi* | `A04.3.01.006` | `muscular` | Thoracodorsal artery, dorsal perforating branches of 9th, 10th, and 11th posterior intercostal, subcostal, and first three lumbar arteries | Thoracodorsal nerve |
| 6 | **Trapezius Muscle** | العضلة شبه المنحرفة | *Musculus trapezius* | `A04.3.01.001` | `muscular` | Transverse cervical artery, dorsal perforating branches of posterior intercostal arteries | Accessory nerve (cranial nerve XI) |
| 7 | **Rectus Abdominis** | العضلة المستقيمة البطنية | *Musculus rectus abdominis* | `A04.5.01.001` | `muscular` | Superior epigastric artery (internal thoracic) & Inferior epigastric artery (external iliac) anastomosing within rectus sheath | Anterior rami of lower seven thoracic spinal nerves (T7 to T12) |
| 8 | **External Abdominal Oblique** | العضلة المائلة البطنية الظاهرة | *Musculus obliquus externus abdominis* | `A04.5.01.008` | `muscular` | Lower posterior intercostal, subcostal & deep circumflex iliac arteries | Anterior rami of lower six thoracic spinal nerves (T7 to T12) |
| 9 | **Gluteus Maximus** | العضلة الألوية الكبرى | *Musculus gluteus maximus* | `A04.7.02.006` | `muscular` | Inferior gluteal arteries mainly, and superior gluteal arteries occasionally | Inferior gluteal nerve |
| 10 | **Rectus Femoris** | العضلة المستقيمة الفخذية | *Musculus rectus femoris* | `A04.7.02.018` | `muscular` | Descending & transverse branches of the lateral femoral circumflex artery | Femoral nerve |
| 11 | **Hamstrings & Biceps Femoris** | العضلات المأبضية (ثنائية الرؤوس الفخذية) | *Musculus biceps femoris* | `A04.7.02.032` | `muscular` | Perforating branches of profunda femoris, inferior gluteal, and medial circumflex femoral arteries | Long head: sciatic nerve (tibial division) (L5–S2) Short head: sciatic nerve (common fibular division) |
| 12 | **Calf Muscle (Gastrocnemius & Soleus)** | عضلة الساق الخلفية (الساقية والنعلية) | *Musculus gastrocnemius* | `A04.7.02.043` | `muscular` | Popliteal and posterior tibial arteries | Tibial nerve |
| 13 | **Tibialis Anterior** | العضلة الظنبوبية الأمامية | *Musculus tibialis anterior* | `A04.7.02.037` | `muscular` | Anterior tibial artery | Deep fibular nerve |
| 14 | **Sternocleidomastoid (SCM)** | العضلة القصية الترقوية الخشائية | *Musculus sternocleidomastoideus* | `A04.2.01.008` | `muscular` | Sternocleidomastoid branch of superior thyroid and occipital arteries, muscular branch of suprascapular artery, occipital branch of posterior auricular artery | Accessory nerve (CN XI) |
| 15 | **Masseter Muscle** | العضلة الماضغة | *Musculus masseter* | `A04.1.04.002` | `muscular` | Transverse facial artery; masseteric branch of maxillary and facial arteries | Mandibular nerve (CN V 3 ), via masseteric nerve |
| 16 | **Temporalis Muscle** | العضلة الصدغية | *Musculus temporalis* | `A04.1.04.005` | `muscular` | Superficial temporal and maxillary arteries, middle, anterior, and posterior deep temporal arteries | Mandibular nerve (CN V 3 ), deep temporal nerves |
| 17 | **Thoracic Diaphragm** | الحجاب الحاجز | *Diaphragma* | `A04.4.02.001` | `muscular` | musculophrenic, superior and inferior phrenic arteries | The diaphragm is innervated by the phrenic nerves (C3, C4, and C5), which penetrate the diaphragm and innervate it from its abdominal surface. |
| 18 | **Serratus Anterior** | العضلة المنشارية الأمامية | *Musculus serratus anterior* | `A04.4.01.008` | `muscular` | Lateral thoracic artery | Long thoracic nerve |
| 19 | **Soleus Muscle** | العضلة النعلية | *Musculus soleus* | `A04.7.02.047` | `muscular` | Popliteal, posterior tibial, and fibular arteries | Tibial nerve |
| 20 | **Sartorius Muscle** | العضلة الخياطية | *Musculus sartorius* | `A04.7.02.015` | `muscular` | Femoral artery | Femoral nerve |
| 21 | **Cranium (Skull)** | الجمجمة (القحف) | *Cranium* | `A02.1.00.001` | `skeletal` | Middle meningeal, superficial temporal, maxillary & occipital arteries (external & internal carotid branches) | Trigeminal nerve (CN V) sensory branches & upper cervical nerves (C2–C3) to periosteum/scalp |
| 22 | **Mandible (Lower Jaw)** | الفك السفلي | *Mandibula* | `A02.1.15.001` | `skeletal` | Inferior alveolar artery (maxillary branch) & submental vessels | Mandibular nerve (CN V3) via inferior alveolar branch |
| 23 | **Cervical Vertebrae (C1–C7)** | الفقرات العنقية (C1–C7) | *Vertebrae cervicales* | `A02.2.02.001` | `skeletal` | Segmental branches of the vertebral, ascending cervical & deep cervical arteries | Sinuvertebral nerves & posterior rami of cervical spinal nerves (C1–C8) |
| 24 | **Thoracic Vertebrae (T1–T12)** | الفقرات الصدرية (T1–T12) | *Vertebrae thoracicae* | `A02.2.03.001` | `skeletal` | Posterior intercostal spinal branches | Sinuvertebral & medial branches of thoracic dorsal rami |
| 25 | **Lumbar Vertebrae (L1–L5)** | الفقرات القطنية (L1–L5) | *Vertebrae lumbales* | `A02.2.04.001` | `skeletal` | Lumbar segmental arteries arising directly from the posterior abdominal aorta | Recurrent meningeal (sinuvertebral) nerves & medial branches of lumbar dorsal rami |
| 26 | **Sternum (Breastbone)** | عظم القص | *Sternum* | `A02.3.03.001` | `skeletal` | Sternal branches of the internal thoracic arteries | Anterior cutaneous intercostal nerves |
| 27 | **Ribs (Costae I–XII)** | الأضلاع (1–12) | *Costae (I–XII)* | `A02.3.01.001` | `skeletal` | Posterior & anterior intercostal arteries | Intercostal nerves (subcostal groove neurovascular bundle) |
| 28 | **Clavicle (Collarbone)** | عظم الترقوة | *Clavicula* | `A02.4.02.001` | `skeletal` | Suprascapular & thoracoacromial periosteal vessels | Supraclavicular nerves (C3–C4) |
| 29 | **Scapula (Shoulder Blade)** | عظم لوح الكتف | *Scapula* | `A02.4.01.001` | `skeletal` | Suprascapular, dorsal scapular & circumflex scapular anastomosis | Suprascapular & subscapular nerves |
| 30 | **Humerus** | عظم العضد | *Humerus* | `A02.4.04.001` | `skeletal` | Profunda brachii nutrient artery, anterior & posterior circumflex humeral arteries | Periosteal sensory fibers from axillary, radial & musculocutaneous nerves |
| 31 | **Radius** | عظم الكعبرة | *Radius* | `A02.4.05.001` | `skeletal` | Nutrient & periosteal branches of radial and anterior interosseous arteries | Posterior & anterior interosseous periosteal branches |
| 32 | **Ulna** | عظم الزند | *Ulna* | `A02.4.06.001` | `skeletal` | Ulnar & anterior interosseous nutrient arteries | Ulnar & median nerve articular branches |
| 33 | **Pelvic Girdle & Sacrum** | الحوض والعجز | *Pelvis* | `A02.5.02.001` | `skeletal` | Internal & external iliac arteries (superior/inferior gluteal, obturator & iliolumbar branches) | Lumbosacral plexus (L4–S4) & obturator/femoral periosteal branches |
| 34 | **Femur** | عظم الفخذ | *Femur* | `A02.5.04.001` | `skeletal` | Medial & lateral femoral circumflex arteries (profunda femoris) & nutrient branches of profunda femoris | Femoral, obturator & sciatic nerve periosteal branches (Hilton law) |
| 35 | **Tibia & Fibula** | عظما الظنبوب والشظية | *Tibia* | `A02.5.06.001` | `skeletal` | Posterior tibial nutrient artery (largest nutrient artery in the body) & fibular/anterior tibial periosteal arcades | Tibial, deep fibular & superficial fibular periosteal branches |
| 36 | **Fibula** | عظم الشظية | *Fibula* | `A02.5.07.001` | `skeletal` | Fibular (peroneal) artery nutrient branch | Common, deep & superficial fibular branches |
| 37 | **Patella (Kneecap)** | الرضفة (صَابونة الركبة) | *Patella* | `A02.5.05.001` | `skeletal` | Genicular anastomotic ring around the knee | Femoral, obturator & sciatic articular branches |
| 38 | **Lung** | الرئة | *Pulmo* | `A06.5.01.001` | `visceral` | Deoxygenated: Pulmonary arteries; Oxygenated parenchyma/bronchi: Bronchial arteries (thoracic aorta) | Pulmonary plexus: Parasympathetic (Vagus CN X) & Sympathetic (T1–T4 sympathetic trunk) |
| 39 | **Trachea (Windpipe)** | القصبة الهوائية (الرغامى) | *Trachea* | `A06.3.01.001` | `visceral` | Inferior thyroid & bronchial arteries | Recurrent laryngeal nerves (CN X) & sympathetic tracheobronchial plexus |
| 40 | **Larynx** | الحنجرة | *Larynx* | `A06.2.01.001` | `visceral` | Superior & inferior laryngeal arteries | Internal/external superior laryngeal & recurrent laryngeal nerves (CN X) |
| 41 | **Liver** | الكبد | *Hepar* | `A05.8.01.001` | `visceral` | Dual blood supply: Hepatic artery proper (~25% oxygenated) & Hepatic portal vein (~75% nutrient-rich) | Hepatic plexus (Celiac plexus sympathetic fibers & Vagus nerve CN X parasympathetic) |
| 42 | **Gallbladder** | المرارة (الحويصل الصفراوي) | *Vesica biliaris* | `A05.8.02.001` | `visceral` | Cystic artery (typically arising from the right hepatic artery, a branch of the hepatic artery proper within the hepatocystic triangle of Calot) | Celiac plexus (sympathetic) & vagal parasympathetic fibers |
| 43 | **Stomach** | المعدة | *Ventriculus* | `A05.5.01.001` | `visceral` | Celiac trunk branches: Left & right gastric, left & right gastro-omental & short gastric arteries | Vagus nerves (CN X anterior/posterior trunks) & Sympathetic celiac plexus (T6–T9) |
| 44 | **Pancreas** | البنكرياس (المعثكلة) | *Pancreas* | `A05.9.01.001` | `visceral` | Superior & inferior pancreaticoduodenal arcades (head) + dorsal pancreatic & great pancreatic branches of splenic artery (body/tail) | Celiac & superior mesenteric autonomic plexuses (Vagus CN X & greater/lesser splanchnics) |
| 45 | **Spleen (Splen)** | الطحال | *Splen (Lien)* | `A13.2.01.001` | `visceral` | The arterial supply to the spleen is the splenic artery from the celiac trunk. | Celiac autonomic plexus (predominantly sympathetic fibers along splenic artery) |
| 46 | **Kidneys** | الكليتان | *Ren* | `A08.1.01.001` | `visceral` | Left & right renal arteries arising directly from the abdominal aorta (~L1–L2) | Renal plexus (Aorticorenal ganglion sympathetic T10–L1 & Vagus CN X fibers) |
| 47 | **Small Intestine** | الأمعاء الدقيقة | *Intestinum tenue* | `A05.6.01.001` | `visceral` | Gastroduodenal/pancreaticoduodenal branches (proximal duodenum); Superior mesenteric artery (SMA) jejunal & ileal arcades (midgut) | Enteric nervous system (Auerbach myenteric & Meissner submucosal plexuses) modulated by SMA autonomic plexus (Vagus CN X & T9–T11) |
| 48 | **Large Intestine (Colon & Cecum)** | الأمعاء الغليظة (القولون والأعور) | *Intestinum crassum* | `A05.7.01.001` | `visceral` | Superior mesenteric artery (ileocolic, right & middle colic to distal transverse) & Inferior mesenteric artery (left colic, sigmoid, superior rectal); Marginal artery of Drummond | Vagus CN X (to splenic flexure) & Pelvic splanchnic S2–S4 parasympathetic; Lesser/lumbar splanchnic sympathetic |
| 49 | **Urinary Bladder** | المثانة البولية | *Vesica urinaria* | `A08.3.01.001` | `visceral` | Superior vesical arteries (from umbilical branch of internal iliac) & Inferior vesical / vaginal arteries | Parasympathetic pelvic splanchnics (S2–S4) trigger detrusor contraction; Sympathetic hypogastric (T11–L2) mediate detrusor relaxation & bladder neck closure; Pudendal (S2–S4) controls external sphincter |
| 50 | **Thyroid Gland** | الغدة الدرقية | *Glandula thyroidea* | `A11.3.00.001` | `visceral` | Superior thyroid artery (first anterior branch of external carotid artery) & Inferior thyroid artery (branch of thyrocervical trunk from subclavian artery), plus occasional thyroid ima artery | Autonomic vasomotor innervation from superior, middle & inferior cervical sympathetic ganglia |
| 51 | **Uterus** | الرحم | *Uterus* | `A09.1.03.001` | `visceral` | Uterine arteries (branches of anterior division of internal iliac artery) & anastomoses with ovarian arteries | Uterovaginal plexus via inferior hypogastric plexus (Sympathetic T12–L2, Parasympathetic S2–S4 pelvic splanchnics) |
| 52 | **Ovary** | المبيض | *Ovarium* | `A09.1.01.001` | `visceral` | Ovarian arteries (direct paired branches of the abdominal aorta below the renal arteries, within the suspensory ligament) | Ovarian plexus (Sympathetic T10–T11 via lesser splanchnic & aorticorenal ganglia; visceral afferents to T10) |
| 53 | **Prostate Gland** | غدة البروستات (الموثة) | *Prostata* | `A09.3.08.001` | `visceral` | Prostatic branches of the inferior vesical artery (from internal iliac artery), middle rectal & internal pudendal arteries | Prostatic plexus from inferior hypogastric plexus (Sympathetic hypogastric T12–L2; Parasympathetic pelvic splanchnics S2–S4) |
| 54 | **Testes** | الخصيتان | *Testis* | `A09.3.01.001` | `visceral` | Testicular arteries (long paired direct branches of the abdominal aorta at L2, traversing the inguinal canal via spermatic cord) | Testicular autonomic plexus (T10–T11 spinal segments accompanying testicular vessels); scrotal skin by ilioinguinal & genitofemoral nerves |
| 55 | **Heart** | القلب | *Cor* | `A12.1.00.001` | `cardiovascular` | Left & right coronary arteries arising from the aortic sinuses immediately above the aortic valve | Cardiac plexus: Vagus nerve (CN X, slows SA/AV nodes) & Sympathetic T1–T4 fibers (increases chronotropy/inotropy) |
| 56 | **Aorta (Ascending, Arch, Thoracic & Abdominal)** | الشريان الأبهر (الصاعد والقوس والصدري والبطني) | *Aorta* | `A12.2.02.001` | `cardiovascular` | Vasa vasorum from coronary, bronchial, intercostal & lumbar arteries | Aortic arch baroreceptors (CN IX/X) & sympathetic vasomotor fibers |
| 57 | **Superior Vena Cava** | الوريد الأجوف العلوي | *Vena cava superior* | `A12.3.03.001` | `cardiovascular` | Vasa vasorum from internal thoracic & pericardiacophrenic vessels | Autonomic cardiopulmonary plexus (T1–T4 sympathetic & CN X) |
| 58 | **Inferior Vena Cava (IVC)** | الوريد الأجوف السفلي | *Vena cava inferior* | `A12.3.09.001` | `cardiovascular` | Vasa vasorum from retroperitoneal lumbar arteries | Autonomic lumbar/celiac perivascular fibers |
| 59 | **Common, Internal & External Carotid Arteries** | الشرايين السباتية (المشترك والباطن والظاهر) | *Arteria carotis communis* | `A12.2.04.001` | `cardiovascular` | Direct origin from aortic arch (left) & brachiocephalic trunk (right) | Carotid sinus nerve (CN IX), vagus (CN X) & sympathetic plexus |
| 60 | **Internal & External Jugular Veins** | الأوردة الوداجية (الباطن والظاهر) | *Vena jugularis interna* | `A12.3.05.001` | `cardiovascular` | Cervical vasa vasorum | Cervical perivascular autonomic nerves |
| 61 | **Brain (Encephalon)** | الدماغ | *Encephalon* | `A14.1.03.001` | `nervous` | The brain receives its arterial supply from two pairs of vessels, the vertebral and internal carotid arteries, which are interconnected in the cranial cavity to produce a cerebral arterial circle (of Willis). | Intrinsic CNS parenchyma (pain-insensitive); meninges innervated by CN V, CN X & C1–C3 |
| 62 | **Cerebellum** | المخيخ | *Cerebellum* | `A14.1.07.001` | `nervous` | Superior cerebellar (SCA), AICA & PICA arteries | Superior, middle & inferior cerebellar peduncles |
| 63 | **Spinal Cord** | الحبل الشوكي | *Medulla spinalis* | `A14.1.02.001` | `nervous` | One anterior spinal artery & paired posterior spinal arteries reinforced by radicular arteries (artery of Adamkiewicz) | Central nervous system parenchyma; dura/pia innervated by sinuvertebral nerves |
| 64 | **Brachial Plexus** | الضفيرة العضدية | *Plexus brachialis* | `A14.2.03.001` | `nervous` | Vasa nervorum from subclavian, axillary, thyrocervical & transverse cervical arteries | Anterior primary rami of spinal roots C5, C6, C7, C8 & T1 |
| 65 | **Vagus Nerve (CN X)** | العصب المبهم (العصب القحفي العاشر) | *Nervus vagus (CN X)* | `A14.2.01.153` | `nervous` | Vasa nervorum from posterior inferior cerebellar, ascending pharyngeal, internal carotid & bronchial/esophageal arteries | Medullary nuclei: Nucleus ambiguus (branchial motor), Dorsal motor nucleus of vagus (parasympathetic), Nucleus tractus solitarius (visceral sensory/taste) |
| 66 | **Sciatic Nerve** | العصب الوركي | *Nervus ischiadicus* | `A14.2.07.046` | `nervous` | Accompanying artery of the sciatic nerve (inferior gluteal artery branch) & profunda femoris perforators | Lumbosacral nerve roots L4, L5, S1, S2 & S3 (Tibial & Common Fibular divisions) |
| 67 | **Skin (Cutis / Epidermis & Dermis)** | الجلد (البشرة والأدمة) | *Cutis (Integumentum commune)* | `A16.0.00.001` | `integumentary` | Cutaneous perforating arteries forming deep dermal & subpapillary arterial plexuses | Cutaneous branches of cranial & spinal nerves (Meissner, Pacinian, Ruffini, Merkel & free nerve endings) |

---

## 5. Modified Source Files & Audit Scripts
## 5. الملفات المعدّلة وسكربت التحقق

- [anatomyParser.ts](file:///d:/AOA/src/utils/anatomyParser.ts) — Hierarchical multi-primitive suffix normalization, Standard Anatomical Position `±X` laterality validation, intrinsic cardiac median rule, and expanded TA98/Latin `TERMINOLOGY_MAP`.
- [AnatomicalModelManager.tsx](file:///d:/AOA/src/components/canvas/AnatomicalModelManager.tsx) — Ancestor-walk name resolution for `mesh_0_1` child nodes and boundary-safe visceral peritoneal overlay filtering (`Mesocolon` hidden, `Colon`/`Omental_taenia` preserved).
- [nihSceneService.ts](file:///d:/AOA/src/services/nihSceneService.ts) — Lymph-node sphere noise exclusion (`isNoisyNonOrganEntry`).
- [explodeClusters.ts](file:///d:/AOA/src/utils/explodeClusters.ts) — Cohesive skeletal and multi-head muscular cluster regex stems (`resolveExplodeClusterId` / `applyRigidMacroExplodeOffset`).
- [clinicalBaseline.ts](file:///d:/AOA/src/data/clinicalBaseline.ts) — Truncation guards, 40+ *Gray's*/*Netter's* + WHO Arabic + TA98 entries, 19-rule `REGIONAL_CLINICAL_GUIDANCE_RULES`, and expanded Arabic localization maps.
- [medicalProfessorAudit.mjs](file:///d:/AOA/scripts/medicalProfessorAudit.mjs) — Automated 5-Pillar verification harness across all `5,784` meshes and `67` core verified structures.
