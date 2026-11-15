import type { AnatomicalSystem } from '../store/useAnatomyStore';
import { resolveTextbookEntry } from '../services/textbookKnowledgeService';
import type { AnatomicalClinicalProfile } from '../types/medicalData';
import type {
  AnatomicalLaterality,
  AnatomicalPartInfo,
} from '../utils/anatomyParser';

interface BaselineEntry {
  key: string;
  cleanNameEn: string;
  cleanNameAr: string;
  latinName: string;
  ta98Code: string;
  fmaId: string;
  system: AnatomicalSystem;
  region?: string;
  origin?: string;
  insertion?: string;
  action?: string;
  relationsEn?: string;
  wikiSearchTitleEn: string;
  wikiSearchTitleAr: string;
  summaryEn: string;
  summaryAr: string;
  primaryFunctionEn: string;
  primaryFunctionAr: string;
  arterialSupply: string;
  venousDrainage: string;
  innervation: string;
  clinicalNotesEn: string;
  clinicalNotesAr: string;
}

const BASELINE_DICTIONARY: Record<string, BaselineEntry> = {
  cranium: {
    key: 'cranium',
    cleanNameEn: 'Cranium (Skull)',
    cleanNameAr: 'الجمجمة (القحف)',
    latinName: 'Cranium',
    ta98Code: 'A02.1.00.001',
    fmaId: 'FMA:46565',
    system: 'skeletal',
    wikiSearchTitleEn: 'Skull',
    wikiSearchTitleAr: 'جمجمة',
    summaryEn:
      'Bony framework of the head composed of the neurocranium (enclosing the encephalon and meninges) and the viscerocranium (facial skeleton and mandible), joined primarily via fibrous sutures.',
    summaryAr:
      'الهيكل العظمي للرأس، ويتكون من القحف العصبي الذي يحيط بالدماغ والسحايا، والقحف الحشوي المكون لعظام الوجه والفك السفلي، وترتبط عظامه بمفاصل ليفية ثابتة تُسمى الدروز القحفية.',
    primaryFunctionEn:
      'Provides rigid mechanical protection for the brain, cranial nerves, and special sense organs while anchoring the muscles of mastication and facial expression.',
    primaryFunctionAr:
      'توفير حماية ميكانيكية صلبة للدماغ والأعصاب القحفية وأعضاء الحواس الخاصة، وتأمين مرتكزات لعضلات المضغ والتعبير الوجهي.',
    arterialSupply:
      'Middle meningeal, superficial temporal, maxillary & occipital arteries (external & internal carotid branches)',
    venousDrainage:
      'Diploic veins -> Dural venous sinuses -> Internal jugular vein',
    innervation:
      'Trigeminal nerve (CN V) sensory branches & upper cervical nerves (C2–C3) to periosteum/scalp',
    clinicalNotesEn:
      'Pterion fractures risk laceration of the anterior division of the middle meningeal artery, causing life-threatening epidural hematoma; basilar skull fractures may present with Battle sign or CSF rhinorrhea.',
    clinicalNotesAr:
      'كسور منطقة الجناحي (Pterion) قد تمزق الشريان السحائي الأوسط مسببةً ورماً دموياً فوق الجافية مهدداً للحياة؛ أما كسور قاعدة الجمجمة فقد تتظاهر بسيلان السائل الدماغي الشوكي.',
  },

  'cervical vertebrae': {
    key: 'cervical vertebrae',
    cleanNameEn: 'Cervical Vertebrae (C1–C7)',
    cleanNameAr: 'الفقرات العنقية (C1–C7)',
    latinName: 'Vertebrae cervicales',
    ta98Code: 'A02.2.02.001',
    fmaId: 'FMA:72063',
    system: 'skeletal',
    wikiSearchTitleEn: 'Cervical vertebrae',
    wikiSearchTitleAr: 'فقرات عنقية',
    summaryEn:
      'The seven superior-most vertebrae (C1 Atlas through C7 Vertebra prominens), distinguished by transverse foramina transmitting the vertebral arteries and a lordotic curvature.',
    summaryAr:
      'الفقرات السبع العليا من العمود الفقري (من الفهقة C1 حتى الشوكة البارزة C7)، وتتميز بوجود الثقوب المستعرضة التي يمر عبرها الشريان الفقري مع تقوس أمامي طبيعي.',
    primaryFunctionEn:
      'Supports the cranium, enables multi-axial flexion, extension, and rotation of the head/neck, and shields the cervical spinal cord and vertebral arteries.',
    primaryFunctionAr:
      'دعم وزن الجمجمة، وإتاحة حركة الرأس والعنق في جميع المحاور، وحماية الحبل الشوكي العنقي والأوعية الفقرية.',
    arterialSupply:
      'Segmental branches of the vertebral, ascending cervical & deep cervical arteries',
    venousDrainage:
      'Internal & external vertebral venous plexuses -> Vertebral & brachiocephalic veins',
    innervation:
      'Sinuvertebral nerves & posterior rami of cervical spinal nerves (C1–C8)',
    clinicalNotesEn:
      'C1–C2 atlantoaxial instability or Jefferson/Hangman fractures carry high risk of high-cervical cord injury; cervical disc herniation (commonly C5–C6, C6–C7) compresses exiting nerve roots.',
    clinicalNotesAr:
      'إصابات الفهقة والمحور (C1–C2) أو انزلاق الأقراص العنقية (خصوصاً C5–C6 وC6–C7) قد تؤدي إلى انضغاط جذور الأعصاب العنقية أو الحبل الشوكي.',
  },

  'thoracic cage': {
    key: 'thoracic cage',
    cleanNameEn: 'Thoracic Cage & Sternum',
    cleanNameAr: 'القفص الصدري والقص',
    latinName: 'Cavea thoracis',
    ta98Code: 'A02.3.04.001',
    fmaId: 'FMA:7480',
    system: 'skeletal',
    wikiSearchTitleEn: 'Rib cage',
    wikiSearchTitleAr: 'قفص صدري',
    summaryEn:
      'Osteocartilaginous cage formed posteriorly by thoracic vertebrae T1–T12, laterally by 12 pairs of ribs and costal cartilages, and anteriorly by the manubrium, sternal body, and xiphoid process.',
    summaryAr:
      'بنية عظمية غضروفية تتكون خلفياً من الفقرات الصدرية (T1–T12)، وجانبياً من اثني عشر زوجاً من الأضلاع وغضاريفها، وأمامياً من عظم القص (القبضة والجسم والناتئ الخنجري).',
    primaryFunctionEn:
      'Protects the heart, great vessels, and lungs while generating negative intrathoracic pressure changes during inspiration via bucket-handle and pump-handle rib motion.',
    primaryFunctionAr:
      'حماية القلب والأوعية الكبرى والرئتين، وتسهيل ميكانيكية التنفس عبر تمدد التجويف الصدري وخلق ضغط سلبي للشهيق.',
    arterialSupply:
      'Posterior intercostal arteries (thoracic aorta) & anterior intercostal arteries (internal thoracic artery)',
    venousDrainage:
      'Intercostal veins -> Azygos / hemiazygos system & internal thoracic veins',
    innervation:
      'Intercostal nerves (anterior rami of T1–T11) & subcostal nerve (T12)',
    clinicalNotesEn:
      'Multiple consecutive rib fractures in ≥2 places produce flail chest with paradoxical respiration; the sternal angle (Angle of Louis, T4–T5) marks the second costal cartilage and tracheal bifurcation.',
    clinicalNotesAr:
      'كسور الأضلاع المتعددة في موقعين قد تسبب الصدر السائب (Flail Chest) مع حركة تنفسية متناقضة؛ وتُعد الزاوية القصية (T4–T5) معلماً جراحياً مهماً لتفرع الرغامى.',
  },

  'lumbar vertebrae': {
    key: 'lumbar vertebrae',
    cleanNameEn: 'Lumbar Vertebrae (L1–L5)',
    cleanNameAr: 'الفقرات القطنية (L1–L5)',
    latinName: 'Vertebrae lumbales',
    ta98Code: 'A02.2.04.001',
    fmaId: 'FMA:72065',
    system: 'skeletal',
    wikiSearchTitleEn: 'Lumbar vertebrae',
    wikiSearchTitleAr: 'فقرات قطنية',
    summaryEn:
      'Five massive weight-bearing vertebrae of the lower back featuring kidney-shaped vertebral bodies, stout pedicles, and sagittal-oriented facet joints lacking costal facets or transverse foramina.',
    summaryAr:
      'خمس فقرات ضخمة في أسفل الظهر تتميز بأجسام فقرية كبيرة تتحمل الثقل المحوري، ومفاصل وجهية موجهة سهمياً لتسهيل الانثناء والامتداد.',
    primaryFunctionEn:
      'Transmits upper body weight to the pelvic girdle and sacrum while enclosing the conus medullaris (ending at L1–L2) and cauda equina.',
    primaryFunctionAr:
      'نقل وزن الجزء العلوي من الجسم إلى الحوض والعجز، وحماية المخروط النخاعي وذيل الفرس (Cauda Equina).',
    arterialSupply:
      'Lumbar segmental arteries arising directly from the posterior abdominal aorta',
    venousDrainage:
      'Internal & external vertebral venous plexuses -> Lumbar veins -> Inferior vena cava',
    innervation:
      'Recurrent meningeal (sinuvertebral) nerves & medial branches of lumbar dorsal rami',
    clinicalNotesEn:
      'L4–L5 and L5–S1 are the most frequent sites of intervertebral disc herniation causing lumbar radiculopathy; lumbar puncture is safely performed at L3–L4 or L4–L5 below the conus medullaris.',
    clinicalNotesAr:
      'تُعد المستويات L4–L5 وL5–S1 الأكثر عرضة للانزلاق الغضروفي المسبب لعرق النسا، كما يُجرى البزل القطني بأمان بين L3–L4 أو L4–L5 أسفل نهاية الحبل الشوكي.',
  },

  pelvis: {
    key: 'pelvis',
    cleanNameEn: 'Pelvic Girdle & Sacrum',
    cleanNameAr: 'الحوض والعجز',
    latinName: 'Pelvis',
    ta98Code: 'A02.5.02.001',
    fmaId: 'FMA:9578',
    system: 'skeletal',
    wikiSearchTitleEn: 'Pelvis',
    wikiSearchTitleAr: 'حوض (تشريح)',
    summaryEn:
      'Ring-like bony basin composed of the paired hip bones (ilium, ischium, and pubis fused at the acetabulum) articulating posteriorly with the sacrum and anteriorly at the pubic symphysis.',
    summaryAr:
      'حزام عظمي حلقي يتشكل من التقاء عظمي الورك (الحرقفة والإسك والعانة عند الحق) مع العجز خلفياً والارتفاق العاني أمامياً.',
    primaryFunctionEn:
      'Transfers axial load from the vertebral column to the lower extremities, anchors trunk/hip musculature, and protects pelvic viscera including the bladder and reproductive organs.',
    primaryFunctionAr:
      'نقل الثقل من العمود الفقري إلى الطرفين السفليين، وتوفير ارتكاز للعضلات، وحماية الأحشاء الحوضية والأوعية والأعصاب الرئيسة.',
    arterialSupply:
      'Internal & external iliac arteries (superior/inferior gluteal, obturator & iliolumbar branches)',
    venousDrainage:
      'Pelvic venous plexuses & gluteal/obturator veins -> Internal & common iliac veins',
    innervation:
      'Lumbosacral plexus (L4–S4) & obturator/femoral periosteal branches',
    clinicalNotesEn:
      'High-energy pelvic ring fractures carry substantial risk of retroperitoneal hemorrhage from the presacral venous plexus and internal iliac branches; anterior superior iliac spine (ASIS) serves as a key surgical landmark.',
    clinicalNotesAr:
      'كسور حلقة الحوض عالية الطاقة تشكل خطراً لنزيف خلف الصفاق من الضفيرة الوريدية أمام العجز وفروع الشريان الحرقفي الغائر.',
  },

  femur: {
    key: 'femur',
    cleanNameEn: 'Femur',
    cleanNameAr: 'عظم الفخذ',
    latinName: 'Femur',
    ta98Code: 'A02.5.04.001',
    fmaId: 'FMA:9611',
    system: 'skeletal',
    wikiSearchTitleEn: 'Femur',
    wikiSearchTitleAr: 'عظم الفخذ',
    summaryEn:
      'Longest and strongest tubular bone in the human skeleton, articulating proximally with the acetabulum of the pelvis via the femoral head and distally with the tibia and patella at the knee.',
    summaryAr:
      'أطول وأقوى عظم أنبوبي في جسم الإنسان؛ يتمفصل من الأعلى مع الحق الحوضي عبر رأس الفخذ، ومن الأسفل مع الظنبوب والرضفة لتكوين مفصل الركبة.',
    primaryFunctionEn:
      'Supports full body weight during standing and locomotion and acts as the primary mechanical lever for hip and knee musculature.',
    primaryFunctionAr:
      'تحمل كامل وزن الجسم أثناء الوقوف والمشي والعمل كرافعة ميكانيكية رئيسة لعضلات الورك والفخذ.',
    arterialSupply:
      'Medial & lateral femoral circumflex arteries (profunda femoris) & nutrient branches of profunda femoris',
    venousDrainage:
      'Profunda femoris & femoral circumflex veins -> Femoral vein',
    innervation:
      'Femoral, obturator & sciatic nerve periosteal branches (Hilton law)',
    clinicalNotesEn:
      'Intracapsular femoral neck fractures frequently disrupt the retinacular branches of the medial femoral circumflex artery, predisposing the femoral head to avascular necrosis.',
    clinicalNotesAr:
      'كسور عنق الفخذ داخل المحفظة قد تقطع التروية الدموية القادمة من الشريان المنعطف الفخذي الإنسي مما يهدد بنخر لاوعائي في رأس الفخذ.',
  },

  brain: {
    key: 'brain',
    cleanNameEn: 'Brain (Encephalon)',
    cleanNameAr: 'الدماغ',
    latinName: 'Encephalon',
    ta98Code: 'A14.1.03.001',
    fmaId: 'FMA:50801',
    system: 'nervous',
    wikiSearchTitleEn: 'Brain',
    wikiSearchTitleAr: 'دماغ',
    summaryEn:
      'Supreme integrative organ of the central nervous system comprising the cerebrum (bilateral hemispheres), diencephalon, cerebellum, and brainstem (midbrain, pons, medulla oblongata).',
    summaryAr:
      'العضو المركزي الأعلى في الجهاز العصبي، ويتألف من نصفي الكرة المخية والدماغ البيني والمخيخ وجذع الدماغ (الدماغ المتوسط والجسر والنخاع المستطيل).',
    primaryFunctionEn:
      'Integrates sensory perception, conscious cognition, memory, voluntary motor planning, cerebellar coordination, and autonomic cardiorespiratory homeostasis.',
    primaryFunctionAr:
      'معالجة الإدراك الحسي والوظائف المعرفية والذاكرة والتخطيط الحركي الإرادي، وتنسيق التوازن وتنظيم الوظائف الحيوية اللاإرادية.',
    arterialSupply:
      'Circle of Willis via paired internal carotid arteries & vertebrobasilar system',
    venousDrainage:
      'Superficial & deep cerebral veins -> Dural venous sinuses -> Internal jugular veins',
    innervation:
      'Intrinsic CNS parenchyma (pain-insensitive); meninges innervated by CN V, CN X & C1–C3',
    clinicalNotesEn:
      'Occlusion of the middle cerebral artery produces contralateral hemiparesis and aphasia (dominant hemisphere); elevated intracranial pressure risks uncal or tonsillar herniation.',
    clinicalNotesAr:
      'انسداد الشريان الدماغي الأوسط يسبب شللاً نصفياً مقابلاً وحبسة كلامية؛ كما أن ارتفاع الضغط داخل القحف قد يؤدي إلى انفتاق دماغي خطير.',
  },

  lungs: {
    key: 'lungs',
    cleanNameEn: 'Lung',
    cleanNameAr: 'الرئة',
    latinName: 'Pulmo',
    ta98Code: 'A06.5.01.001',
    fmaId: 'FMA:7195',
    system: 'visceral',
    wikiSearchTitleEn: 'Lung',
    wikiSearchTitleAr: 'رئة',
    summaryEn:
      'Paired spongy, elastic organs of respiration occupying the pleural cavities; the right lung consists of three lobes (superior, middle, inferior) while the left lung has two lobes and a cardiac notch.',
    summaryAr:
      'عضوان إسفنجيان مرنان يشغلان التجويفين الجنبيين؛ تتكون الرئة اليمنى من ثلاثة فصوص بينما تتكون اليسرى من فصين وتحتوي على الثلمة القلبية.',
    primaryFunctionEn:
      'Facilitates alveolar-capillary gas exchange (O₂ uptake and CO₂ elimination) and regulates systemic acid-base balance and angiotensin I conversion.',
    primaryFunctionAr:
      'تنفيذ التبادل الغازي بين الأسناخ الهوائية والشعيرات الدموية (امتصاص الأكسجين وطرح ثنائي أكسيد الكربون) والمساهمة في توازن الحموضة.',
    arterialSupply:
      'Deoxygenated: Pulmonary arteries; Oxygenated parenchyma/bronchi: Bronchial arteries (thoracic aorta)',
    venousDrainage:
      'Four pulmonary veins (oxygenated) -> Left atrium; Bronchial veins -> Azygos/hemiazygos veins',
    innervation:
      'Pulmonary plexus: Parasympathetic (Vagus CN X) & Sympathetic (T1–T4 sympathetic trunk)',
    clinicalNotesEn:
      'Pleural space air or blood accumulation causes pneumothorax or hemothorax; pulmonary embolism obstructs pulmonary arterial branches, creating severe ventilation-perfusion mismatch.',
    clinicalNotesAr:
      'تراكم الهواء أو الدم في التجويف الجنبي يسبب استرواح الصدر أو تدمي الصدر، بينما يؤدي الصمام الرئوي إلى انسداد التروية واختلال التهوية والتروية.',
  },

  lung: {
    key: 'lung',
    cleanNameEn: 'Lung',
    cleanNameAr: 'الرئة',
    latinName: 'Pulmo',
    ta98Code: 'A06.5.01.001',
    fmaId: 'FMA:7195',
    system: 'visceral',
    wikiSearchTitleEn: 'Lung',
    wikiSearchTitleAr: 'رئة',
    summaryEn:
      'Paired spongy, elastic organ of respiration occupying the pleural cavity; the right lung has three lobes while the left lung has two lobes and a cardiac notch.',
    summaryAr:
      'عضو تنفسي إسفنجي مرن يشغل التجويف الجنبي؛ تتكون الرئة اليمنى من ثلاثة فصوص واليسرى من فصين وتحتوي على الثلمة القلبية.',
    primaryFunctionEn:
      'Facilitates alveolar-capillary gas exchange (O₂ uptake and CO₂ elimination) and contributes to acid-base regulation.',
    primaryFunctionAr:
      'تنفيذ التبادل الغازي عبر الأسناخ والشعيرات الدموية وتنظيم توازن الغازات وحموضة الدم.',
    arterialSupply:
      'Deoxygenated: Pulmonary arteries; Parenchyma/bronchi: Bronchial arteries (thoracic aorta)',
    venousDrainage:
      'Pulmonary veins -> Left atrium; Bronchial veins -> Azygos system',
    innervation:
      'Pulmonary plexus: Vagus nerve (CN X) & Sympathetic fibers (T1–T4)',
    clinicalNotesEn:
      'Thoracentesis is performed at the superior border of a rib along the midaxillary/posterior line to avoid the intercostal neurovascular bundle running in the costal groove.',
    clinicalNotesAr:
      'يُجرى بزل الجنب فوق الحافة العلوية للضلع لتجنب إصابة الحزمة العصبية الوعائية الوربية المارة في التلم الضلعي.',
  },

  liver: {
    key: 'liver',
    cleanNameEn: 'Liver',
    cleanNameAr: 'الكبد',
    latinName: 'Hepar',
    ta98Code: 'A05.8.01.001',
    fmaId: 'FMA:7197',
    system: 'visceral',
    wikiSearchTitleEn: 'Liver',
    wikiSearchTitleAr: 'كبد',
    summaryEn:
      'Largest internal visceral organ and metabolic gland, seated beneath the right hemidiaphragm and subdivided surgically into eight Couinaud functional segments across right, left, caudate, and quadrate lobes.',
    summaryAr:
      'أكبر عضو حشوي وغدة استقلابية في الجسم، يقع تحت الحجاب الحاجز في الربع العلوي الأيمن، ويُقسم جراحياً إلى ثمانية شدفات وظيفية وفق تقسيم كوينو.',
    primaryFunctionEn:
      'Performs macronutrient metabolism, bile synthesis, plasma protein and clotting factor production, glycogen storage, and xenobiotic/drug detoxification.',
    primaryFunctionAr:
      'الاستقلاب الغذائي، وإفراز العصارة الصفراوية، وتصنيع البروتينات البلازمية وعوامل التخثر، وتخزين الغليكوجين، وإزالة سمية الأدوية والمستقلبات.',
    arterialSupply:
      'Dual blood supply: Hepatic artery proper (~25% oxygenated) & Hepatic portal vein (~75% nutrient-rich)',
    venousDrainage:
      'Right, middle & left hepatic veins -> Inferior vena cava',
    innervation:
      'Hepatic plexus (Celiac plexus sympathetic fibers & Vagus nerve CN X parasympathetic)',
    clinicalNotesEn:
      'The Pringle maneuver compresses the hepatoduodenal ligament containing the portal triad (hepatic artery proper, portal vein, common bile duct) to control hepatic hemorrhage during trauma surgery.',
    clinicalNotesAr:
      'مناورة برينغل تضغط الرباط الكبدي الاثني عشري الذي يضم الثالوث البابي للسيطرة على النزف الكبدي؛ كما يؤدي تشمع الكبد إلى ارتفاع ضغط الوريد البابي.',
  },

  stomach: {
    key: 'stomach',
    cleanNameEn: 'Stomach',
    cleanNameAr: 'المعدة',
    latinName: 'Ventriculus',
    ta98Code: 'A05.5.01.001',
    fmaId: 'FMA:7148',
    system: 'visceral',
    wikiSearchTitleEn: 'Stomach',
    wikiSearchTitleAr: 'معدة',
    summaryEn:
      'J-shaped muscular dilation of the upper gastrointestinal tract interposed between the abdominal esophagus and duodenum, divided into cardia, fundus, body, and pyloric antrum/canal.',
    summaryAr:
      'اتساع عضلي على شكل حرف J في السبيل الهضمي العلوي بين المريء والاثني عشر، وينقسم تشريحياً إلى الفؤاد والقاع والجسم والبواب.',
    primaryFunctionEn:
      'Secretes hydrochloric acid, pepsinogen, and intrinsic factor while mechanically churning ingested food into acidic chyme for controlled duodenal emptying.',
    primaryFunctionAr:
      'إفراز حمض الهيدروكلوريك والبيبسينوجين والعامل الداخلي، ومزج الطعام ميكانيكياً وتحويله إلى كيموس قبل دفعه نحو الاثني عشر.',
    arterialSupply:
      'Celiac trunk branches: Left & right gastric, left & right gastro-omental & short gastric arteries',
    venousDrainage:
      'Gastric & gastro-omental veins -> Hepatic portal venous system (left gastric vein forms portacaval anastomoses)',
    innervation:
      'Vagus nerves (CN X anterior/posterior trunks) & Sympathetic celiac plexus (T6–T9)',
    clinicalNotesEn:
      'Posterior gastric wall ulcers may erode into the gastroduodenal or splenic artery causing severe upper GI bleeding; left gastric vein varices arise in portal hypertension.',
    clinicalNotesAr:
      'قرحات الجدار الخلفي للمعدة قد تتآكل نحو الشريان الطحالي أو المعدي الاثني عشري مسببةً نزفاً هضمياً علوياً حاداً.',
  },

  kidneys: {
    key: 'kidneys',
    cleanNameEn: 'Kidneys',
    cleanNameAr: 'الكليتان',
    latinName: 'Renes',
    ta98Code: 'A08.1.01.001',
    fmaId: 'FMA:7203',
    system: 'visceral',
    wikiSearchTitleEn: 'Kidney',
    wikiSearchTitleAr: 'كلية (تشريح)',
    summaryEn:
      'Paired bean-shaped retroperitoneal organs flanking T12–L3 (the right kidney positioned slightly lower due to the liver), composed of an outer renal cortex, medullary pyramids, and renal pelvis.',
    summaryAr:
      'عضوان خلف الصفاق على جانبي العمود الفقري (T12–L3)، وتقع الكلية اليمنى أخفض قليلاً بسبب الكبد، وتتكونان من قشرة خارجية ولب كلوي وحويضة الكلية.',
    primaryFunctionEn:
      'Filters plasma via ~1 million nephrons per kidney to excrete metabolic waste, regulate fluid/electrolyte osmolarity, control arterial blood pressure (renin), and synthesize erythropoietin.',
    primaryFunctionAr:
      'ترشيح البلازما عبر الكليونات لطرح الفضلات الاستقلابية، وتنظيم توازن السوائل والشوارد وضغط الدم (الرينين)، وإنتاج الإريثروبويتين.',
    arterialSupply:
      'Left & right renal arteries arising directly from the abdominal aorta (~L1–L2)',
    venousDrainage:
      'Left & right renal veins -> Inferior vena cava (left renal vein crosses anterior to aorta under SMA)',
    innervation:
      'Renal plexus (Aorticorenal ganglion sympathetic T10–L1 & Vagus CN X fibers)',
    clinicalNotesEn:
      'The left renal vein may be compressed between the abdominal aorta and superior mesenteric artery (Nutcracker syndrome); nephrolithiasis commonly lodges at the ureteropelvic junction, pelvic brim, or vesicoureteric junction.',
    clinicalNotesAr:
      'قد ينضغط الوريد الكلوي الأيسر بين الأبهر والشريان المساريقي العلوي (متلازمة كسارة البندق)، وتنحشر الحصيات الكلوية غالباً عند نقاط التضيق الحالبية الثلاث.',
  },

  kidney: {
    key: 'kidney',
    cleanNameEn: 'Kidney',
    cleanNameAr: 'الكلية',
    latinName: 'Ren',
    ta98Code: 'A08.1.01.001',
    fmaId: 'FMA:7203',
    system: 'visceral',
    wikiSearchTitleEn: 'Kidney',
    wikiSearchTitleAr: 'كلية (تشريح)',
    summaryEn:
      'Bean-shaped retroperitoneal organ situated at T12–L3, organized into an outer renal cortex, inner renal medulla with pyramids, calyces, and renal pelvis.',
    summaryAr:
      'عضو خلف الصفاق يقع عند مستوى T12–L3، يتكون من القشرة الكلوية واللب والأهرامات الكلوية والكؤوس وحويضة الكلية.',
    primaryFunctionEn:
      'Maintains fluid, electrolyte, and acid-base homeostasis while excreting nitrogenous waste and secreting renin and erythropoietin.',
    primaryFunctionAr:
      'الحفاظ على توازن السوائل والشوارد والحموضة، وطرح الفضلات الآزوتية، وإفراز الرينين والإريثروبويتين.',
    arterialSupply: 'Renal artery (direct branch of abdominal aorta)',
    venousDrainage: 'Renal vein -> Inferior vena cava',
    innervation: 'Renal autonomic plexus (T10–L1 sympathetic & CN X)',
    clinicalNotesEn:
      'Retroperitoneal positioning allows posterior surgical/percutaneous nephrolithotomy access without traversing the peritoneal cavity.',
    clinicalNotesAr:
      'الموقع خلف الصفاق يتيح الوصول الجراحي الخلفي أو عبر الجلد دون فتح التجويف البريتوني.',
  },

  heart: {
    key: 'heart',
    cleanNameEn: 'Heart',
    cleanNameAr: 'القلب',
    latinName: 'Cor',
    ta98Code: 'A12.1.00.001',
    fmaId: 'FMA:7088',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Heart',
    wikiSearchTitleAr: 'قلب',
    summaryEn:
      'Four-chambered fibromuscular pump located within the middle mediastinum inside the fibrous pericardium, with its apex directed anteriorly, inferiorly, and to the left (5th intercostal space, midclavicular line).',
    summaryAr:
      'مضخة عضلية ليفية ذات أربع حجرات تقع في المنصف الأوسط داخل التأمور، وتتجه قمته للأمام والأسفل واليسار عند الحيز الوربي الخامس على خط منتصف الترقوة.',
    primaryFunctionEn:
      'Propels deoxygenated venous blood through the pulmonary circulation for oxygenation and pumps oxygenated blood into the systemic arterial tree.',
    primaryFunctionAr:
      'ضخ الدم غير المؤكسج إلى الدورة الدموية الرئوية لأكسجته، وضخ الدم المؤكسج إلى الدورة الجهازية لتغذية جميع أنسجة الجسم.',
    arterialSupply:
      'Left & right coronary arteries arising from the aortic sinuses immediately above the aortic valve',
    venousDrainage:
      'Great, middle & small cardiac veins -> Coronary sinus -> Right atrium',
    innervation:
      'Cardiac plexus: Vagus nerve (CN X, slows SA/AV nodes) & Sympathetic T1–T4 fibers (increases chronotropy/inotropy)',
    clinicalNotesEn:
      'Occlusion of the left anterior descending (LAD) coronary artery ("widowmaker") causes anterior myocardial infarction; pericardial fluid accumulation leads to cardiac tamponade (Beck triad).',
    clinicalNotesAr:
      'انسداد الشريان الأمامي النازل الأيسر يسبب احتشاء العضلة القلبية الأمامي، كما يؤدي انصباب التأمور السريع إلى الاندحاس القلبي.',
  },

  'aorta arch': {
    key: 'aorta arch',
    cleanNameEn: 'Aortic Arch & Descending Aorta',
    cleanNameAr: 'قوس الأبهر والأبهر النازل',
    latinName: 'Arcus aortae',
    ta98Code: 'A12.2.04.001',
    fmaId: 'FMA:3768',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Aortic arch',
    wikiSearchTitleAr: 'قوس الأبهر',
    summaryEn:
      'Major elastic arterial conduit arching posteriorly and leftward over the left pulmonary artery and bronchus before descending as the thoracic and abdominal aorta to bifurcate at L4.',
    summaryAr:
      'الشريان المرن الرئيسي الذي ينقوس للخلف واليسار فوق الشريان الرئوي الأيسر ثم ينحدر كأبهر صدري وبطني حتى يتفرع عند الفقرة القطنية الرابعة L4.',
    primaryFunctionEn:
      'Distributes high-pressure oxygenated blood to the head, upper limbs, thorax, abdominal viscera, and lower extremities via Windkessel elastic recoil.',
    primaryFunctionAr:
      'توزيع الدم المؤكسج عالي الضغط إلى الرأس والطرفين العلويين والصدر وأحشاء البطن والطرفين السفليين.',
    arterialSupply:
      'Vasa vasorum from bronchial, intercostal & coronary branches',
    venousDrainage: 'Azygos & hemiazygos venous tributaries',
    innervation:
      'Aortic baroreceptor & chemoreceptor afferents via Vagus nerve (CN X) & thoracic sympathetic plexus',
    clinicalNotesEn:
      'The three classic arch branches are brachiocephalic trunk, left common carotid, and left subclavian arteries; the aortic isthmus distal to the left subclavian artery is vulnerable to traumatic aortic transection.',
    clinicalNotesAr:
      'يعطي قوس الأبهر ثلاثة فروع كبرى (الجذع العضدي الرأسي والسباتي المشترك الأيسر وتحت الترقوة الأيسر)، ويُعد برزخ الأبهر أكثر المواقع عرضة للتمزق الرضي.',
  },

  'superior vena cava': {
    key: 'superior vena cava',
    cleanNameEn: 'Superior Vena Cava',
    cleanNameAr: 'الوريد الأجوف العلوي',
    latinName: 'Vena cava superior',
    ta98Code: 'A12.3.03.001',
    fmaId: 'FMA:4720',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Superior vena cava',
    wikiSearchTitleAr: 'وريد أجوف علوي',
    summaryEn:
      'Large valveless venous trunk formed by the confluence of the right and left brachiocephalic veins behind the right first costal cartilage, descending vertically into the right atrium.',
    summaryAr:
      'جذع وريدي كبير عديم الصمامات يتشكل من اتحاد الوريدين العضديين الرأسيين الأيمن والأيسر خلف الغضروف الضلعي الأول الأيمن ويصب مباشرة في الأذين الأيمن.',
    primaryFunctionEn:
      'Returns all systemic venous blood from the head, neck, upper extremities, and thoracic wall (via the azygos vein) back to the right heart.',
    primaryFunctionAr:
      'إرجاع كامل الدم الوريدي من الرأس والعنق والطرفين العلويين وجدار الصدر (عبر الوريد الفرد) إلى الأذين الأيمن للقلب.',
    arterialSupply: 'Vasa vasorum from internal thoracic & pericardiacophrenic vessels',
    venousDrainage: 'Drains directly into the right atrium of the heart',
    innervation: 'Autonomic cardiopulmonary plexus (T1–T4 sympathetic & CN X)',
    clinicalNotesEn:
      'External compression by mediastinal tumors or central venous catheter thrombosis produces Superior Vena Cava (SVC) syndrome, presenting with facial/neck plethora and dilated chest wall collaterals.',
    clinicalNotesAr:
      'انضغاط الوريد بأورام المنصف أو الخثار يسبب متلازمة الوريد الأجوف العلوي مع احتقان الوجه والعنق وتوسع الأوردة السطحية بالصدر.',
  },

  'spinal cord': {
    key: 'spinal cord',
    cleanNameEn: 'Spinal Cord',
    cleanNameAr: 'الحبل الشوكي',
    latinName: 'Medulla spinalis',
    ta98Code: 'A14.1.02.001',
    fmaId: 'FMA:7647',
    system: 'nervous',
    wikiSearchTitleEn: 'Spinal cord',
    wikiSearchTitleAr: 'نخاع شوكي',
    summaryEn:
      'Cylindrical central nervous system tract extending from the foramen magnum (continuous with the medulla oblongata) down the vertebral canal to terminate as the conus medullaris at L1–L2 in adults.',
    summaryAr:
      'حزمة عصبية مركزية أسطوانية تمتد من الثقبة العظمى اتصالاً بالنخاع المستطيل داخل القناة الفقرية حتى تنتهي عند مستوى L1–L2 بالمخروط النخاعي.',
    primaryFunctionEn:
      'Conducts ascending sensory and descending motor pathways between the brain and peripheral body while mediating rapid segmental spinal reflexes.',
    primaryFunctionAr:
      'نقل السيالات الحسية الصاعدة والأوامر الحركية النازلة بين الدماغ والجسم، وتنفيذ المنعكسات الشوكية السريعة.',
    arterialSupply:
      'One anterior spinal artery & paired posterior spinal arteries reinforced by radicular arteries (artery of Adamkiewicz)',
    venousDrainage:
      'Anterior & posterior spinal veins -> Internal vertebral venous plexus (Batson plexus)',
    innervation: 'Central nervous system parenchyma; dura/pia innervated by sinuvertebral nerves',
    clinicalNotesEn:
      'Anterior spinal artery occlusion spares dorsal column proprioception while causing bilateral motor paralysis and loss of pain/temperature below the lesion; Brown-Séquard syndrome reflects cord hemisection.',
    clinicalNotesAr:
      'انسداد الشريان الشوكي الأمامي يسبب شللاً حركياً وفقدان حس الألم والحرارة مع سلامة حس الاهتزاز والوضعة في الأعمدة الخلفية.',
  },

  'brachial plexus': {
    key: 'brachial plexus',
    cleanNameEn: 'Brachial Plexus',
    cleanNameAr: 'الضفيرة العضدية',
    latinName: 'Plexus brachialis',
    ta98Code: 'A14.2.03.001',
    fmaId: 'FMA:5906',
    system: 'nervous',
    wikiSearchTitleEn: 'Brachial plexus',
    wikiSearchTitleAr: 'ضفيرة عضدية',
    summaryEn:
      'Major somatic nerve network formed by the anterior rami of C5–T1 spinal nerves, organizing sequentially into Roots, Trunks, Divisions, Cords, and terminal peripheral nerves of the upper limb.',
    summaryAr:
      'شبكة عصبية كبرى تتكون من الفروع الأمامية للأعصاب الشوكية C5–T1، وتنتظم تشريحياً في جذور وجذوع وأقسام وحبال ثم أعصاب طرفية للطرف العلوي.',
    primaryFunctionEn:
      'Provides comprehensive motor innervation and cutaneous/proprioceptive sensation to the shoulder girdle, arm, forearm, and hand (musculocutaneous, axillary, radial, median, ulnar nerves).',
    primaryFunctionAr:
      'توفير التعصيب الحركي والحسي الكامل لحزام الكتف والذراع والساعد واليد عبر الأعصاب النهائية الكبرى.',
    arterialSupply:
      'Vasa nervorum from subclavian, axillary, thyrocervical & transverse cervical arteries',
    venousDrainage: 'Subclavian & axillary venous tributaries',
    innervation: 'Anterior primary rami of spinal roots C5, C6, C7, C8 & T1',
    clinicalNotesEn:
      'Upper trunk injury (C5–C6) yields Erb-Duchenne palsy ("waiter’s tip"); lower trunk traction (C8–T1) causes Klumpke palsy with claw hand and possible Horner syndrome.',
    clinicalNotesAr:
      'إصابة الجذع العلوي (C5–C6) تسبب شلل إيرب، بينما تؤدي إصابة الجذع السفلي (C8–T1) إلى شلل كلومبكي مع اليد المخلبية.',
  },

  'sciatic nerve': {
    key: 'sciatic nerve',
    cleanNameEn: 'Sciatic Nerve',
    cleanNameAr: 'العصب الوركي',
    latinName: 'Nervus ischiadicus',
    ta98Code: 'A14.2.07.046',
    fmaId: 'FMA:19034',
    system: 'nervous',
    wikiSearchTitleEn: 'Sciatic nerve',
    wikiSearchTitleAr: 'عصب وركي',
    summaryEn:
      'Thickest peripheral nerve in the human body arising from the lumbosacral plexus (L4–S3), exiting the pelvis through the greater sciatic foramen inferior to piriformis before bifurcating into tibial and common fibular nerves.',
    summaryAr:
      'أسمك عصب محيطي في جسم الإنسان، ينشأ من الضفيرة القطنية العجزية (L4–S3) ويخرج عبر الثقبة الوركية الكبرى أسفل العضلة الكمثرية ليتفرع إلى العصب الظنبوبي والشظوي المشترك.',
    primaryFunctionEn:
      'Innervates the posterior thigh compartment (hamstrings) and supplies virtually all motor and sensory function below the knee.',
    primaryFunctionAr:
      'تعصيب عضلات الفخذ الخلفية ونقل الإحساس والحركة إلى كامل الساق والقدم باستثناء الشريط الجلدي الإنسي.',
    arterialSupply:
      'Accompanying artery of the sciatic nerve (inferior gluteal artery branch) & profunda femoris perforators',
    venousDrainage: 'Inferior gluteal & profunda femoris veins',
    innervation: 'Lumbosacral nerve roots L4, L5, S1, S2 & S3 (Tibial & Common Fibular divisions)',
    clinicalNotesEn:
      'Gluteal intramuscular injections must target the upper outer quadrant to prevent iatrogenic sciatic nerve injury; posterior hip dislocation or L4–S1 disc herniation triggers sciatica.',
    clinicalNotesAr:
      'يجب إعطاء الحقن العضلية الإليوية في الربع العلوي الوحشي لتفادي إصابة العصب الوركي؛ كما يسبب الانزلاق الغضروفي ألم عرق النسا الممتد على مساره.',
  },

  'pectoralis major': {
    key: 'pectoralis major',
    cleanNameEn: 'Pectoralis Major',
    cleanNameAr: 'العضلة الصدرية الكبرى',
    latinName: 'Musculus pectoralis major',
    ta98Code: 'A04.4.01.002',
    fmaId: 'FMA:9627',
    system: 'muscular',
    wikiSearchTitleEn: 'Pectoralis major',
    wikiSearchTitleAr: 'عضلة صدرية كبيرة',
    summaryEn:
      'Thick fan-shaped superficial muscle of the anterior chest wall with clavicular and sternocostal heads converging onto the lateral lip of the intertubercular sulcus of the humerus.',
    summaryAr:
      'عضلة سطحية سميكة مروحية الشكل في جدار الصدر الأمامي، تتألف من رأس ترقوي ورأس قصي ضلعي يرتكزان على الشفة الوحشية للتلم بين الحديبتين في عظم العضد.',
    primaryFunctionEn:
      'Adducts and medially rotates the humerus at the glenohumeral joint, flexes the arm (clavicular head), and assists forced inspiration.',
    primaryFunctionAr:
      'تقريب وتدوير عظم العضد للداخل عند مفصل الكتف، وثني الذراع (الرأس الترقوي)، والمساعدة في الشهيق القسري.',
    arterialSupply:
      'Pectoral branch of the thoracoacromial trunk (axillary artery) & internal thoracic perforators',
    venousDrainage: 'Thoracoacromial & axillary veins',
    innervation:
      'Lateral pectoral nerve (C5–C7) & Medial pectoral nerve (C8–T1)',
    clinicalNotesEn:
      'Forms the anterior axillary fold and covers the clavipectoral fascia; congenital absence is the hallmark of Poland syndrome.',
    clinicalNotesAr:
      'تشكل الطية الإبطية الأمامية وتغطي اللفافة الترقوية الصدرية، ويميز غيابها الخلقي متلازمة بولاند.',
  },

  deltoid: {
    key: 'deltoid',
    cleanNameEn: 'Deltoid',
    cleanNameAr: 'العضلة الدالية',
    latinName: 'Musculus deltoideus',
    ta98Code: 'A04.6.02.002',
    fmaId: 'FMA:32521',
    system: 'muscular',
    wikiSearchTitleEn: 'Deltoid muscle',
    wikiSearchTitleAr: 'عضلة دالية',
    summaryEn:
      'Triangular multipennate muscle forming the rounded contour of the shoulder, originating from the lateral clavicle, acromion, and spine of scapula to insert onto the deltoid tuberosity of the humerus.',
    summaryAr:
      'عضلة مثلثة الشكل تعطي الكتف استدارته المميزة، تنشأ من الترقوة والأخرم وشوكة لوح الكتف وترتكز على الأحدوبة الدالية في عظم العضد.',
    primaryFunctionEn:
      'Primary abductor of the arm beyond 15° (acromial fibers), while anterior fibers flex/medially rotate and posterior fibers extend/laterally rotate the shoulder.',
    primaryFunctionAr:
      'العضلة الأساسية لتبعيد الذراع بعد 15 درجة، فيما تساهم أليافها الأمامية في الثني والخلفية في البسط والتدوير الوحشي.',
    arterialSupply:
      'Posterior circumflex humeral artery & deltoid branch of thoracoacromial artery',
    venousDrainage: 'Posterior circumflex humeral & cephalic veins',
    innervation: 'Axillary nerve (C5–C6) traversing the quadrangular space',
    clinicalNotesEn:
      'Surgical neck humeral fractures or inferior shoulder dislocations endanger the axillary nerve, causing deltoid atrophy, flattened shoulder contour, and anesthesia over the "regimental badge" area.',
    clinicalNotesAr:
      'كسور العنق الجراحي للعضد أو خلع الكتف السفلي قد تصيب العصب الإبطي مما يسبب ضمور العضلة الدالية وفقدان الإحساس على الوجه الوحشي للكتف.',
  },

  'rectus femoris': {
    key: 'rectus femoris',
    cleanNameEn: 'Rectus Femoris',
    cleanNameAr: 'العضلة المستقيمة الفخذية',
    latinName: 'Musculus rectus femoris',
    ta98Code: 'A04.7.02.018',
    fmaId: 'FMA:22431',
    system: 'muscular',
    region: 'Anterior Compartment of Thigh',
    origin: 'Anterior inferior iliac spine (AIIS) & superior acetabular groove of ilium',
    insertion: 'Base of patella and tibial tuberosity via patellar ligament',
    action: 'Extends the leg at the knee joint and flexes the thigh at the hip joint',
    wikiSearchTitleEn: 'Rectus femoris muscle',
    wikiSearchTitleAr: 'عضلة مستقيمة فخذية',
    summaryEn:
      'Superficial bipennate head of the quadriceps femoris and the sole biarticular muscle of the group, originating from the anterior inferior iliac spine (AIIS) and superior acetabular rim to insert via the patellar tendon.',
    summaryAr:
      'الرأس السطحي ثنائي الريش من العضلة رباعية الرؤوس الفخذية، والعضلة الوحيدة فيها التي تعبر مفصلي الورك والركبة، وتنشأ من الشوكة الحرقفية الأمامية السفلية.',
    primaryFunctionEn:
      'Extends the knee joint together with the vastus muscles and flexes the thigh at the hip joint.',
    primaryFunctionAr:
      'بسط مفصل الركبة بالتعاون مع العضلات المتسعة، وثني الفخذ عند مفصل الورك.',
    arterialSupply:
      'Descending & transverse branches of the lateral femoral circumflex artery',
    venousDrainage: 'Lateral femoral circumflex vein -> Profunda femoris / femoral vein',
    innervation: 'Femoral nerve (L2, L3, L4)',
    clinicalNotesEn:
      'Prone to proximal myotendinous strain and AIIS apophyseal avulsion fractures in adolescent sprinters and kicking athletes.',
    clinicalNotesAr:
      'معرضة للتمزق الوتري العضلي القريب أو كسور القلع عند الشوكة الحرقفية الأمامية السفلية لدى الرياضيين.',
  },

  skin: {
    key: 'skin',
    cleanNameEn: 'Skin (Cutis / Epidermis & Dermis)',
    cleanNameAr: 'الجلد (البشرة والأدمة)',
    latinName: 'Cutis (Integumentum commune)',
    ta98Code: 'A16.0.00.001',
    fmaId: 'FMA:7163',
    system: 'integumentary',
    wikiSearchTitleEn: 'Human skin',
    wikiSearchTitleAr: 'جلد',
    summaryEn:
      'The largest organ of the human body by surface area (~1.5–2.0 m²), organized into the stratified squamous keratinized epidermis, collagen/elastin-rich dermis housing appendages, and underlying hypodermis (subcutis).',
    summaryAr:
      'أكبر عضو في جسم الإنسان من حيث المساحة السطحية (1.5–2.0 م² تقريباً)، ويتكون من البشرة الظهارية المطبقة المتقرنة، والأدمة الغنية بالكولاجين والغدد، والنسيج تحت الجلد.',
    primaryFunctionEn:
      'Forms a waterproof antimicrobial barrier against mechanical, thermal, chemical, and UV injury while mediating thermoregulation, tactile sensation, and vitamin D synthesis.',
    primaryFunctionAr:
      'تشكيل حاجز مناعي وميكانيكي ضد الإصابات والعدوى والأشعة فوق البنفسجية، مع تنظيم حرارة الجسم والإحساس اللمسي وتصنيع فيتامين د.',
    arterialSupply:
      'Cutaneous perforating arteries forming deep dermal & subpapillary arterial plexuses',
    venousDrainage: 'Superficial & deep dermal venous plexuses -> Subcutaneous veins',
    innervation:
      'Cutaneous branches of cranial & spinal nerves (Meissner, Pacinian, Ruffini, Merkel & free nerve endings)',
    clinicalNotesEn:
      'Langer cleavage lines dictate surgical incision orientation to minimize scarring; burn depth assessment distinguishes superficial epidermal (1st°), partial-thickness dermal (2nd°), and full-thickness (3rd°) injuries.',
    clinicalNotesAr:
      'تحدد خطوط لانغر الجراحية اتجاه الشقوق لتقليل التندب؛ ويُصنف عمق الحروق سريرياً إلى سطحية وجزئية السماكة وكاملة السماكة.',
  },

  uterus: {
    key: 'uterus',
    cleanNameEn: 'Uterus',
    cleanNameAr: 'الرحم',
    latinName: 'Uterus',
    ta98Code: 'A09.1.03.001',
    fmaId: 'FMA:17558',
    system: 'visceral',
    wikiSearchTitleEn: 'Uterus',
    wikiSearchTitleAr: 'رحم',
    summaryEn:
      'Thick-walled hollow pear-shaped muscular organ located in the female true pelvis between the urinary bladder anteriorly and the rectum posteriorly, comprising the fundus, body, isthmus, and cervix, layered by endometrium, myometrium, and perimetrium.',
    summaryAr:
      'عضو عضلي أجوف كمثري الشكل يقع في الحوض الحقيقي للأنثى بين المثانة أماماً والمستقيم خلفاً، ويتألف من القاع والجسم والبرزخ والعنق وثلاث طبقات (بطانة وعضلية ومصلية).',
    primaryFunctionEn:
      'Receives the fertilized blastocyst for implantation, nourishes and protects the developing embryo and fetus throughout gestation, and contracts forcefully during parturition.',
    primaryFunctionAr:
      'استقبال البويضة الملقحة للانغراس، وحماية وتغذية الجنين طوال فترة الحمل، وتوليد التقلصات العضلية أثناء الولادة.',
    arterialSupply:
      'Uterine arteries (branches of anterior division of internal iliac artery) & anastomoses with ovarian arteries',
    venousDrainage: 'Uterine venous plexus -> Internal iliac veins',
    innervation:
      'Uterovaginal plexus via inferior hypogastric plexus (Sympathetic T12–L2, Parasympathetic S2–S4 pelvic splanchnics)',
    clinicalNotesEn:
      'Critical surgical rule: "Water (ureter) runs under the bridge (uterine artery)" 1.5–2 cm lateral to the cervix during hysterectomy; common pathologies include leiomyomas (fibroids), adenomyosis, and endometriosis.',
    clinicalNotesAr:
      'العلاقة التشريحية الجراحية الأهم هي مرور الحالب أسفل الشريان الرحمي قرب عنق الرحم، وتُعد الأورام الليفية وبطانة الرحم المهاجرة من أبرز أمراضه.',
  },

  ovary: {
    key: 'ovary',
    cleanNameEn: 'Ovary',
    cleanNameAr: 'المبيض',
    latinName: 'Ovarium',
    ta98Code: 'A09.1.01.001',
    fmaId: 'FMA:7209',
    system: 'visceral',
    wikiSearchTitleEn: 'Ovary',
    wikiSearchTitleAr: 'مبيض',
    summaryEn:
      'Paired almond-shaped female gonads suspended within the ovarian fossa of the lateral pelvic wall by the suspensory ligament of ovary (infundibulopelvic), proper ovarian ligament, and mesovarium.',
    summaryAr:
      'غدتان تناسليتان أنثويتان لوزيتا الشكل تقعان في الحفرة المبيضية على الجدار الجانبي للحوض، وترتبطان عبر الرباط المعلق للمبيض والرباط المبيضي المخصوص.',
    primaryFunctionEn:
      'Produces female gametes (oocytes) through cyclical oogenesis/ovulation and secretes steroid hormones estrogen and progesterone.',
    primaryFunctionAr:
      'إنتاج البويضات خلال الإباضة الدورية وإفراز الهرمونات الستيرويدية الأنثوية (الإستروجين والبروجسترون).',
    arterialSupply:
      'Ovarian arteries (direct paired branches of the abdominal aorta below the renal arteries, within the suspensory ligament)',
    venousDrainage:
      'Pampiniform plexus -> Right ovarian vein to IVC; Left ovarian vein to Left renal vein',
    innervation:
      'Ovarian plexus (Sympathetic T10–T11 via lesser splanchnic & aorticorenal ganglia; visceral afferents to T10)',
    clinicalNotesEn:
      'Ovarian torsion compromises the suspensory ligament vessels; high-risk pelvic lymphadenectomy requires safeguarding the ureter near the infundibulopelvic ligament; ovarian neoplasms spread to para-aortic lymph nodes.',
    clinicalNotesAr:
      'انفتال المبيض يقطع ترويته الدموية عبر الرباط المعلق، كما ينتقل التصريف اللمفي للمبيض إلى العقد اللمفية جانب الأبهر.',
  },

  'fallopian tubes': {
    key: 'fallopian tubes',
    cleanNameEn: 'Fallopian Tubes (Uterine Tubes)',
    cleanNameAr: 'قناتا فالوب (البوقان الرحميان)',
    latinName: 'Tuba uterina',
    ta98Code: 'A09.1.02.001',
    fmaId: 'FMA:18245',
    system: 'visceral',
    wikiSearchTitleEn: 'Fallopian tube',
    wikiSearchTitleAr: 'قناة فالوب',
    summaryEn:
      'Paired bilateral fibromuscular conduits (10–12 cm) running within the mesosalpinx of the broad ligament from the uterine cornua to the ovaries, divided into intramural, isthmus, ampulla, and fimbriated infundibulum segments.',
    summaryAr:
      'قناتان عضليتان ليفيتان مزدوجتان (10–12 سم) تمتدان ضمن المساريقا البوقية من قرني الرحم نحو المبيضين، وتتألفان من الجزء الخلالي والبرزخ والأمبولة والقمع ذي الخملات.',
    primaryFunctionEn:
      'Captures the ovulated oocyte via ciliated fimbriae, serves as the physiological site of fertilization (ampulla), and transports the early embryo into the uterine cavity.',
    primaryFunctionAr:
      'التقاط البويضة بعد الإباضة عبر الخملات الهدبية، وتوفير موقع الإخصاب الطبيعي في الأمبولة ونقل الجنين الباكر إلى تجويف الرحم.',
    arterialSupply: 'Tubal branches of the uterine and ovarian arteries within the mesosalpinx',
    venousDrainage: 'Uterine and ovarian venous plexuses',
    innervation: 'Uterovaginal and ovarian autonomic plexuses (T11–L2)',
    clinicalNotesEn:
      'The ampulla is the most common site for both physiological fertilization and ectopic pregnancy; salpingitis from ascending pelvic inflammatory disease risks tubal scarring and infertility.',
    clinicalNotesAr:
      'تُعد الأمبولة الموقع الأكثر شيوعاً للإخصاب الطبيعي وكذلك للحمل المنتبذ (خارج الرحم)، وقد يسبب التهاب البوق انسدادها.',
  },

  'mammary glands': {
    key: 'mammary glands',
    cleanNameEn: 'Mammary Glands',
    cleanNameAr: 'الغدد الثديية',
    latinName: 'Glandula mammaria',
    ta98Code: 'A16.0.02.001',
    fmaId: 'FMA:57991',
    system: 'visceral',
    wikiSearchTitleEn: 'Mammary gland',
    wikiSearchTitleAr: 'غدة ثديية',
    summaryEn:
      'Modified apocrine tubuloalveolar sweat glands embedded in the superficial fascia over the pectoralis major and serratus anterior muscles (ribs 2–6), compartmentalized into 15–20 lactiferous lobes supported by Cooper suspensory ligaments.',
    summaryAr:
      'غدد عرقية محورة عنقودية تقع في اللفافة السطحية أمام العضلة الصدرية الكبيرة (بين الضلعين الثاني والسادس)، وتنقسم إلى 15–20 فصاً لبنياً مدعومة بأربطة كوبر المعلقة.',
    primaryFunctionEn:
      'Synthesizes, secretes, and ejects nutrient-rich and immunoglobulin-rich milk under hormonal regulation (prolactin and oxytocin) to nourish the newborn.',
    primaryFunctionAr:
      'تصنيع وإفراز وضخ الحليب الغني بالمغذيات والأضداد المناعية لتغذية الرضيع تحت تنظيم هرموني (البرولاكتين والأوكسيتوسين).',
    arterialSupply:
      'Internal thoracic artery (medial perforators), lateral thoracic & thoracoacromial arteries (axillary), posterior intercostals',
    venousDrainage: 'Axillary vein, internal thoracic vein & intercostal veins',
    innervation:
      'Anterior and lateral cutaneous branches of intercostal nerves (T2–T6); T4 supplies the nipple-areola complex',
    clinicalNotesEn:
      'More than 75% of lymphatic drainage flows to the axillary lymph nodes (especially pectoral/anterior group), with medial quadrants draining to parasternal (internal thoracic) nodes; dimpling of skin follows invasion of Cooper ligaments.',
    clinicalNotesAr:
      'يتجه أكثر من 75% من التصريف اللمفي نحو العقد الإبطية والباقي نحو العقد جانب القص؛ ويؤدي تليف أربطة كوبر إلى ترصّع الجلد سريرياً.',
  },

  'prostate gland': {
    key: 'prostate gland',
    cleanNameEn: 'Prostate Gland',
    cleanNameAr: 'غدة البروستات (الموثة)',
    latinName: 'Prostata',
    ta98Code: 'A09.3.08.001',
    fmaId: 'FMA:9600',
    system: 'visceral',
    wikiSearchTitleEn: 'Prostate',
    wikiSearchTitleAr: 'بروستاتا',
    summaryEn:
      'Fibromuscular chestnut-sized exocrine gland surrounding the proximal male (prostatic) urethra immediately inferior to the bladder neck and superior to the urogenital diaphragm, traversed by the ejaculatory ducts.',
    summaryAr:
      'غدة ليفية عضلية بحجم حبة الكستناء تقع أسفل عنق المثانة وتحيط بالإحليل البروستاتي لدى الذكر، وتخترقها القناتان القاذفتان.',
    primaryFunctionEn:
      'Secretes slightly alkaline fluid containing citrate, zinc, fibrinolysin, and prostate-specific antigen (PSA) forming ~25–30% of seminal fluid volume to enhance sperm motility.',
    primaryFunctionAr:
      'إفراز سائل قلوي خفيف غني بالسترات والإنزيمات ومستضد البروستات النوعي (PSA) يشكّل نحو 25–30% من السائل المنوي لحماية النطاف وتنشيطها.',
    arterialSupply:
      'Prostatic branches of the inferior vesical artery (from internal iliac artery), middle rectal & internal pudendal arteries',
    venousDrainage:
      'Prostatic venous plexus (Santorini plexus) -> Internal iliac veins (and Batson vertebral venous plexus)',
    innervation:
      'Prostatic plexus from inferior hypogastric plexus (Sympathetic hypogastric T12–L2; Parasympathetic pelvic splanchnics S2–S4)',
    clinicalNotesEn:
      'Benign prostatic hyperplasia (BPH) classically affects the periurethral transition zone causing urinary obstruction, whereas prostate adenocarcinoma arises predominantly in the posterior peripheral zone palpable on digital rectal exam; venous communication with Batson plexus facilitates lumbar bone metastases.',
    clinicalNotesAr:
      'يُصيب تضخم البروستات الحميد المنطقة الانتقالية المحيطة بالإحليل مسبباً أعراضاً بولية، بينما ينشأ السرطان غالباً في المنطقة المحيطية الخلفية، وترتبط شبكته الوريدية بضفيرة باتسون الفقرية.',
  },

  testes: {
    key: 'testes',
    cleanNameEn: 'Testes',
    cleanNameAr: 'الخصيتان',
    latinName: 'Testis',
    ta98Code: 'A09.3.01.001',
    fmaId: 'FMA:7210',
    system: 'visceral',
    wikiSearchTitleEn: 'Testicle',
    wikiSearchTitleAr: 'خصية',
    summaryEn:
      'Paired ovoid male gonads suspended within the scrotal compartment by the spermatic cords, encased in the dense fibrous tunica albuginea and subdivided into lobules containing coiled seminiferous tubules.',
    summaryAr:
      'غدتان تناسليتان بيضويتان معلقتان داخل كيس الصفن بواسطة الحبل المنوي، محاطتان بالغلالة البيضاء وتحتويان على الأنابيب المنوية الملتفة.',
    primaryFunctionEn:
      'Produces male gametes (spermatogenesis via Sertoli-supported tubules) and synthesizes testosterone and dihydrotestosterone precursors (via Leydig interstitial cells).',
    primaryFunctionAr:
      'إنتاج النطاف داخل الأنابيب المنوية وتخليق هرمون التستوستيرون عبر خلايا لايديغ الخلالية.',
    arterialSupply:
      'Testicular arteries (long paired direct branches of the abdominal aorta at L2, traversing the inguinal canal via spermatic cord)',
    venousDrainage:
      'Pampiniform venous plexus -> Right testicular vein to IVC; Left testicular vein to Left renal vein',
    innervation:
      'Testicular autonomic plexus (T10–T11 spinal segments accompanying testicular vessels); scrotal skin by ilioinguinal & genitofemoral nerves',
    clinicalNotesEn:
      'Left varicocele is far more common because the left testicular vein enters the left renal vein at a 90° angle; testicular torsion is a surgical emergency threatening viability within 6 hours; lymphatic drainage ascends directly to para-aortic (lumbar) lymph nodes rather than inguinal nodes.',
    clinicalNotesAr:
      'دوالي الخصية أشيع يساراً بسبب زاوية انصباب الوريد الخصوي الأيسر بالوريد الكلوي؛ ويُعد انفتال الخصية حالة إسعافية جراحية عاجلة، كما يتجه التصريف اللمفي للعقد جانب الأبهر.',
  },

  spleen: {
    key: 'spleen',
    cleanNameEn: 'Spleen (Splen)',
    cleanNameAr: 'الطحال',
    latinName: 'Splen (Lien)',
    ta98Code: 'A13.2.01.001',
    fmaId: 'FMA:7196',
    system: 'visceral',
    wikiSearchTitleEn: 'Spleen',
    wikiSearchTitleAr: 'طحال',
    summaryEn:
      'Soft vascular purple-red lymphoid organ located intraperitoneally in the left upper quadrant (left hypochondrium) beneath ribs 9–11, supported by the gastrosplenic and splenorenal ligaments.',
    summaryAr:
      'أكبر عضو لمفي في الجسم، يقع داخل الصفاق في الربع العلوي الأيسر للبطن تحت الأضلاع (9–11)، وتثبته الأربطة المعدية الطحالية والطحالية الكلوية.',
    primaryFunctionEn:
      'Filters senescent erythrocytes and opsonized encapsulated bacteria from blood (red pulp) while mounting adaptive T- and B-cell immune responses (white pulp) and storing platelets.',
    primaryFunctionAr:
      'تصفية الدم من كريات الدم الحمراء الهرمة والبكتيريا المحفظية (اللب الأحمر) وتنشيط الاستجابة المناعية الخلوية والخلطية (اللب الأبيض).',
    arterialSupply:
      'Splenic artery (tortuous largest branch of the celiac trunk running along the superior border of the pancreas)',
    venousDrainage: 'Splenic vein -> Joins superior mesenteric vein -> Hepatic portal vein',
    innervation: 'Celiac autonomic plexus (predominantly sympathetic fibers along splenic artery)',
    clinicalNotesEn:
      'Protected by ribs 9–11, making fractures of the left lower ribs the classic cause of splenic laceration and subcapsular hemorrhage (Kehr sign: referred left shoulder pain from diaphragmatic irritation via phrenic C3–C5); asplenic patients require vaccination against encapsulated organisms (SHiN).',
    clinicalNotesAr:
      'كسور الأضلاع السفلية اليسرى قد تسبب تمزق الطحال ونزفاً بطنياً مع ألم رجيع بالكتف الأيسر (علامة كير)، كما يتطلب استئصال الطحال تمنيعاً ضد البكتيريا المحفظية.',
  },

  pancreas: {
    key: 'pancreas',
    cleanNameEn: 'Pancreas',
    cleanNameAr: 'البنكرياس (المعثكلة)',
    latinName: 'Pancreas',
    ta98Code: 'A05.9.01.001',
    fmaId: 'FMA:7198',
    system: 'visceral',
    wikiSearchTitleEn: 'Pancreas',
    wikiSearchTitleAr: 'بنكرياس',
    summaryEn:
      'Elongated lobulated retroperitoneal (except tail) dual exocrine-endocrine gland stretching obliquely across L1–L2 from the duodenal C-loop (head and uncinate process) across the neck and body to the splenic hilum.',
    summaryAr:
      'غدة صماء وخارجية الإفراز تقع خلف الصفاق (باستثناء الذيل) بمستوى الفقرتين القطنيتين L1–L2، وتمتد من عروة الاثني عشر (الرأس والنتوء الشصي) حتى سرة الطحال.',
    primaryFunctionEn:
      'Exocrine acini secrete digestive enzymes (amylase, lipase, trypsinogen) and bicarbonate into the duodenum via the main duct of Wirsung; endocrine islets of Langerhans secrete insulin, glucagon, and somatostatin.',
    primaryFunctionAr:
      'إفراز الإنزيمات الهاضمة والبيكربونات عبر القناة البنكرياسية للاثني عشر، وإفراز هرمونات الأنسولين والغلوكاغون لتنظيم سكر الدم عبر جزر لانغرهانس.',
    arterialSupply:
      'Superior & inferior pancreaticoduodenal arcades (head) + dorsal pancreatic & great pancreatic branches of splenic artery (body/tail)',
    venousDrainage: 'Splenic vein & superior mesenteric vein -> Hepatic portal vein',
    innervation: 'Celiac & superior mesenteric autonomic plexuses (Vagus CN X & greater/lesser splanchnics)',
    clinicalNotesEn:
      'The uncinate process hooks behind the superior mesenteric vessels; pancreatic head masses compress the common bile duct causing painless obstructive jaundice (Courvoisier sign), while acute pancreatitis erodes retroperitoneal planes radiating epigastric pain to the back.',
    clinicalNotesAr:
      'أورام رأس البنكرياس قد تضغط القناة الصفراوية المشتركة مسببةً يرقاناً انسدادياً غير مؤلم، كما يمتاز التهاب البنكرياس الحاد بألم شرسوفي يمتد إلى الظهر.',
  },

  'small intestine': {
    key: 'small intestine',
    cleanNameEn: 'Small Intestine',
    cleanNameAr: 'الأمعاء الدقيقة',
    latinName: 'Intestinum tenue',
    ta98Code: 'A05.6.01.001',
    fmaId: 'FMA:7200',
    system: 'visceral',
    wikiSearchTitleEn: 'Small intestine',
    wikiSearchTitleAr: 'أمعاء دقيقة',
    summaryEn:
      'Convoluted 6-meter gastrointestinal conduit divided into the mostly retroperitoneal C-shaped duodenum (25 cm) and the intraperitoneal jejunum (40%) and ileum (60%) suspended by the fan-shaped mesentery proper.',
    summaryAr:
      'أنبوب هضمي ملتف بطول نحو 6 أمتار يتكون من الاثني عشر (25 سم، خلف الصفاق غالباً)، والصائم واللفائفي داخل الصفاق معلقين بمساريقا الأمعاء.',
    primaryFunctionEn:
      'Performs ~90% of chemical digestion (brush-border enzymes) and nutrient, electrolyte, vitamin B12 (terminal ileum), bile salt, and water absorption across plicae circulares and villi.',
    primaryFunctionAr:
      'استكمال الهضم الإنزيمي وامتصاص نحو 90% من المغذيات والشوارد والماء وفيتامين B12 والأملاح الصفراوية عبر الخملات والزغابات المعوية.',
    arterialSupply:
      'Gastroduodenal/pancreaticoduodenal branches (proximal duodenum); Superior mesenteric artery (SMA) jejunal & ileal arcades (midgut)',
    venousDrainage: 'Superior mesenteric vein (SMV) -> Hepatic portal vein',
    innervation:
      'Enteric nervous system (Auerbach myenteric & Meissner submucosal plexuses) modulated by SMA autonomic plexus (Vagus CN X & T9–T11)',
    clinicalNotesEn:
      'Jejunum exhibits thicker walls, prominent plicae circulares, longer vasa recta, and fewer arterial arcades compared to the ileum; Meckel diverticulum (rule of 2s) persists in the distal ileum ~60 cm from the ileocecal valve.',
    clinicalNotesAr:
      'يتميز الصائم بجدران أسمك وأوعية مستقيمة أطول مقارنة باللفائفي الذي يضم لطخات باير ويمتص فيتامين B12 والأملاح الصفراوية، كما قد يوجد رتج ميكل في الجزء البعيد من اللفائفي.',
  },

  'large intestine colon': {
    key: 'large intestine colon',
    cleanNameEn: 'Large Intestine (Colon & Cecum)',
    cleanNameAr: 'الأمعاء الغليظة (القولون والأعور)',
    latinName: 'Intestinum crassum',
    ta98Code: 'A05.7.01.001',
    fmaId: 'FMA:7201',
    system: 'visceral',
    wikiSearchTitleEn: 'Large intestine',
    wikiSearchTitleAr: 'أمعاء غليظة',
    summaryEn:
      'Terminal 1.5-meter horseshoe-shaped digestive tract consisting of the cecum and vermiform appendix, ascending, transverse, descending, and sigmoid colon, rectum, and anal canal, marked by taeniae coli, haustra, and epiploic appendages.',
    summaryAr:
      'الجزء الأخير من القناة الهضمية بطول 1.5 متر، ويشمل الأعور والزائدة الدودية والقولون الصاعد والمستعرض والنازل والسيني والمستقيم، ويتميز بالأشرطة القولونية والقباب والزوائد الثربية.',
    primaryFunctionEn:
      'Reabsorbs remaining water and electrolytes to consolidate solid stool, hosts commensal microbiota synthesizing vitamin K and short-chain fatty acids, and stores feces until defecation.',
    primaryFunctionAr:
      'إعادة امتصاص الماء والشوارد لتشكيل البراز، واحتضان النبيت الجرثومي المفيد المنتج لفيتامين K، وتخزين الفضلات.',
    arterialSupply:
      'Superior mesenteric artery (ileocolic, right & middle colic to distal transverse) & Inferior mesenteric artery (left colic, sigmoid, superior rectal); Marginal artery of Drummond',
    venousDrainage:
      'Superior mesenteric vein & Inferior mesenteric vein -> Splenic -> Hepatic portal vein',
    innervation:
      'Vagus CN X (to splenic flexure) & Pelvic splanchnic S2–S4 parasympathetic; Lesser/lumbar splanchnic sympathetic',
    clinicalNotesEn:
      'The splenic flexure (Griffith point) and rectosigmoid junction (Sudeck critical point) are classic watershed zones vulnerable to ischemic colitis during systemic hypotension.',
    clinicalNotesAr:
      'تُعد الزاوية الطحالية (نقطة غريفيث) والوصل السيني المستقيمي مناطق مستجمع وعائي (Watershed) عرضةً لالتهاب القولون الإقفاري عند هبوط الضغط.',
  },

  'urinary bladder': {
    key: 'urinary bladder',
    cleanNameEn: 'Urinary Bladder',
    cleanNameAr: 'المثانة البولية',
    latinName: 'Vesica urinaria',
    ta98Code: 'A08.3.01.001',
    fmaId: 'FMA:15900',
    system: 'visceral',
    wikiSearchTitleEn: 'Urinary bladder',
    wikiSearchTitleAr: 'مثانة',
    summaryEn:
      'Subperitoneal distensible hollow muscular reservoir lined by transitional urothelium and thick detrusor smooth muscle, anchored posteriorly to the pubic symphysis by the median umbilical ligament and featuring the smooth internal trigone.',
    summaryAr:
      'خزان عضلي أجوف مرن يقع أسفل الصفاق خلف الارتفاق العاني، مبطن بظهارة انتقالية ومحاط بعضلة الدافعة (Detrusor)، ويحتوي على المثلث المثاني في قاعدته.',
    primaryFunctionEn:
      'Stores urine continuously delivered by the bilateral ureters at low intravesical pressure (~400–600 mL) and contracts coordinatedly during micturition to expel urine through the urethra.',
    primaryFunctionAr:
      'تخزين البول الوارد من الحالبين بضغط منخفض وتفريغه بشكل متناسق عبر الإحليل أثناء التبول.',
    arterialSupply:
      'Superior vesical arteries (from umbilical branch of internal iliac) & Inferior vesical / vaginal arteries',
    venousDrainage: 'Vesical venous plexus -> Internal iliac veins',
    innervation:
      'Parasympathetic pelvic splanchnics (S2–S4) trigger detrusor contraction; Sympathetic hypogastric (T11–L2) mediate detrusor relaxation & bladder neck closure; Pudendal (S2–S4) controls external sphincter',
    clinicalNotesEn:
      'When distended, the superior dome rises above the pubic symphysis extraperitoneally, permitting safe suprapubic catheterization without entering the peritoneal cavity; pelvic fractures risk extraperitoneal bladder rupture.',
    clinicalNotesAr:
      'عند امتلاء المثانة ترتفع قبتها فوق الارتفاق العاني خارج الصفاق مما يسمح بالقسطرة فوق العانة بأمان؛ وترتبط كسور الحوض بتمزق المثانة خارج الصفاق.',
  },

  'thyroid gland': {
    key: 'thyroid gland',
    cleanNameEn: 'Thyroid Gland',
    cleanNameAr: 'الغدة الدرقية',
    latinName: 'Glandula thyroidea',
    ta98Code: 'A11.3.00.001',
    fmaId: 'FMA:9603',
    system: 'visceral',
    wikiSearchTitleEn: 'Thyroid',
    wikiSearchTitleAr: 'غدة درقية',
    summaryEn:
      'Butterfly-shaped bilobed endocrine gland wrapped around the anterior and lateral surfaces of the C5–T1 trachea (tracheal rings 2–4) inside the pretracheal fascia, with right and left lobes bridged by a central isthmus.',
    summaryAr:
      'غدة صماء بشكل الفراشة تقع في العنق أمام وعلى جانبي الرغامى (بمستوى C5–T1) داخل اللفافة أمام الرغامى، وتتألف من فصين يصل بينهما برزخ.',
    primaryFunctionEn:
      'Synthesizes triiodothyronine (T3) and thyroxine (T4) to regulate basal metabolic rate and growth, and secretes calcitonin via parafollicular C cells for calcium homeostasis.',
    primaryFunctionAr:
      'تصنيع وإفراز هرموني الثيروكسين (T4) وثلاثي يود الثيرونين (T3) لتنظيم الاستقلاب الأساسي، وإفراز الكالسيتونين لخفض كالسيوم الدم.',
    arterialSupply:
      'Superior thyroid artery (first anterior branch of external carotid artery) & Inferior thyroid artery (branch of thyrocervical trunk from subclavian artery), plus occasional thyroid ima artery',
    venousDrainage:
      'Superior & middle thyroid veins -> Internal jugular vein; Inferior thyroid veins -> Left brachiocephalic vein',
    innervation:
      'Autonomic vasomotor innervation from superior, middle & inferior cervical sympathetic ganglia',
    clinicalNotesEn:
      'The superior thyroid artery runs alongside the external branch of the superior laryngeal nerve, while the inferior thyroid artery crosses near the recurrent laryngeal nerve—both are critical surgical hazards during thyroidectomy.',
    clinicalNotesAr:
      'يُعد العصب الحنجري الراجع والفرع الخارجي للعصب الحنجري العلوي ومجاورة الغدد جارات الدرقية أهم المعالم الواجب حمايتها أثناء استئصال الغدة الدرقية.',
  },

  diaphragm: {
    key: 'diaphragm',
    cleanNameEn: 'Thoracic Diaphragm',
    cleanNameAr: 'الحجاب الحاجز',
    latinName: 'Diaphragma',
    ta98Code: 'A04.4.02.001',
    fmaId: 'FMA:13295',
    system: 'visceral',
    wikiSearchTitleEn: 'Thoracic diaphragm',
    wikiSearchTitleAr: 'حجاب حاجز',
    summaryEn:
      'Dome-shaped fibromuscular partition separating the thoracic and abdominal cavities, originating from the xiphoid process, lower six costal cartilages, and L1–L3 lumbar crura to converge onto a trefoil central tendon.',
    summaryAr:
      'حاجز عضلي وتري مقبب يفصل التجويف الصدري عن التجويف البطني، وينشأ من الناتئ الخنجري والأضلاع الستة السفلية والفقرات القطنية (L1–L3) ليرتكز في الوتر المركزي.',
    primaryFunctionEn:
      'Serves as the primary muscle of inspiration: upon contraction, its dome descends to expand vertical thoracic volume and draw air into the lungs while generating an abdominopelvic pressure gradient.',
    primaryFunctionAr:
      'العضلة التنفسية الرئيسية للشهيق؛ فعند انقباضه يهبط نحو البطن ليزيد حجم التجويف الصدري ويسحب الهواء للرئتين.',
    arterialSupply:
      'Pericardiacophrenic & musculophrenic arteries (internal thoracic) and inferior phrenic arteries (abdominal aorta)',
    venousDrainage: 'Phrenic veins -> Inferior vena cava & internal thoracic veins',
    innervation: 'Phrenic nerves (C3, C4, C5 — "C3, 4, 5 keeps the diaphragm alive")',
    clinicalNotesEn:
      'Three major caval/visceral apertures penetrate it at key vertebral levels: IVC hiatus at T8, esophageal hiatus (+ vagal trunks) at T10, and aortic hiatus (+ thoracic duct & azygos vein) at T12.',
    clinicalNotesAr:
      'يعبره الوريد الأجوف السفلي بمستوى T8، والمريء والعصبان المبهمان عند T10، والأبهر والقناة الصدرية عند T12.',
  },

  humerus: {
    key: 'humerus',
    cleanNameEn: 'Humerus',
    cleanNameAr: 'عظم العضد',
    latinName: 'Humerus',
    ta98Code: 'A02.4.04.001',
    fmaId: 'FMA:13303',
    system: 'skeletal',
    wikiSearchTitleEn: 'Humerus',
    wikiSearchTitleAr: 'عضد',
    summaryEn:
      'The single long bone of the arm articulating proximally with the glenoid cavity of the scapula (shoulder joint) and distally with the radius and ulna via the capitulum and trochlea (elbow joint).',
    summaryAr:
      'أطول وأكبر عظم في الطرف العلوي، يتمفصل في الأعلى مع التجويف الحقاني للوح الكتف، وفي الأسفل مع الكعبرة والزند لتشكيل مفصل المرفق.',
    primaryFunctionEn:
      'Provides the rigid lever arm for upper-limb elevation, circumduction, and elbow flexion/extension while anchoring the rotator cuff, deltoid, and brachial musculature.',
    primaryFunctionAr:
      'توفير الدعامة والذراع الرافعة لحركات الكتف والمرفق وتأمين مرتكزات عضلات الكفة المدورة والعضد.',
    arterialSupply:
      'Profunda brachii nutrient artery, anterior & posterior circumflex humeral arteries',
    venousDrainage: 'Brachial & circumflex humeral veins',
    innervation: 'Periosteal sensory fibers from axillary, radial & musculocutaneous nerves',
    clinicalNotesEn:
      'Three classic fracture sites endanger distinct nerves: surgical neck -> Axillary nerve; midshaft (spiral groove) -> Radial nerve (wrist drop); supracondylar/medial epicondyle -> Median/Ulnar nerves and brachial artery.',
    clinicalNotesAr:
      'ترتبط كسور العضد بإصابات عصبية نوعية: العنق الجراحي (العصب الإبطي)، منتصف الجسم بالثلم الحلزوني (العصب الكعبري وهبوط الرسغ)، اللقيمة الإنسية (العصب الزندي).',
  },

  'tibia fibula': {
    key: 'tibia fibula',
    cleanNameEn: 'Tibia & Fibula',
    cleanNameAr: 'عظما الظنبوب والشظية',
    latinName: 'Tibia et fibula',
    ta98Code: 'A02.5.06.001',
    fmaId: 'FMA:24476',
    system: 'skeletal',
    wikiSearchTitleEn: 'Tibia',
    wikiSearchTitleAr: 'ظنبوب',
    summaryEn:
      'Paired long bones of the anatomical leg: the thick weight-bearing medial tibia articulating with the femoral condyles and talus, paired laterally with the slender fibula connected via an interosseous membrane.',
    summaryAr:
      'عظما الساق الرئيسيان: الظنبوب الإنسي السميك الحامل لوزن الجسم، والشظية الوحشية الرفيعة المرتبطة به عبر الغشاء بين العظمين والمشكّلة للكعب الوحشي.',
    primaryFunctionEn:
      'Transfers axial body weight from the knee to the ankle mortise and talus while giving origin to the anterior, lateral, and posterior crural muscle compartments.',
    primaryFunctionAr:
      'نقل وزن الجسم من مفصل الركبة إلى عظم القعب ومفصل الكاحل وتثبيت عضلات الساق.',
    arterialSupply:
      'Posterior tibial nutrient artery (largest nutrient artery in the body) & fibular/anterior tibial periosteal arcades',
    venousDrainage: 'Posterior/anterior tibial & fibular venae comitantes -> Popliteal vein',
    innervation: 'Tibial, deep fibular & superficial fibular periosteal branches',
    clinicalNotesEn:
      'Fibular neck fractures risk injury to the common fibular (peroneal) nerve causing foot drop; distal third tibial shaft fractures have poor blood supply predisposing to nonunion and acute compartment syndrome.',
    clinicalNotesAr:
      'كسور عنق الشظية قد تصيب العصب الشظوي المشترك مسببةً هبوط القدم، كما تشتهر كسور الظنبوب بخطر متلازمة الحيز الساقية.',
  },

  'biceps brachii': {
    key: 'biceps brachii',
    cleanNameEn: 'Biceps Brachii',
    cleanNameAr: 'العضلة ذات الرأسين العضدية',
    latinName: 'Musculus biceps brachii',
    ta98Code: 'A04.6.02.013',
    fmaId: 'FMA:37670',
    system: 'muscular',
    wikiSearchTitleEn: 'Biceps',
    wikiSearchTitleAr: 'عضلة ذات رأسين عضدية',
    summaryEn:
      'Prominent two-headed anterior arm flexor comprising a long head (originating at the supraglenoid tubercle) and a short head (coracoid process) converging to insert on the radial tuberosity and bicipital aponeurosis.',
    summaryAr:
      'العضلة السطحية البارزة في المسكن الأمامي للعضد، وتتكون من رأس طويل (من فوق الجوف الحقاني) ورأس قصير (من الناتئ الغرابي) يرتكزان على الأحدوبة الكعبرية والصفاق ذاتي الرأسين.',
    primaryFunctionEn:
      'Powerful supinator of the flexed forearm, strong elbow flexor, and weak flexor/stabilizer of the glenohumeral shoulder joint.',
    primaryFunctionAr:
      'الاستلقاء القوي للساعد عند ثني المرفق، وثني مفصل المرفق، والمساعدة في ثني الكتف وتثبيت رأس العضد.',
    arterialSupply: 'Muscular branches of the brachial artery',
    venousDrainage: 'Brachial venae comitantes & cephalic/basilic venous tributaries',
    innervation: 'Musculocutaneous nerve (C5–C6), continuing distally as lateral cutaneous nerve of forearm',
    clinicalNotesEn:
      'Tests the C5–C6 myotome via the biceps deep tendon reflex; proximal rupture of the long head tendon within the bicipital groove produces the classic "Popeye" bulge in the distal arm.',
    clinicalNotesAr:
      'يُختبر بها المنعكس الوتري للفقرتين C5–C6، ويؤدي تمزق وتر الرأس الطويل القريب إلى تكتل عضلي بارز أسفل العضد.',
  },

  'rectus abdominis': {
    key: 'rectus abdominis',
    cleanNameEn: 'Rectus Abdominis',
    cleanNameAr: 'العضلة المستقيمة البطنية',
    latinName: 'Musculus rectus abdominis',
    ta98Code: 'A04.5.01.001',
    fmaId: 'FMA:9628',
    system: 'muscular',
    wikiSearchTitleEn: 'Rectus abdominis muscle',
    wikiSearchTitleAr: 'عضلة مستقيمة بطنية',
    summaryEn:
      'Paired strap-like vertical anterior abdominal wall muscles running from the pubic crest and symphysis to costal cartilages 5–7 and the xiphoid process, separated at the midline by the linea alba and segmented by three tendinous intersections.',
    summaryAr:
      'عضلتان شريطيتان عموديتان على جانبي الخط الأبيض في جدار البطن الأمامي، تمتدان من العانة حتى الغضاريف الضلعية (5–7) والناتئ الخنجري، وتقسّمهما تقاطعات وترية عرضية.',
    primaryFunctionEn:
      'Flexes the thoracolumbar vertebral column, stabilizes pelvic tilt against the lumbar extensors, and compresses abdominal viscera during forced expiration and Valsalva maneuvers.',
    primaryFunctionAr:
      'ثني الجذع والعمود الفقري الصدري القطني، وتثبيت الحوض، وضغط الأحشاء البطنية أثناء الزفير القسري.',
    arterialSupply:
      'Superior epigastric artery (internal thoracic) & Inferior epigastric artery (external iliac) anastomosing within rectus sheath',
    venousDrainage: 'Superior & inferior epigastric veins',
    innervation: 'Thoracoabdominal nerves (anterior rami of T7–T11) & subcostal nerve (T12)',
    clinicalNotesEn:
      'Below the arcuate line (semicircular line of Douglas), all three lateral flat-muscle aponeuroses pass anterior to rectus abdominis leaving only transversalis fascia posteriorly; the inferior epigastric vessels enter here and lie directly medial to the deep inguinal ring.',
    clinicalNotesAr:
      'أسفل الخط المقوس تغيب الورقة الخلفية لغمد المستقيمة، ويسير الشريان الشرسوفي السفلي خلف العضلة في موقع مهم جراحياً قرب الحلقة الأربية العميقة.',
  },

  'vagus nerve': {
    key: 'vagus nerve',
    cleanNameEn: 'Vagus Nerve (CN X)',
    cleanNameAr: 'العصب المبهم (العصب القحفي العاشر)',
    latinName: 'Nervus vagus (CN X)',
    ta98Code: 'A14.2.01.153',
    fmaId: 'FMA:5731',
    system: 'nervous',
    wikiSearchTitleEn: 'Vagus nerve',
    wikiSearchTitleAr: 'عصب مبهم',
    summaryEn:
      'The longest and most widely distributed cranial nerve (CN X), emerging from the postolivary sulcus of the medulla, exiting via the jugular foramen, descending inside the carotid sheath, and branching across thorax and abdomen to the splenic flexure.',
    summaryAr:
      'أطول الأعصاب القحفية وأوسعها انتشاراً (CN X)، يخرج من النخاع المستطيل عبر الثقبة الوداجية، وينزل داخل الغمد السباتي معطياً تفرعات حنجرية وقلبية ورئوية وهضمية.',
    primaryFunctionEn:
      'Provides ~75% of all parasympathetic outflow (slowing heart rate, stimulating GI peristalsis/gastric acid), innervates pharyngeal/laryngeal phonation muscles, and conveys baroreceptor/chemoreceptor & visceral afferents.',
    primaryFunctionAr:
      'تأمين نحو 75% من التعصيب اللاودي في الجسم لتنظيم نبض القلب والتنفس وحركة المعدة والأمعاء، مع تعصيب عضلات الحنجرة والبلعوم.',
    arterialSupply:
      'Vasa nervorum from posterior inferior cerebellar, ascending pharyngeal, internal carotid & bronchial/esophageal arteries',
    venousDrainage: 'Internal jugular, azygos & portal-associated neural venous channels',
    innervation:
      'Medullary nuclei: Nucleus ambiguus (branchial motor), Dorsal motor nucleus of vagus (parasympathetic), Nucleus tractus solitarius (visceral sensory/taste)',
    clinicalNotesEn:
      'Lesions cause palatal droop with uvular deviation AWAY from the affected side, dysphagia, and hoarseness; the left recurrent laryngeal nerve loops beneath the aortic arch whereas the right loops under the right subclavian artery.',
    clinicalNotesAr:
      'إصابته تؤدي لبحة الصوت وانحراف اللهاة بعيداً عن الجهة المصابة، ويلتف العصب الحنجري الراجع الأيسر حول قوس الأبهر بينما يلتف الأيمن حول الشريان تحت الترقوة الأيمن.',
  },
  pons: {
    key: 'pons',
    cleanNameEn: 'Pons',
    cleanNameAr: 'الجسر (القنطرة الدماغية)',
    latinName: 'Pons (Metencephalon)',
    ta98Code: 'A14.1.05.001',
    fmaId: 'FMA:67943',
    system: 'nervous',
    wikiSearchTitleEn: 'Pons',
    wikiSearchTitleAr: 'جسر (تشريح)',
    summaryEn:
      'The prominent anterior bulge of the brainstem situated between the midbrain superiorly and the medulla oblongata inferiorly, housing pontine relay nuclei (basilar pons) and cranial nerve nuclei V–VIII.',
    summaryAr:
      'الجزء الأوسط من جذع الدماغ يقع بين الدماغ المتوسط في الأعلى والنخاع المستطيل في الأسفل، ويضم نوى الجسر القاعدية وأنوية الأعصاب القحفية من الخامس إلى الثامن.',
    primaryFunctionEn:
      'Relays cortico-ponto-cerebellar motor signals via the middle cerebellar peduncles and regulates respiratory rhythm (pneumotaxic/apneustic centers), sleep-wake cycles, and facial sensation/movement.',
    primaryFunctionAr:
      'نقل الإشارات الحركية بين قشرة المخ والمخيخ وتنظيم إيقاع التنفس ودورة النوم واليقظة وحس وحركة الوجه.',
    arterialSupply: 'Pontine perforating branches of the basilar artery',
    venousDrainage: 'Pontine venous plexus -> Superior & inferior petrosal sinuses',
    innervation:
      'Houses motor & sensory nuclei of CN V (trigeminal), CN VI (abducens), CN VII (facial) & CN VIII (vestibulocochlear)',
    clinicalNotesEn:
      'Basilar artery occlusion affecting the ventral (basilar) pons produces locked-in syndrome—quadriplegia with preserved vertical eye movements and consciousness.',
    clinicalNotesAr:
      'انسداد الشريان القاعدي المغذي للجزء القاعدي من الجسر يسبب متلازمة المنحبس حيث يبقى الوعي وحركة العين العمودية محفوظين مع شلل رباعي.',
  },
  'medulla oblongata': {
    key: 'medulla oblongata',
    cleanNameEn: 'Medulla Oblongata',
    cleanNameAr: 'النخاع المستطيل (البصلة السيسائية)',
    latinName: 'Medulla oblongata',
    ta98Code: 'A14.1.04.001',
    fmaId: 'FMA:62004',
    system: 'nervous',
    wikiSearchTitleEn: 'Medulla oblongata',
    wikiSearchTitleAr: 'نخاع مستطيل',
    summaryEn:
      'The caudal-most cone-shaped segment of the brainstem continuous inferiorly with the cervical spinal cord at the foramen magnum, containing the pyramids and olivary bodies.',
    summaryAr:
      'الجزء السفلي المخروطي من جذع الدماغ المتصل بالحبل الشوكي عند الثقبة العظمى، ويحتوي على الأهرامات والأجسام الزيتونية والمراكز الحيوية.',
    primaryFunctionEn:
      'Controls vital autonomic homeostatic reflexes including cardiovascular vasomotor tone, heart rate, respiratory drive, swallowing, coughing, and vomiting.',
    primaryFunctionAr:
      'التحكم في الوظائف الحيوية اللاإرادية الأساسية مثل معدل ضربات القلب وضغط الدم والتنفس والبلع والسعال.',
    arterialSupply:
      'Vertebral, anterior spinal & posterior inferior cerebellar arteries (PICA)',
    venousDrainage: 'Medullary veins -> Occipital & marginal dural sinuses',
    innervation: 'Cranial nerve nuclei IX (glossopharyngeal), X (vagus), XI & XII (hypoglossal)',
    clinicalNotesEn:
      'Lateral medullary (Wallenberg) syndrome following PICA infarction presents with ipsilateral Horner syndrome, dysphagia, vertigo, and crossed pain/temperature loss.',
    clinicalNotesAr:
      'الاحتشاء الجانبي للبصلة (متلازمة والنبرغ) يسبب دواراً وعسرة بلع وفقدان حس الألم والحرارة المتصالب.',
  },
  midbrain: {
    key: 'midbrain',
    cleanNameEn: 'Midbrain (Mesencephalon)',
    cleanNameAr: 'الدماغ المتوسط',
    latinName: 'Mesencephalon',
    ta98Code: 'A14.1.06.001',
    fmaId: 'FMA:61993',
    system: 'nervous',
    wikiSearchTitleEn: 'Midbrain',
    wikiSearchTitleAr: 'دماغ متوسط',
    summaryEn:
      'The superior division of the brainstem bridging the diencephalon and pons around the cerebral aqueduct, comprising cerebral peduncles, substantia nigra, red nucleus, and tectal colliculi.',
    summaryAr:
      'القسم العلوي من جذع الدماغ المحيط بالمسال الدماغي، ويضم السويقتين المخيتين والمادة السوداء والنواة الحمراء والأكيمات التوأمية.',
    primaryFunctionEn:
      'Coordinates visual/auditory orienting reflexes (superior/inferior colliculi), ocular motility (CN III, CN IV), consciousness arousal, and dopaminergic motor modulation.',
    primaryFunctionAr:
      'تنسيق المنعكسات البصرية والسمعية وحركة العين واليقظة وتنظيم الحركة عبر الدوبامين من المادة السوداء.',
    arterialSupply: 'Posterior cerebral, basilar tip & superior cerebellar perforators',
    venousDrainage: 'Basal vein of Rosenthal -> Great cerebral vein of Galen',
    innervation: 'Trochlear (CN IV) & Oculomotor (CN III) nuclei',
    clinicalNotesEn:
      'Degeneration of dopaminergic neurons in the substantia nigra pars compacta underlies the cardinal motor features of Parkinson disease.',
    clinicalNotesAr:
      'تنكس الخلايا الدوبامينية في المادة السوداء بالدماغ المتوسط هو الآلية الرئيسية لمرض باركنسون.',
  },
  thalamus: {
    key: 'thalamus',
    cleanNameEn: 'Thalamus',
    cleanNameAr: 'المهاد (التلاموس)',
    latinName: 'Thalamus',
    ta98Code: 'A14.1.08.101',
    fmaId: 'FMA:62007',
    system: 'nervous',
    wikiSearchTitleEn: 'Thalamus',
    wikiSearchTitleAr: 'مهاد',
    summaryEn:
      'Paired egg-shaped grey matter nuclear complexes flanking the third ventricle within the diencephalon, serving as the brain’s primary sensory and motor relay hub.',
    summaryAr:
      'تجمعان متناظران من المادة الرمادية على جانبي البطين الثالث في الدماغ البيني، يمثلان المحطة الرئيسية لترحيل المعلومات الحسية والحركية إلى القشرة.',
    primaryFunctionEn:
      'Filters and relays somatosensory (VPL/VPM), visual (LGN), auditory (MGN), and extrapyramidal motor information to specific cortical areas while regulating consciousness.',
    primaryFunctionAr:
      'تنقية ونقل جميع الإشارات الحسية (عدا الشم) والحركية إلى القشرة المخية مع تنظيم حالة الوعي والنوم.',
    arterialSupply: 'Posterior communicating & posterior cerebral thalamoperforating arteries',
    venousDrainage: 'Internal cerebral veins -> Vein of Galen',
    innervation: 'Reticular activating & reciprocal thalamocortical projections',
    clinicalNotesEn:
      'Thalamic lacunar infarcts can produce contralateral hemisensory loss followed weeks later by refractory central post-stroke thalamic pain (Dejerine–Roussy syndrome).',
    clinicalNotesAr:
      'احتشاءات المهاد قد تسبب فقداناً حسياً نصفياً يعقبه ألم مركزي شديد يُعرف بمتلازمة ديجيرين-روسي.',
  },
  hippocampus: {
    key: 'hippocampus',
    cleanNameEn: 'Hippocampus',
    cleanNameAr: 'الحُصَين (قرن آمون)',
    latinName: 'Hippocampus',
    ta98Code: 'A14.1.09.321',
    fmaId: 'FMA:275020',
    system: 'nervous',
    wikiSearchTitleEn: 'Hippocampus',
    wikiSearchTitleAr: 'حصين (دماغ)',
    summaryEn:
      'Curved seahorse-shaped allocortical ridge in the medial temporal lobe forming part of the limbic system and projecting via the fimbria–fornix circuit.',
    summaryAr:
      'بنية دماغية مقوسة في الفص الصدغي الإنسي تشكل محوراً رئيسياً في الجهاز الحوفي وترتبط ببقية الدماغ عبر القبو الدماغي.',
    primaryFunctionEn:
      'Consolidates short-term declarative (episodic and semantic) memories into long-term neocortical storage and constructs spatial cognitive maps.',
    primaryFunctionAr:
      'تحويل الذاكرة قصيرة الأمد إلى ذاكرة طويلة الأمد وتكوين الخرائط المكانية للملاحة والتذكر.',
    arterialSupply: 'Anterior choroidal & hippocampal branches of posterior cerebral artery',
    venousDrainage: 'Basal vein of Rosenthal',
    innervation: 'Cholinergic basal forebrain (septal) & entorhinal perforant pathways',
    clinicalNotesEn:
      'Among the earliest regions demonstrating atrophy in Alzheimer disease and highly susceptible to hypoxic injury and mesial temporal lobe epilepsy sclerosis.',
    clinicalNotesAr:
      'من أوائل المناطق المتأثرة في داء ألزهايمر، كما يرتبط تصلب الحصين بصرع الفص الصدغي الإنسي ونقص الأكسجة الدماغي.',
  },
  amygdala: {
    key: 'amygdala',
    cleanNameEn: 'Amygdala',
    cleanNameAr: 'اللوزة الدماغية',
    latinName: 'Corpus amygdaloideum',
    ta98Code: 'A14.1.09.402',
    fmaId: 'FMA:61841',
    system: 'nervous',
    wikiSearchTitleEn: 'Amygdala',
    wikiSearchTitleAr: 'لوزة دماغية',
    summaryEn:
      'Almond-shaped group of nuclei deep in the anteromedial temporal lobe anterior to the hippocampus, connected to the hypothalamus and prefrontal cortex.',
    summaryAr:
      'مجموعة نوى عصبية لوزية الشكل تقع في الفص الصدغي الأمامي الإنسي أمام الحصين مباشرة، وتتصل بالوطاء والقشرة الجبهية.',
    primaryFunctionEn:
      'Processes threat detection, fear conditioning, emotional salience tagging of memories, and autonomic fight-or-flight responses.',
    primaryFunctionAr:
      'معالجة المشاعر والانفعالات ولا سيما الخوف وتقييم التهديدات وربط الذاكرة بالاستجابات الانفعالية.',
    arterialSupply: 'Anterior choroidal & anterior temporal branches',
    venousDrainage: 'Basal vein of Rosenthal',
    innervation: 'Stria terminalis & ventral amygdalofugal limbic pathways',
    clinicalNotesEn:
      'Bilateral amygdala injury produces Klüver–Bucy syndrome characterized by placidity, loss of conditioned fear, and visual agnosia.',
    clinicalNotesAr:
      'تلف اللوزتين الدماغيتين ثنائي الجانب يسبب متلازمة كلوفر-بوسي المتميزة بفقدان استجابة الخوف والهدوء المفرط.',
  },
  'corpus callosum': {
    key: 'corpus callosum',
    cleanNameEn: 'Corpus Callosum',
    cleanNameAr: 'الجسم الثفني',
    latinName: 'Corpus callosum',
    ta98Code: 'A14.1.09.241',
    fmaId: 'FMA:86464',
    system: 'nervous',
    wikiSearchTitleEn: 'Corpus callosum',
    wikiSearchTitleAr: 'جسم ثفني',
    summaryEn:
      'The largest white-matter commissural tract in the human brain, arching beneath the longitudinal fissure to interconnect left and right cerebral hemispheres.',
    summaryAr:
      'أكبر حزمة من الألياف العصبية البيضاء في الدماغ البشري، يربط بين نصفي الكرة المخية الأيمن والأيسر لتنسيق المعلومات بينهما.',
    primaryFunctionEn:
      'Integrates motor, sensory, and high-level cognitive signals across homologous cortical regions of both cerebral hemispheres.',
    primaryFunctionAr:
      'توحيد وتبادل الإشارات الحسية والحركية والمعرفية بين نصفي الدماغ الأيمن والأيسر.',
    arterialSupply: 'Pericallosal artery (anterior cerebral) & posterior pericallosal branches',
    venousDrainage: 'Inferior sagittal sinus & internal cerebral veins',
    innervation: 'Over 200 million interhemispheric myelinated axons',
    clinicalNotesEn:
      'Surgical callosotomy or congenital agenesis can manifest disconnection signs (split-brain phenomena), and glioblastomas may cross via its forceps major/minor ("butterfly glioma").',
    clinicalNotesAr:
      'قد يظهر شذوذ أو قطع الجسم الثفني متلازمات انفصال نصفي الدماغ، كما تمتاز بعض الأورام الدبقية بالعبور عبره بين النصفيين.',
  },
  cerebellum: {
    key: 'cerebellum',
    cleanNameEn: 'Cerebellum',
    cleanNameAr: 'المخيخ',
    latinName: 'Cerebellum',
    ta98Code: 'A14.1.07.001',
    fmaId: 'FMA:67944',
    system: 'nervous',
    wikiSearchTitleEn: 'Cerebellum',
    wikiSearchTitleAr: 'مخيخ',
    summaryEn:
      'Foliated posterior cranial fossa structure resting beneath the tentorium cerebelli and dorsal to the pons and fourth ventricle.',
    summaryAr:
      'عضو عصبي مطوي يقع في الحفرة القحفية الخلفية خلف الجسر والنخاع المستطيل وتحت الخيمة المخيخية.',
    primaryFunctionEn:
      'Calibrates timing, precision, balance, muscle tone, and smooth motor learning/coordination across voluntary movements.',
    primaryFunctionAr:
      'ضبط التوازن وتنسيق الحركات الإرادية الدقيقة والحفاظ على توتر العضلات والوضعية.',
    arterialSupply: 'Superior cerebellar (SCA), AICA & PICA arteries',
    venousDrainage: 'Transverse, straight & superior petrosal dural sinuses',
    innervation: 'Superior, middle & inferior cerebellar peduncles',
    clinicalNotesEn:
      'Cerebellar lesions cause ipsilateral (VANISHED) signs: dysdiadochokinesia, intention tremor, scanning speech, and ataxic broad-based gait.',
    clinicalNotesAr:
      'إصابات المخيخ تسبب رنحاً في المشي ورعاشاً قصدياً واضطراباً في توازن وتنسيق الطرف في نفس جهة الآفة.',
  },
  trachea: {
    key: 'trachea',
    cleanNameEn: 'Trachea (Windpipe)',
    cleanNameAr: 'القصبة الهوائية (الرغامى)',
    latinName: 'Trachea',
    ta98Code: 'A06.3.01.001',
    fmaId: 'FMA:7394',
    system: 'visceral',
    wikiSearchTitleEn: 'Trachea',
    wikiSearchTitleAr: 'رغامى',
    summaryEn:
      'Fibrocartilaginous airway tube reinforced by 16–20 C-shaped hyaline cartilage rings extending from C6 (cricoid cartilage) to the carina at T4/T5.',
    summaryAr:
      'أنبوب تنفسي غضروفي مدعوم بحلقات غضروفية ناقصة الاستدارة يمتد من الحنجرة حتى تفرع القصبتين الهوائيتين الرئيسيتين عند الجؤجؤ.',
    primaryFunctionEn:
      'Maintains an unobstructed patent conduit for inspired air toward the bronchial tree while warming, humidifying, and clearing mucus.',
    primaryFunctionAr:
      'ضمان ممر هوائي مفتوح لنقل الهواء إلى الرئتين مع ترطيبه وتنقيته عبر الأهداب التنفسية.',
    arterialSupply: 'Inferior thyroid & bronchial arteries',
    venousDrainage: 'Inferior thyroid & esophageal venous plexuses',
    innervation: 'Recurrent laryngeal nerves (CN X) & sympathetic tracheobronchial plexus',
    clinicalNotesEn:
      'Emergency surgical airway access via cricothyroidotomy sits above the trachea; tracheal deviation toward or away from a hemithorax signals atelectasis or tension pneumothorax.',
    clinicalNotesAr:
      'انحراف الرغامى في الصور الشعاعية يشير إلى استرواح صدري ضاغط أو انخماص رئوي.',
  },
  larynx: {
    key: 'larynx',
    cleanNameEn: 'Larynx',
    cleanNameAr: 'الحنجرة',
    latinName: 'Larynx',
    ta98Code: 'A06.2.01.001',
    fmaId: 'FMA:55097',
    system: 'visceral',
    wikiSearchTitleEn: 'Larynx',
    wikiSearchTitleAr: 'حنجرة',
    summaryEn:
      'Cartilaginous organ of phonation in the anterior neck spanning C3–C6, suspended from the hyoid bone above and continuous with the trachea below.',
    summaryAr:
      'عضو غضروفي في مقدمة العنق يصل البلعوم بالقصبة الهوائية ويضم الحبال الصوتية.',
    primaryFunctionEn:
      'Protects the lower airway from aspiration during deglutition and modulates airflow across the vocal folds for speech production.',
    primaryFunctionAr:
      'حماية مجرى التنفس أثناء البلع وإصدار الصوت عبر اهتزاز الطيات الصوتية.',
    arterialSupply: 'Superior & inferior laryngeal arteries',
    venousDrainage: 'Superior & inferior laryngeal veins',
    innervation: 'Internal/external superior laryngeal & recurrent laryngeal nerves (CN X)',
    clinicalNotesEn:
      'All intrinsic laryngeal muscles are supplied by the recurrent laryngeal nerve except the cricothyroid muscle (external laryngeal branch).',
    clinicalNotesAr:
      'تُعصّب جميع عضلات الحنجرة بالعصب الحنجري الراجع باستثناء العضلة الحلقية الدرقية.',
  },
  thymus: {
    key: 'thymus',
    cleanNameEn: 'Thymus',
    cleanNameAr: 'الغدة الزعترية (التيموس)',
    latinName: 'Thymus',
    ta98Code: 'A13.1.02.001',
    fmaId: 'FMA:9607',
    system: 'visceral',
    wikiSearchTitleEn: 'Thymus',
    wikiSearchTitleAr: 'غدة زعترية',
    summaryEn:
      'Bilobed primary lymphoid organ residing in the superior and anterior mediastinum posterior to the manubrium sternum, peaking in relative size prior to puberty.',
    summaryAr:
      'عضو لمفاوي أولي ثنائي الفصوص يقع في المنصف العلوي الأمامي خلف عظم القص.',
    primaryFunctionEn:
      'Directs maturation and positive/negative selection of T-lymphocytes (thymocytes) essential for adaptive cell-mediated immunity and self-tolerance.',
    primaryFunctionAr:
      'نضج الخلايا الليمفاوية التائية وتدريبها على تمييز الذات في المناعة التكيفية.',
    arterialSupply: 'Thymic branches of internal thoracic & inferior thyroid arteries',
    venousDrainage: 'Left brachiocephalic & internal thoracic veins',
    innervation: 'Cervical sympathetic chain & vagus nerve branches',
    clinicalNotesEn:
      'Thymomas in the anterior mediastinum show a strong paraneoplastic association with myasthenia gravis.',
    clinicalNotesAr:
      'ترتبط أورام الغدة الزعترية (التيموما) في المنصف الأمامي بمرض الوهن العضلي الوبيل.',
  },
  gallbladder: {
    key: 'gallbladder',
    cleanNameEn: 'Gallbladder',
    cleanNameAr: 'المرارة (الحويصل الصفراوي)',
    latinName: 'Vesica biliaris',
    ta98Code: 'A05.8.02.001',
    fmaId: 'FMA:7202',
    system: 'visceral',
    wikiSearchTitleEn: 'Gallbladder',
    wikiSearchTitleAr: 'مرارة',
    summaryEn:
      'Pear-shaped fibromuscular sac nestled within the cystic fossa on the visceral inferior surface of the right liver lobe (Calot hepatobiliary triangle landmark).',
    summaryAr:
      'كيس عضلي كمثري الشكل يقع تحت الفص الأيمن للكبد، يقوم بتخزين العصارة الصفراوية وتركيزها.',
    primaryFunctionEn:
      'Stores and concentrates hepatic bile up to 10-fold, contracting in response to cholecystokinin (CCK) after fatty meals.',
    primaryFunctionAr:
      'تخزين وتركيز الصفراء وضخها إلى الاثني عشر استجابةً لهرمون كوليسيستوكينين لهضم الدهون.',
    arterialSupply:
      'Cystic artery (typically arising from the right hepatic artery, a branch of the hepatic artery proper within the hepatocystic triangle of Calot)',
    venousDrainage: 'Cystic veins -> Portal venous tributaries & hepatic sinusoids',
    innervation: 'Celiac plexus (sympathetic) & vagal parasympathetic fibers',
    clinicalNotesEn:
      'Cholelithiasis obstructing the cystic duct causes acute cholecystitis with positive Murphy sign and referred right shoulder pain via phrenic afferents.',
    clinicalNotesAr:
      'انسداد القناة المرارية بالحصوات يسبب التهاب المرارة الحاد وعلامة مورفي الإيجابية وألماً يمتد للكتف الأيمن.',
  },
  ureter: {
    key: 'ureter',
    cleanNameEn: 'Ureter',
    cleanNameAr: 'الحالب',
    latinName: 'Ureter',
    ta98Code: 'A08.2.01.001',
    fmaId: 'FMA:9704',
    system: 'visceral',
    wikiSearchTitleEn: 'Ureter',
    wikiSearchTitleAr: 'حالب',
    summaryEn:
      'Retroperitoneal peristaltic muscular tubes ~25–30 cm long descending anterior to psoas major to carry urine from the renal pelvis into the urinary bladder.',
    summaryAr:
      'أنبوب عضلي خلف الصفاق يصل حويضة الكلية بالمثانة البولية لنقل البول عبر التمعج العضلي.',
    primaryFunctionEn:
      'Propels urine from renal pelvices into the bladder trigone via unidirectional smooth muscle peristalsis and an oblique antireflux tunnel.',
    primaryFunctionAr:
      'دفع البول من الكليتين إلى المثانة ومنع ارتجاعه للخلف.',
    arterialSupply: 'Renal, gonadal, abdominal aortic & vesical segmental branches',
    venousDrainage: 'Corresponding renal, gonadal & internal iliac veins',
    innervation: 'Renal, aortic & hypogastric autonomic plexuses (T11–L2 afferents)',
    clinicalNotesEn:
      'Renal calculi classically impact at the 3 anatomical constrictions: UPJ, pelvic brim crossing iliac vessels ("water under the bridge"), and UVJ.',
    clinicalNotesAr:
      'تمثل تضيقات الحالب الثلاثة (مخرج الحويضة، عبور الأوعية الحرقفية، ودخول المثانة) أكثر مواضع انحصار حصوات الكلى.',
  },
  'lymph node': {
    key: 'lymph node',
    cleanNameEn: 'Lymph Node',
    cleanNameAr: 'العقدة اللمفاوية',
    latinName: 'Nodus lymphoideus',
    ta98Code: 'A13.3.00.001',
    fmaId: 'FMA:5034',
    system: 'visceral',
    wikiSearchTitleEn: 'Lymph node',
    wikiSearchTitleAr: 'عقدة لمفاوية',
    summaryEn:
      'Encapsulated secondary lymphoid filtration organs distributed along lymphatic collecting vessels across cervical, axillary, mediastinal, mesenteric, and inguinal basins.',
    summaryAr:
      'تراكيب لمفاوية محفظة تتوزع على مسار الأوعية اللمفاوية لتنقية السائل اللمفاوي وتنشيط الخلايا المناعية.',
    primaryFunctionEn:
      'Filters interstitial lymph of pathogens/antigens and coordinates B- and T-cell clonal activation within cortical follicles and paracortex.',
    primaryFunctionAr:
      'ترشيح اللمف من الميكروبات والمستضدات وتنظيم الاستجابة المناعية التكيفية.',
    arterialSupply: 'Hilar nodal arterioles',
    venousDrainage: 'High endothelial & hilar nodal venules',
    innervation: 'Autonomic perivascular fibers',
    clinicalNotesEn:
      'Sentinel lymph node mapping identifies primary lymphatic drainage of malignancies; non-tender hard supraclavicular Virchow nodes suggest intra-abdominal spread.',
    clinicalNotesAr:
      'تضخم العقد اللمفاوية قد يعكس عدوى موضعية أو انتشاراً ورمياً مثل عقدة فيرخوف فوق الترقوة.',
  },
  'palatine tonsil': {
    key: 'palatine tonsil',
    cleanNameEn: 'Palatine Tonsil',
    cleanNameAr: 'اللوزة الحنكية',
    latinName: 'Tonsilla palatina',
    ta98Code: 'A05.2.01.011',
    fmaId: 'FMA:9610',
    system: 'visceral',
    wikiSearchTitleEn: 'Palatine tonsil',
    wikiSearchTitleAr: 'لوزة حنكية',
    summaryEn:
      'Paired ovoid mucosa-associated lymphoid tissue masses tucked inside the tonsillar fossa between the palatoglossal and palatopharyngeal arches of Waldeyer ring.',
    summaryAr:
      'كتلتان لمفاويتان تقعان على جانبي البلعوم الفموي بين القوسين الحنكي اللساني والبلعومي ضمن حلقة فالداير المناعية.',
    primaryFunctionEn:
      'Samples inhaled and ingested microbial antigens entering the oropharynx to prime mucosal IgA-secreting immunity.',
    primaryFunctionAr:
      'الاستجابة المناعية المبكرة للمستضدات ومسببات الأمراض الداخلة عبر الفم والبلعوم.',
    arterialSupply: 'Tonsillar branch of facial artery (main), lingual & ascending pharyngeal arteries',
    venousDrainage: 'Peritonsillar venous plexus -> Lingual & pharyngeal veins',
    innervation: 'Glossopharyngeal nerve (CN IX) & lesser palatine branches',
    clinicalNotesEn:
      'Peritonsillar abscess (quinsy) displaces the uvula contralaterally; glossopharyngeal sensory fibers cause referred otalgia.',
    clinicalNotesAr:
      'خراج ما حول اللوزة يدفع اللهاة للجهة المقابلة وقد يسبب ألماً انعكاسياً في الأذن عبر العصب التاسع.',
  },
  'facial skeleton': {
    key: 'facial skeleton',
    cleanNameEn: 'Facial Skeleton (Viscerocranium)',
    cleanNameAr: 'عظام الوجه (القحف الحشوي)',
    latinName: 'Viscerocranium (Ossa faciei)',
    ta98Code: 'A02.1.00.004',
    fmaId: 'FMA:53672',
    system: 'skeletal',
    wikiSearchTitleEn: 'Facial skeleton',
    wikiSearchTitleAr: 'هيكل وجهي',
    summaryEn:
      'Fourteen facial bones—including maxillae, zygomatic, nasal, lacrimal, palatine, vomer, inferior nasal conchae, and mandible—forming the orbits, nasal cavity, and oral frame.',
    summaryAr:
      'مجموعة عظام الوجه التي تشكل محجر العين وجوف الأنف والفكين العلوي والسفلي.',
    primaryFunctionEn:
      'Protects sensory organs of vision/smell/taste, anchors facial expression and mastication muscles, and transmits occlusal chewing forces.',
    primaryFunctionAr:
      'حماية أعضاء الحواس الخاصة وتأمين ارتكاز عضلات المضغ والتعبير الوجهي.',
    arterialSupply: 'Facial, infraorbital, sphenopalatine & maxillary arteries',
    venousDrainage: 'Facial vein & pterygoid venous plexus',
    innervation: 'Trigeminal nerve (CN V2/V3) periosteal sensory branches',
    clinicalNotesEn:
      'Midfacial trauma follows classic Le Fort I, II, and III fracture planes violating the pterygoid plates.',
    clinicalNotesAr:
      'تصنف كسور منتصف الوجه سريرياً وفق خطوط لو فور (I وII وIII) التشريحية.',
  },
  mandible: {
    key: 'mandible',
    cleanNameEn: 'Mandible (Lower Jaw)',
    cleanNameAr: 'الفك السفلي',
    latinName: 'Mandibula',
    ta98Code: 'A02.1.15.001',
    fmaId: 'FMA:52748',
    system: 'skeletal',
    wikiSearchTitleEn: 'Mandible',
    wikiSearchTitleAr: 'فك سفلي',
    summaryEn:
      'The largest, strongest, and only freely mobile bone of the face, articulating bilaterally with the temporal bone at the temporomandibular joints (TMJ).',
    summaryAr:
      'أكبر وأصلب عظام الوجه والعظم الوحيد المتحرك في الجمجمة عبر المفصل الفكي الصدغي.',
    primaryFunctionEn:
      'Supports the lower dental arch and serves as the lever arm for mastication, speech articulation, and swallowing.',
    primaryFunctionAr:
      'تثبيت الأسنان السفلية والعمل كذراع رافعة للمضغ والنطق.',
    arterialSupply: 'Inferior alveolar artery (maxillary branch) & submental vessels',
    venousDrainage: 'Inferior alveolar & retromandibular veins',
    innervation: 'Mandibular nerve (CN V3) via inferior alveolar branch',
    clinicalNotesEn:
      'Because it forms a U-shaped ring, high-energy impact commonly causes bilateral fractures (e.g., body plus contralateral condylar neck).',
    clinicalNotesAr:
      'غالباً ما تؤدي إصابات الفك السفلي إلى كسور مزدوجة نظراً لبنيته الحلقية المغلقة.',
  },
  'thoracic vertebrae': {
    key: 'thoracic vertebrae',
    cleanNameEn: 'Thoracic Vertebrae (T1–T12)',
    cleanNameAr: 'الفقرات الصدرية (T1–T12)',
    latinName: 'Vertebrae thoracicae',
    ta98Code: 'A02.2.03.001',
    fmaId: 'FMA:9139',
    system: 'skeletal',
    wikiSearchTitleEn: 'Thoracic vertebrae',
    wikiSearchTitleAr: 'فقرات صدرية',
    summaryEn:
      'Twelve intermediate vertebrae forming a physiological kyphotic curve and carrying costal demifacets on bodies and transverse processes for rib articulation.',
    summaryAr:
      'اثنتا عشرة فقرة صدرية تتمفصل مع الأضلاع لتكوين الجدار الخلفي للقفص الصدري وحماية الحبل الشوكي الصدري.',
    primaryFunctionEn:
      'Transmits axial trunk load, anchors the ribcage for respiration, and encloses the thoracic spinal cord.',
    primaryFunctionAr:
      'نقل حمل الجذع وتثبيت الأضلاع أثناء التنفس وحماية النخاع الشوكي الصدري.',
    arterialSupply: 'Posterior intercostal spinal branches',
    venousDrainage: 'Internal/external vertebral venous plexuses -> Azygos system',
    innervation: 'Sinuvertebral & medial branches of thoracic dorsal rami',
    clinicalNotesEn:
      'The narrowest thoracic spinal canal ratio leaves the watershed cord zone (T4–T9) vulnerable to compression and ischemic myelopathy.',
    clinicalNotesAr:
      'ضيق القناة الشوكية الصدرية يجعل الحبل الشوكي الصدري عرضةً للانضغاط ونقص التروية.',
  },
  'sacrum coccyx': {
    key: 'sacrum coccyx',
    cleanNameEn: 'Sacrum & Coccyx',
    cleanNameAr: 'العجز والعصعص',
    latinName: 'Os sacrum et os coccygis',
    ta98Code: 'A02.2.05.001',
    fmaId: 'FMA:16202',
    system: 'skeletal',
    wikiSearchTitleEn: 'Sacrum',
    wikiSearchTitleAr: 'عجز (تشريح)',
    summaryEn:
      'Wedge-shaped fusion of 5 sacral vertebrae (S1–S5) wedged between the iliac bones at the sacroiliac joints, terminating inferiorly in the 3–5 fused coccygeal segments.',
    summaryAr:
      'عظم مثلث ناتج عن التحام خمس فقرات عجزية يشكل الجدار الخلفي للحوض وينتهي بعظم العصعص.',
    primaryFunctionEn:
      'Transfers upper body weight directly from the lumbar spine into the pelvic girdle while transmitting the sacral nerve roots via sacral foramina.',
    primaryFunctionAr:
      'نقل وزن الجزء العلوي من الجسم إلى الحوض وحماية الضفيرة العجزية وجذور الأعصاب.',
    arterialSupply: 'Median sacral & lateral sacral arteries',
    venousDrainage: 'Presacral & internal iliac venous plexuses',
    innervation: 'Sacral & coccygeal spinal nerves (S1–Co1)',
    clinicalNotesEn:
      'The sacral hiatus at S4–S5 serves as the anatomical landmark for caudal epidural anesthesia.',
    clinicalNotesAr:
      'يُستخدم الفرْج العجزي في نهاية العجز كمدخل تشريحي للتخدير فوق الجافية الذيلي.',
  },
  sternum: {
    key: 'sternum',
    cleanNameEn: 'Sternum (Breastbone)',
    cleanNameAr: 'عظم القص',
    latinName: 'Sternum',
    ta98Code: 'A02.3.03.001',
    fmaId: 'FMA:7485',
    system: 'skeletal',
    wikiSearchTitleEn: 'Sternum',
    wikiSearchTitleAr: 'عظم القص',
    summaryEn:
      'Flat T-shaped bone forming the anterior midline of the thorax, divided into manubrium, body (gladiolus), and xiphoid process meeting at the sternal angle of Louis (T4/T5).',
    summaryAr:
      'عظم مسطح يتوسط مقدمة الصدر ويتكون من قبضة القص وجسمه والناتئ الرهابي.',
    primaryFunctionEn:
      'Shields the heart, great vessels, and thymus anteriorly while stabilizing clavicles and true costal cartilages 1–7.',
    primaryFunctionAr:
      'حماية القلب والأوعية الكبرى والربط الأمامي للأضلاع والترقوة.',
    arterialSupply: 'Sternal branches of the internal thoracic arteries',
    venousDrainage: 'Internal thoracic veins',
    innervation: 'Anterior cutaneous intercostal nerves',
    clinicalNotesEn:
      'The sternal angle marks the 2nd costal cartilage for rib counting, aortic arch apex, and tracheal bifurcation.',
    clinicalNotesAr:
      'تمثل زاوية لويس علامة تشريحية هامة لعد الأضلاع ومستوى تفرع الرغامى وقوس الأبهر.',
  },
  ribs: {
    key: 'ribs',
    cleanNameEn: 'Ribs (Costae I–XII)',
    cleanNameAr: 'الأضلاع (1–12)',
    latinName: 'Costae',
    ta98Code: 'A02.3.01.001',
    fmaId: 'FMA:7574',
    system: 'skeletal',
    wikiSearchTitleEn: 'Rib',
    wikiSearchTitleAr: 'ضلع',
    summaryEn:
      'Twelve pairs of curved elastic osteocartilaginous arches sweeping from the thoracic vertebrae toward the sternum (true 1–7, false 8–10, floating 11–12).',
    summaryAr:
      'اثنا عشر زوجاً من العظام المقوسة تمتد من الفقرات الصدرية نحو القص لتشكيل القفص الصدري.',
    primaryFunctionEn:
      'Create a semi-rigid protective cage for lungs, heart, liver, and spleen while elevating in "pump-handle" and "bucket-handle" arcs during inspiration.',
    primaryFunctionAr:
      'حماية الرئتين والقلب والتوسع الميكانيكي لزيادة حجم الصدر أثناء الشهيق.',
    arterialSupply: 'Posterior & anterior intercostal arteries',
    venousDrainage: 'Intercostal veins -> Azygos & internal thoracic veins',
    innervation: 'Intercostal nerves (subcostal groove neurovascular bundle)',
    clinicalNotesEn:
      'Thoracentesis needles always hug the SUPERIOR border of a rib to avoid lacerating the VAN neurovascular bundle tucked beneath the inferior costal groove.',
    clinicalNotesAr:
      'يُدخل مبزل الصدر دائماً فوق الحافة العلوية للضلع لتجنب إصابة الحزمة العصبية الوعائية في الثلم السفلي.',
  },
  clavicle: {
    key: 'clavicle',
    cleanNameEn: 'Clavicle (Collarbone)',
    cleanNameAr: 'عظم الترقوة',
    latinName: 'Clavicula',
    ta98Code: 'A02.4.02.001',
    fmaId: 'FMA:13321',
    system: 'skeletal',
    wikiSearchTitleEn: 'Clavicle',
    wikiSearchTitleAr: 'ترقوة',
    summaryEn:
      'Doubly curved S-shaped horizontal strut spanning between the sternoclavicular and acromioclavicular joints—the sole bony connection uniting the upper limb to the axial trunk.',
    summaryAr:
      'عظم مزدوج التقوس في أعلى الصدر يصل عظم القص بلوح الكتف، ويمثل الرابط العظمي الوحيد بين الطرف العلوي والهيكل المحوري.',
    primaryFunctionEn:
      'Holds the glenohumeral shoulder laterally for full range of arm motion and protects the underlying subclavian vessels and brachial plexus.',
    primaryFunctionAr:
      'دفع مفصل الكتف للخارج لحرية الحركة وحماية الأوعية تحت الترقوة والضفيرة العضدية.',
    arterialSupply: 'Suprascapular & thoracoacromial periosteal vessels',
    venousDrainage: 'Subclavian & external jugular tributaries',
    innervation: 'Supraclavicular nerves (C3–C4)',
    clinicalNotesEn:
      'The most frequently fractured human bone; middle-third fractures see the medial fragment pulled superiorly by SCM while the lateral arm drops under gravity.',
    clinicalNotesAr:
      'أكثر عظام الجسم عرضةً للكسر، وغالباً ما ينكسر في الثلث الأوسط عند السقوط على الكتف أو اليد الممدودة.',
  },
  scapula: {
    key: 'scapula',
    cleanNameEn: 'Scapula (Shoulder Blade)',
    cleanNameAr: 'عظم لوح الكتف',
    latinName: 'Scapula',
    ta98Code: 'A02.4.01.001',
    fmaId: 'FMA:13394',
    system: 'skeletal',
    wikiSearchTitleEn: 'Scapula',
    wikiSearchTitleAr: 'لوح الكتف',
    summaryEn:
      'Flat triangular bone gliding over posterolateral ribs 2–7, featuring the spine, acromion, coracoid process, and shallow glenoid cavity.',
    summaryAr:
      'عظم مثلث مسطح في أعلى الظهر ينزلق فوق الأضلاع ويوفر الجوف الحقاني لمفصل الكتف.',
    primaryFunctionEn:
      'Provides muscular attachment for 17 shoulder/rotator-cuff muscles and rotates upward to enable full overhead arm elevation.',
    primaryFunctionAr:
      'تأمين منشأ عضلات الكفة المدورة وتمكين رفع الذراع فوق الرأس.',
    arterialSupply: 'Suprascapular, dorsal scapular & circumflex scapular anastomosis',
    venousDrainage: 'Concomitant scapular veins -> Subclavian vein',
    innervation: 'Suprascapular & subscapular nerves',
    clinicalNotesEn:
      'Long thoracic nerve palsy paralyzes serratus anterior, causing characteristic medial "winged scapula" protrusion when pushing against a wall.',
    clinicalNotesAr:
      'إصابة العصب الصدري الطويل تؤدي لبروز الحافة الإنسية للوحة الكتف (لوح الكتف المجنح).',
  },
  radius: {
    key: 'radius',
    cleanNameEn: 'Radius',
    cleanNameAr: 'عظم الكعبرة',
    latinName: 'Radius',
    ta98Code: 'A02.4.05.001',
    fmaId: 'FMA:23463',
    system: 'skeletal',
    wikiSearchTitleEn: 'Radius (bone)',
    wikiSearchTitleAr: 'كعبرة',
    summaryEn:
      'Lateral forearm long bone (thumb side in anatomical position) with a disc-shaped proximal head pivoting at the elbow and a broad distal articulation at the radiocarpal wrist.',
    summaryAr:
      'العظم الوحشي (جهة الإبهام) في الساعد، يتميز برأس مستدير عند المرفق ونهاية عريضة تشكل معظم مفصل الرسغ.',
    primaryFunctionEn:
      'Rotates around the stationary ulna during pronation and supination while transmitting ~80% of axial wrist compression loads.',
    primaryFunctionAr:
      'الالتفاف حول عظم الزند أثناء كب وبسط الساعد ونقل الحمل الرئيسي للرسغ.',
    arterialSupply: 'Nutrient & periosteal branches of radial and anterior interosseous arteries',
    venousDrainage: 'Radial & interosseous venae comitantes',
    innervation: 'Posterior & anterior interosseous periosteal branches',
    clinicalNotesEn:
      'FOOSH injuries classically produce a dorsally angulated distal radius Colles ("dinner-fork") fracture.',
    clinicalNotesAr:
      'السقوط على اليد الممدودة يسبب كسراً شهيراً في النهاية القاصية للكعبرة يُعرف بكسر كوليس.',
  },
  ulna: {
    key: 'ulna',
    cleanNameEn: 'Ulna',
    cleanNameAr: 'عظم الزند',
    latinName: 'Ulna',
    ta98Code: 'A02.4.06.001',
    fmaId: 'FMA:23466',
    system: 'skeletal',
    wikiSearchTitleEn: 'Ulna',
    wikiSearchTitleAr: 'عظم الزند',
    summaryEn:
      'Medial forearm stabilizing bone (little-finger side) widening proximally into the hooked olecranon and trochlear notch clasping the humerus.',
    summaryAr:
      'العظم الإنسي في الساعد، يتسع في الأعلى مشكلاً الناتئ الزجي ومفصل المرفق الرئيسي.',
    primaryFunctionEn:
      'Forms the hinge-like humeroulnar elbow joint for flexion/extension and acts as the fixed rotational axis of the forearm.',
    primaryFunctionAr:
      'تشكيل المفصل الرزي للمرفق وتوفير محور ثابت لدوران الكعبرة.',
    arterialSupply: 'Ulnar & anterior interosseous nutrient arteries',
    venousDrainage: 'Ulnar & basilic venous tributaries',
    innervation: 'Ulnar & median nerve articular branches',
    clinicalNotesEn:
      'Isolated ulnar shaft fracture from blocking a direct blow is called a "nightstick fracture"; proximal fractures with radial head dislocation define a Monteggia lesion.',
    clinicalNotesAr:
      'كسر جسم الزند مع خلع رأس الكعبرة يمثل إصابة مونتيجيا الجراحية.',
  },
  'carpals metacarpals phalanges': {
    key: 'carpals metacarpals phalanges',
    cleanNameEn: 'Hand Skeleton (Carpals, Metacarpals & Phalanges)',
    cleanNameAr: 'عظام اليد (الرسغ والمشط والسلاميات)',
    latinName: 'Ossa manus',
    ta98Code: 'A02.4.08.001',
    fmaId: 'FMA:24144',
    system: 'skeletal',
    wikiSearchTitleEn: 'Hand',
    wikiSearchTitleAr: 'عظام اليد',
    summaryEn:
      'Twenty-seven articulated bones per hand arranged into 8 wrist carpals (two rows of 4), 5 palm metacarpals, and 14 digital phalanges.',
    summaryAr:
      'تتكون اليد من 27 عظماً تشمل 8 عظام رسغية و5 عظام مشطية و14 سلامية للأصابع.',
    primaryFunctionEn:
      'Enables power gripping, opposition of the thumb, and fine micro-dexterous tool manipulation.',
    primaryFunctionAr:
      'تمكين القبض القوي وتقابل الإبهام والمهارات الحركية الدقيقة للأصابع.',
    arterialSupply: 'Superficial & deep palmar arches from radial and ulnar arteries',
    venousDrainage: 'Dorsal venous network -> Cephalic & basilic veins',
    innervation: 'Median, ulnar & superficial radial nerves',
    clinicalNotesEn:
      'Scaphoid fractures risk avascular necrosis of the proximal pole due to retrograde blood supply; 5th metacarpal neck fracture is the classic "boxer fracture".',
    clinicalNotesAr:
      'كسور العظم القاربي في الرسغ معرضة للنخر اللاوعائي بسبب طبيعة ترويتها الراجعة.',
  },
  patella: {
    key: 'patella',
    cleanNameEn: 'Patella (Kneecap)',
    cleanNameAr: 'الرضفة (صَابونة الركبة)',
    latinName: 'Patella',
    ta98Code: 'A02.5.05.001',
    fmaId: 'FMA:24485',
    system: 'skeletal',
    wikiSearchTitleEn: 'Patella',
    wikiSearchTitleAr: 'رضفة',
    summaryEn:
      'The largest sesamoid bone in the human body, embedded within the quadriceps tendon and gliding inside the femoral trochlear groove.',
    summaryAr:
      'أكبر عظم سمسماني في جسم الإنسان، يقع داخل وتر العضلة رباعية الرؤوس أمام مفصل الركبة.',
    primaryFunctionEn:
      'Increases the mechanical moment arm of the quadriceps femoris muscle by up to 30% during knee extension and shields the anterior knee joint.',
    primaryFunctionAr:
      'زيادة الذراع الميكانيكية للعضلة رباعية الرؤوس لتعزيز قوة بسط الركبة وحماية المفصل.',
    arterialSupply: 'Genicular anastomotic ring around the knee',
    venousDrainage: 'Genicular veins -> Popliteal vein',
    innervation: 'Femoral, obturator & sciatic articular branches',
    clinicalNotesEn:
      'Q-angle misalignment or weak vastus medialis obliquus predisposes to lateral patellar subluxation.',
    clinicalNotesAr:
      'خلل التوازن العضلي أو زيادة زاوية Q قد يؤهبان لخلع الرضفة نحو الجهة الوحشية.',
  },
  fibula: {
    key: 'fibula',
    cleanNameEn: 'Fibula',
    cleanNameAr: 'عظم الشظية',
    latinName: 'Fibula',
    ta98Code: 'A02.5.07.001',
    fmaId: 'FMA:24479',
    system: 'skeletal',
    wikiSearchTitleEn: 'Fibula',
    wikiSearchTitleAr: 'شظية (عظم)',
    summaryEn:
      'Slender lateral bone of the lower leg running parallel to the tibia via the interosseous membrane, terminating distally as the lateral malleolus of the ankle.',
    summaryAr:
      'العظم الرفيع في الجهة الوحشية من الساق، ينتهي في الأسفل بالكعب الوحشي لمفصل الكاحل.',
    primaryFunctionEn:
      'Stabilizes the lateral ankle mortise and provides extensive muscular attachment sites while bearing less than 15% of axial weight.',
    primaryFunctionAr:
      'تثبيت الكاحل من الجهة الوحشية وتأمين منشأ لعضلات الساق الجانبية.',
    arterialSupply: 'Fibular (peroneal) artery nutrient branch',
    venousDrainage: 'Fibular veins -> Posterior tibial vein',
    innervation: 'Common, deep & superficial fibular branches',
    clinicalNotesEn:
      'The common fibular nerve winds superficially around the fibular neck—fractures or tight casts here cause foot drop.',
    clinicalNotesAr:
      'يلتف العصب الشظوي المشترك حول عنق الشظية مما يجعله عرضةً للإصابة وحدوث هبوط القدم.',
  },
  'tarsals metatarsals phalanges': {
    key: 'tarsals metatarsals phalanges',
    cleanNameEn: 'Foot Skeleton (Tarsals, Metatarsals & Phalanges)',
    cleanNameAr: 'عظام القدم (الرسغ والمشط والسلاميات)',
    latinName: 'Ossa pedis',
    ta98Code: 'A02.5.08.001',
    fmaId: 'FMA:24492',
    system: 'skeletal',
    wikiSearchTitleEn: 'Foot',
    wikiSearchTitleAr: 'عظام القدم',
    summaryEn:
      'Twenty-six articulated bones per foot divided into 7 tarsals (talus, calcaneus, navicular, cuboid, 3 cuneiforms), 5 metatarsals, and 14 toe phalanges forming medial, lateral, and transverse arches.',
    summaryAr:
      'تتكون القدم من 26 عظماً تشمل 7 عظام رصغية و5 أمشاط و14 سلامية تشكل أقواس القدم.',
    primaryFunctionEn:
      'Absorbs ground-reaction shock at heel strike and acts as a rigid propulsive lever during toe-off.',
    primaryFunctionAr:
      'امتصاص الصدمات عند المشي والعمل كرافعة متينة لدفع الجسم أثناء الحركة.',
    arterialSupply: 'Dorsalis pedis, medial & lateral plantar arteries',
    venousDrainage: 'Plantar venous arch -> Dorsal venous arch & saphenous veins',
    innervation: 'Tibial (medial/lateral plantar), deep/superficial fibular & sural nerves',
    clinicalNotesEn:
      'Fifth metatarsal base avulsion (pseudo-Jones) and watershed zone (Jones fracture) show distinct healing profiles.',
    clinicalNotesAr:
      'تُعد كسور قاعدة المشط الخامس والرباط الأخمصي من الإصابات الشائعة للقدم.',
  },
  temporalis: {
    key: 'temporalis',
    cleanNameEn: 'Temporalis Muscle',
    cleanNameAr: 'العضلة الصدغية',
    latinName: 'Musculus temporalis',
    ta98Code: 'A04.1.04.005',
    fmaId: 'FMA:49006',
    system: 'muscular',
    wikiSearchTitleEn: 'Temporalis muscle',
    wikiSearchTitleAr: 'عضلة صدغية',
    summaryEn:
      'Broad fan-shaped masticatory muscle occupying the temporal fossa and passing deep to the zygomatic arch to insert onto the coronoid process of the mandible.',
    summaryAr:
      'عضلة مروحية الشكل تملأ الحفرة الصدغية وتنزل تحت القوس الوجنية للارتكاز على الفك السفلي.',
    primaryFunctionEn:
      'Elevates the mandible (vertical closure) and retracts the protruded jaw via its posterior horizontal fibers.',
    primaryFunctionAr:
      'رفع الفك السفلي لإطباق الأسنان وسحبه للخلف أثناء المضغ.',
    arterialSupply: 'Anterior and posterior deep temporal arteries (maxillary branch)',
    venousDrainage: 'Deep temporal veins -> Pterygoid venous plexus',
    innervation: 'Deep temporal nerves from mandibular nerve (CN V3)',
    clinicalNotesEn:
      'Temporal trigger points frequently refer tension-type headache pain over the temple and supraorbital ridge.',
    clinicalNotesAr:
      'تشنج العضلة الصدغية يُعد من الأسباب الشائعة لصداع التوتر وآلام المفصل الفكي.',
  },
  masseter: {
    key: 'masseter',
    cleanNameEn: 'Masseter Muscle',
    cleanNameAr: 'العضلة الماضغة',
    latinName: 'Musculus masseter',
    ta98Code: 'A04.1.04.002',
    fmaId: 'FMA:48996',
    system: 'muscular',
    wikiSearchTitleEn: 'Masseter muscle',
    wikiSearchTitleAr: 'عضلة ماضغة',
    summaryEn:
      'Thick quadrilateral masticatory muscle spanning from the zygomatic arch to the lateral mandibular angle and ramus.',
    summaryAr:
      'عضلة رباعية قوية تمتد من القوس الوجنية إلى السطح الخارجي لزاوية الفك السفلي.',
    primaryFunctionEn:
      'Generates the highest bite-force elevation of the mandible during mastication and assists minor jaw protrusion.',
    primaryFunctionAr:
      'توليد القوة الرئيسية لإطباق الفكين أثناء المضغ.',
    arterialSupply: 'Masseteric artery (internal maxillary artery)',
    venousDrainage: 'Masseteric vein -> Pterygoid plexus',
    innervation: 'Masseteric nerve (mandibular division CN V3)',
    clinicalNotesEn:
      'Masseteric hypertrophy is commonly associated with nocturnal bruxism and temporomandibular dysfunction.',
    clinicalNotesAr:
      'يرتبط تضخم العضلة الماضغة عادةً بصرير الأسنان الليلي واضطرابات المفصل الصدغي الفكي.',
  },
  sternocleidomastoid: {
    key: 'sternocleidomastoid',
    cleanNameEn: 'Sternocleidomastoid (SCM)',
    cleanNameAr: 'العضلة القصية الترقوية الخشائية',
    latinName: 'Musculus sternocleidomastoideus',
    ta98Code: 'A04.2.01.008',
    fmaId: 'FMA:13407',
    system: 'muscular',
    wikiSearchTitleEn: 'Sternocleidomastoid muscle',
    wikiSearchTitleAr: 'عضلة قصية ترقوية خشائية',
    summaryEn:
      'Prominent oblique two-headed neck muscle ascending from the manubrium and medial clavicle to the mastoid process, dividing anterior from posterior cervical triangles.',
    summaryAr:
      'عضلة مائلة بارزة في جانبي العنق تمتد من القص والترقوة إلى الناتئ الخشائي، وتقسم العنق إلى مثلثين أمامي وخلفي.',
    primaryFunctionEn:
      'Unilaterally tilts head ipsilaterally while rotating chin to opposite side; bilaterally flexes lower neck and assists forced inspiration.',
    primaryFunctionAr:
      'إمالة الرأس للجهة نفسها وتدويره للجهة المقابلة، وثني العنق عند عمل العضلتين معاً.',
    arterialSupply: 'Occipital & superior thyroid muscular branches',
    venousDrainage: 'External jugular & thyroid veins',
    innervation: 'Spinal accessory nerve (CN XI motor) & C2–C3 proprioception',
    clinicalNotesEn:
      'Key landmark dividing anterior and posterior triangles; spasm causes congenital or acquired torticollis (wry neck).',
    clinicalNotesAr:
      'تقلصها أحادي الجانب يسبب صعر الرقبة، وتُعد علامة رئيسية للوصول للوريد الوداجي الباطن.',
  },
  trapezius: {
    key: 'trapezius',
    cleanNameEn: 'Trapezius Muscle',
    cleanNameAr: 'العضلة شبه المنحرفة',
    latinName: 'Musculus trapezius',
    ta98Code: 'A04.3.01.001',
    fmaId: 'FMA:9626',
    system: 'muscular',
    wikiSearchTitleEn: 'Trapezius',
    wikiSearchTitleAr: 'عضلة شبه منحرفة',
    summaryEn:
      'Large triangular superficial back muscle draping from the occipital bone, nuchal ligament, and C7–T12 spinous processes across to the clavicle, acromion, and scapular spine.',
    summaryAr:
      'عضلة سطحية مثلثة كبيرة تمتد من قاعدة الجمجمة والفقرات الصدرية نحو الترقوة والكتف.',
    primaryFunctionEn:
      'Elevates, retracts, depresses, and upwardly rotates the scapula to support arm abduction above 90 degrees.',
    primaryFunctionAr:
      'رفع الكتف وسحبه للخلف وخفضه وتدويره للأعلى أثناء رفع الذراع.',
    arterialSupply: 'Transverse cervical (superficial branch) & dorsal scapular arteries',
    venousDrainage: 'Transverse cervical vein -> Subclavian vein',
    innervation: 'Spinal accessory nerve (CN XI motor) & C3–C4 proprioception',
    clinicalNotesEn:
      'CN XI injury in posterior cervical triangle biopsy causes shoulder droop and inability to abduct above horizontal.',
    clinicalNotesAr:
      'إصابة العصب القحفي الحادي عشر في المثلث الخلفي للعنق تؤدي لهبوط الكتف وضعف العضلة.',
  },
  'latissimus dorsi': {
    key: 'latissimus dorsi',
    cleanNameEn: 'Latissimus Dorsi',
    cleanNameAr: 'العضلة العريضة الظهرية',
    latinName: 'Musculus latissimus dorsi',
    ta98Code: 'A04.3.01.006',
    fmaId: 'FMA:13357',
    system: 'muscular',
    wikiSearchTitleEn: 'Latissimus dorsi muscle',
    wikiSearchTitleAr: 'عضلة ظهرية عريضة',
    summaryEn:
      'Broad thoracolumbar fan muscle rising from T7–L5 spines, thoracolumbar fascia, and iliac crest, twisting 180° around teres major to insert into the humeral intertubercular sulcus.',
    summaryAr:
      'أعرض عضلات الظهر، تنشأ من الفقرات السفلية واللفافة الصدرية القطنية وترتكز في العضد.',
    primaryFunctionEn:
      'Extends, adducts, and medially rotates the humerus—dominant powerhouse in climbing, swimming, and rowing.',
    primaryFunctionAr:
      'بسط وتقريب وتدوير العضد للداخل، وهي العضلة الرئيسية في التسلق والسباحة.',
    arterialSupply: 'Thoracodorsal artery (subscapular branch)',
    venousDrainage: 'Thoracodorsal vein -> Subscapular & axillary veins',
    innervation: 'Thoracodorsal nerve (C6–C8, posterior cord of brachial plexus)',
    clinicalNotesEn:
      'Widely utilized as a vascularized myocutaneous flap in breast and chest wall reconstructive surgery.',
    clinicalNotesAr:
      'تُستخدم بكثرة كسديلة عضلية جلدية موعّاة في جراحات ترميم جدار الصدر والثدي.',
  },
  'serratus anterior': {
    key: 'serratus anterior',
    cleanNameEn: 'Serratus Anterior',
    cleanNameAr: 'العضلة المنشارية الأمامية',
    latinName: 'Musculus serratus anterior',
    ta98Code: 'A04.4.01.008',
    fmaId: 'FMA:13397',
    system: 'muscular',
    wikiSearchTitleEn: 'Serratus anterior muscle',
    wikiSearchTitleAr: 'عضلة منشارية أمامية',
    summaryEn:
      'Serrated rib-hugging muscle originating by digitations along lateral ribs 1–8 and wrapping posteriorly beneath the scapula to insert on its medial border.',
    summaryAr:
      'عضلة مسننة تنشأ من الأضلاع الثمانية الأولى وتلتف تحت لوح الكتف لترتكز على حافته الإنسية.',
    primaryFunctionEn:
      'Protracts the scapula ("boxer punch muscle") and hugs it flush against the ribcage while upwardly rotating the glenoid.',
    primaryFunctionAr:
      'دفع لوح الكتف للأمام وتثبيته على القفص الصدري وتدويره للأعلى.',
    arterialSupply: 'Lateral thoracic & thoracodorsal arteries',
    venousDrainage: 'Lateral thoracic vein -> Axillary vein',
    innervation: 'Long thoracic nerve (C5–C7 roots)',
    clinicalNotesEn:
      'Superficial course of the long thoracic nerve exposes it during axillary lymphadenectomy ("C5, 6, 7 raise arms to heaven").',
    clinicalNotesAr:
      'إصابة العصب الصدري الطويل أثناء جراحة الإبط تسبب بروز لوح الكتف المجنح.',
  },
  'external oblique': {
    key: 'external oblique',
    cleanNameEn: 'External Abdominal Oblique',
    cleanNameAr: 'العضلة المائلة البطنية الظاهرة',
    latinName: 'Musculus obliquus externus abdominis',
    ta98Code: 'A04.5.01.008',
    fmaId: 'FMA:13335',
    system: 'muscular',
    wikiSearchTitleEn: 'Abdominal external oblique muscle',
    wikiSearchTitleAr: 'عضلة مائلة بطنية ظاهرة',
    summaryEn:
      'The largest and outermost lateral abdominal wall muscle whose fibers slant inferomedially ("hands in pockets"), forming the inguinal ligament inferiorly.',
    summaryAr:
      'العضلة السطحية الأوسع في جدار البطن الجانبي، تتجه أليافها للأسفل والإنسية وتشكل الرباط الإربي في أسفلها.',
    primaryFunctionEn:
      'Compresses abdominal viscera during forced expiration/Valsalva, flexes the spine, and rotates the trunk contralaterally.',
    primaryFunctionAr:
      'ضغط أحشاء البطن ودعم الزفير القسري وتدوير الجذع للجهة المقابلة.',
    arterialSupply: 'Lower posterior intercostal, subcostal & deep circumflex iliac arteries',
    venousDrainage: 'Corresponding intercostal & superficial epigastric veins',
    innervation: 'Thoracoabdominal (T7–T11) & subcostal (T12) nerves',
    clinicalNotesEn:
      'Its aponeurosis splits near the pubic tubercle to form the superficial inguinal ring.',
    clinicalNotesAr:
      'تشكّل صفاقها الحلقة الإربية السطحية التي تمر عبرها الفتوق الإربية.',
  },
  'triceps brachii': {
    key: 'triceps brachii',
    cleanNameEn: 'Triceps Brachii',
    cleanNameAr: 'العضلة ثلاثية الرؤوس العضدية',
    latinName: 'Musculus triceps brachii',
    ta98Code: 'A04.6.02.019',
    fmaId: 'FMA:37688',
    system: 'muscular',
    wikiSearchTitleEn: 'Triceps',
    wikiSearchTitleAr: 'عضلة ثلاثية الرؤوس العضدية',
    summaryEn:
      'Large three-headed extensor spanning the entire posterior compartment of the arm (long, lateral, and medial heads) inserting onto the ulnar olecranon.',
    summaryAr:
      'العضلة الوحيدة الباسطة في المسكن الخلفي للعضد، تتكون من ثلاثة رؤوس وترتكز على الناتئ الزجي للزند.',
    primaryFunctionEn:
      'Primary extensor of the elbow joint; the biarticular long head also extends and adducts the shoulder.',
    primaryFunctionAr:
      'بسط مفصل المرفق والمساعدة في بسط وتقريب مفصل الكتف.',
    arterialSupply: 'Profunda brachii artery',
    venousDrainage: 'Profunda brachii venae comitantes -> Brachial vein',
    innervation: 'Radial nerve (C6–C8)',
    clinicalNotesEn:
      'Spiral groove humeral fractures often spare proximal long-head triceps branches while paralyzing wrist extensors ("Saturday night palsy" vs axillary lesions).',
    clinicalNotesAr:
      'كسور منتصف العضد في الثلم الحلزوني قد تصيب العصب الكعبري مع بقاء بعض فروع العضلة ثلاثية الرؤوس.',
  },
  'brachioradialis forearm flexors': {
    key: 'brachioradialis forearm flexors',
    cleanNameEn: 'Forearm Flexors & Brachioradialis',
    cleanNameAr: 'عضلات الساعد القابضة والعضدية الكعبرية',
    latinName: 'Musculi antebrachii',
    ta98Code: 'A04.6.02.025',
    fmaId: 'FMA:38450',
    system: 'muscular',
    wikiSearchTitleEn: 'Brachioradialis',
    wikiSearchTitleAr: 'عضلة عضدية كعبرية',
    summaryEn:
      'Musculature of the anterior flexor-pronator and lateral mobile-wad forearm compartments flexing the wrist/digits and mid-pronating the radius.',
    summaryAr:
      'مجموعة عضلات الساعد الأمامية والوحشية المسؤولة عن قبض الرسغ والأصابع وتثبيت الكعبرة.',
    primaryFunctionEn:
      'Generates grip strength, wrist/finger flexion, forearm pronation, and powerful mid-prone elbow flexion (brachioradialis).',
    primaryFunctionAr:
      'توليد قوة قبضة اليد وثني المعصم والأصابع وكب الساعد.',
    arterialSupply: 'Radial, ulnar & anterior interosseous arteries',
    venousDrainage: 'Median cubital, cephalic & basilic superficial/deep veins',
    innervation: 'Median, ulnar & radial (C5–C6 brachioradialis) nerves',
    clinicalNotesEn:
      'Medial epicondylitis ("golfer elbow") inflames the common flexor origin; brachioradialis tests the C6 tendon reflex.',
    clinicalNotesAr:
      'منشأ العضلات القابضة في اللقيمة الإنسية يرتبط بالتهاب مرفق لاعب الغولف.',
  },
  'gluteus maximus': {
    key: 'gluteus maximus',
    cleanNameEn: 'Gluteus Maximus',
    cleanNameAr: 'العضلة الألوية الكبرى',
    latinName: 'Musculus gluteus maximus',
    ta98Code: 'A04.7.02.006',
    fmaId: 'FMA:22314',
    system: 'muscular',
    wikiSearchTitleEn: 'Gluteus maximus',
    wikiSearchTitleAr: 'عضلة ألوية كبرى',
    summaryEn:
      'The largest and most superficial gluteal muscle forming the contour of the buttock, descending from iliac crest/sacrum to the iliotibial tract and gluteal tuberosity.',
    summaryAr:
      'أكبر عضلات الإلية، تمتد من الحرقفة والعجز لترتكز في السبيل الحرقفي الظنبوبي وعظم الفخذ.',
    primaryFunctionEn:
      'Powerfully extends and laterally rotates the hip when rising from seated posture, climbing stairs, or sprinting.',
    primaryFunctionAr:
      'بسط مفصل الورك وتدويره للوحشي عند النهوض وصعود الدرج والركض.',
    arterialSupply: 'Inferior & superior gluteal arteries',
    venousDrainage: 'Gluteal veins -> Internal iliac vein',
    innervation: 'Inferior gluteal nerve (L5–S2)',
    clinicalNotesEn:
      'Weakness produces the "gluteus maximus lurch" (posterior trunk throw-back at heel strike) and difficulty rising from a chair.',
    clinicalNotesAr:
      'ضعفها يصعب النهوض من الجلوس ويؤدي لانحناء الجذع للخلف أثناء المشي.',
  },
  'quadriceps rectus femoris': {
    key: 'quadriceps rectus femoris',
    cleanNameEn: 'Quadriceps Femoris & Rectus Femoris',
    cleanNameAr: 'العضلة رباعية الرؤوس الفخذية (المستقيمة الفخذية)',
    latinName: 'Musculus quadriceps femoris',
    ta98Code: 'A04.7.02.017',
    fmaId: 'FMA:22428',
    system: 'muscular',
    wikiSearchTitleEn: 'Quadriceps femoris muscle',
    wikiSearchTitleAr: 'عضلة رباعية الرؤوس الفخذية',
    summaryEn:
      'Four-headed anterior thigh extensor complex converging onto the patellar tendon, led centrally by the bipennate rectus femoris.',
    summaryAr:
      'العضلة الرئيسية في مقدمة الفخذ بأربعة رؤوس تتحد في وتر الرضفة لبسط الركبة.',
    primaryFunctionEn:
      'Primary extensor of the knee joint; rectus femoris additionally flexes the hip during gait swing phase.',
    primaryFunctionAr:
      'بسط مفصل الركبة، كما تساعد المستقيمة الفخذية في ثني مفصل الورك.',
    arterialSupply: 'Lateral femoral circumflex & deep femoral (profunda femoris) arteries',
    venousDrainage: 'Femoral vein tributaries',
    innervation: 'Femoral nerve (L2–L4)',
    clinicalNotesEn:
      'The patellar tendon jerk tests L3–L4 spinal segments; femoral neuropathy causes buckling of the knee on stairs.',
    clinicalNotesAr:
      'فحص منعكس وتر الرضفة يقيس سلامة جذور الأعصاب L3–L4 والعصب الفخذي.',
  },
  'vastus lateralis medialis': {
    key: 'vastus lateralis medialis',
    cleanNameEn: 'Vastus Lateralis & Vastus Medialis',
    cleanNameAr: 'العضلة المتسعة الوحشية والإنسية',
    latinName: 'Musculus vastus lateralis et medialis',
    ta98Code: 'A04.7.02.019',
    fmaId: 'FMA:22431',
    system: 'muscular',
    wikiSearchTitleEn: 'Vastus lateralis muscle',
    wikiSearchTitleAr: 'عضلة متسعة وحشية',
    summaryEn:
      'Lateral and medial massive heads of the quadriceps enveloping the femoral shaft and inserting onto the patellar margins to balance patellar tracking.',
    summaryAr:
      'أكبر مكونات العضلة رباعية الرؤوس على جانبي الفخذ لضبط استقامة وحركة الرضفة.',
    primaryFunctionEn:
      'Power knee extension while VMO (vastus medialis obliquus) stabilizes the patella against lateral subluxation during terminal extension.',
    primaryFunctionAr:
      'توليد قوة بسط الركبة وتثبيت الرضفة في مسارها التشريحي.',
    arterialSupply: 'Lateral femoral circumflex & descending genicular arteries',
    venousDrainage: 'Deep femoral & femoral veins',
    innervation: 'Femoral nerve (L2–L4)',
    clinicalNotesEn:
      'The mid-anterolateral vastus lateralis is the preferred intramuscular injection site in infants and adults due to minimal major neurovascular overlap.',
    clinicalNotesAr:
      'تُعد المتسعة الوحشية الموقع المفضل للحقن العضلي في الفخذ لبعدها عن الأوعية والأعصاب الكبيرة.',
  },
  'biceps femoris hamstrings': {
    key: 'biceps femoris hamstrings',
    cleanNameEn: 'Hamstrings & Biceps Femoris',
    cleanNameAr: 'العضلات المأبضية (ثنائية الرؤوس الفخذية)',
    latinName: 'Musculus biceps femoris et ischiocrurales',
    ta98Code: 'A04.7.02.032',
    fmaId: 'FMA:22356',
    system: 'muscular',
    wikiSearchTitleEn: 'Hamstring',
    wikiSearchTitleAr: 'عضلة فخذية ذات رأسين',
    summaryEn:
      'Posterior thigh flexor group (biceps femoris, semitendinosus, semimembranosus) running from the ischial tuberosity across hip and knee.',
    summaryAr:
      'مجموعة العضلات الخلفية للفخذ الممتدة من الأحدوبة الإسكية إلى الساق.',
    primaryFunctionEn:
      'Flexes the knee joint, extends the hip during running propulsion, and rotates the flexed leg (biceps laterally, semi-muscles medially).',
    primaryFunctionAr:
      'ثني مفصل الركبة وبسط الورك أثناء الجري والقفز.',
    arterialSupply: 'Perforating branches of profunda femoris artery',
    venousDrainage: 'Profunda femoris & popliteal veins',
    innervation: 'Tibial & common fibular divisions of sciatic nerve (L5–S2)',
    clinicalNotesEn:
      'Eccentric sprinting overload frequently tears the long head of biceps femoris at the proximal myotendinous junction.',
    clinicalNotesAr:
      'تمزقات العضلات المأبضية شائعة عند الرياضيين في سباقات السرعة أثناء الانقباض اللامركزي.',
  },
  'gastrocnemius soleus': {
    key: 'gastrocnemius soleus',
    cleanNameEn: 'Calf Muscle (Gastrocnemius & Soleus)',
    cleanNameAr: 'عضلة الساق الخلفية (الساقية والنعلية)',
    latinName: 'Musculus triceps surae',
    ta98Code: 'A04.7.02.043',
    fmaId: 'FMA:22541',
    system: 'muscular',
    wikiSearchTitleEn: 'Triceps surae muscle',
    wikiSearchTitleAr: 'عضلة ساقية',
    summaryEn:
      'Superficial two-headed gastrocnemius and deeper multipennate soleus forming the triceps surae calf bulk that merges into the Achilles calcaneal tendon.',
    summaryAr:
      'العضلتان الساقية والنعلية في خلف الساق وتتحدان في وتر العرقوب (أخيل) المرتكز في عظم العقب.',
    primaryFunctionEn:
      'Plantarflexes the ankle for walking, running, and toe-standing while acting as a crucial peripheral "muscle pump" returning deep venous blood.',
    primaryFunctionAr:
      'ثني القدم أخمصياً لدفع الجسم وضخ الدم الوريدي من الساق نحو القلب.',
    arterialSupply: 'Sural & posterior tibial arteries',
    venousDrainage: 'Soleal venous sinuses -> Popliteal & small saphenous veins',
    innervation: 'Tibial nerve (S1–S2)',
    clinicalNotesEn:
      'S1 ankle jerk and Thompson calf-squeeze test evaluate Achilles tendon integrity.',
    clinicalNotesAr:
      'انقطاع وتر العرقوب يظهر باختبار طومسون الإيجابي مع ضعف شديد في الثني الأخمصي.',
  },
  'tibialis anterior': {
    key: 'tibialis anterior',
    cleanNameEn: 'Tibialis Anterior',
    cleanNameAr: 'العضلة الظنبوبية الأمامية',
    latinName: 'Musculus tibialis anterior',
    ta98Code: 'A04.7.02.037',
    fmaId: 'FMA:22532',
    system: 'muscular',
    wikiSearchTitleEn: 'Tibialis anterior muscle',
    wikiSearchTitleAr: 'عضلة ظنبوبية أمامية',
    summaryEn:
      'Thick anterior crural compartment muscle hugging the lateral tibial shaft and passing beneath extensor retinacula to insert on the medial cuneiform and 1st metatarsal.',
    summaryAr:
      'عضلة المسكن الأمامي للساق الملاصقة للظنبوب والمرتكزة على الحافة الإنسية للقدم.',
    primaryFunctionEn:
      'Dorsiflexes and inverts the foot to clear the toes from the ground during gait swing phase.',
    primaryFunctionAr:
      'رفع مقدمة القدم (الثني الظهري) وقلبها للداخل لمنع تعثر الأصابع أثناء المشي.',
    arterialSupply: 'Anterior tibial artery',
    venousDrainage: 'Anterior tibial veins',
    innervation: 'Deep fibular (peroneal) nerve (L4–L5)',
    clinicalNotesEn:
      'L4–L5 radiculopathy or fibular neck compression produces foot drop and high-steppage gait.',
    clinicalNotesAr:
      'إصابة العصب الشظوي العميق تسبب شلل هذه العضلة وهبوط القدم (المشية الخبيبية).',
  },
  'cervical plexus': {
    key: 'cervical plexus',
    cleanNameEn: 'Cervical Plexus (C1–C4)',
    cleanNameAr: 'الضفيرة العنقية (C1–C4)',
    latinName: 'Plexus cervicalis',
    ta98Code: 'A14.2.02.012',
    fmaId: 'FMA:5904',
    system: 'nervous',
    wikiSearchTitleEn: 'Cervical plexus',
    wikiSearchTitleAr: 'ضفيرة عنقية',
    summaryEn:
      'Interconnected anterior rami network of C1–C4 spinal nerves deep to SCM, issuing superficial cutaneous nerves at Erb nerve point and deep motor loops including ansa cervicalis and phrenic nerve.',
    summaryAr:
      'شبكة عصبية من الفروع الأمامية للأعصاب الرقبية C1–C4 تعصب جلد العنق والعضلات تحت اللامية والحجاب الحاجز.',
    primaryFunctionEn:
      'Innervates infrahyoid/strap muscles, neck skin, and via the phrenic nerve (C3–C5) provides the sole motor supply to the diaphragm.',
    primaryFunctionAr:
      'تعصيب الحجاب الحاجز عبر العصب الحجابي وتعصيب جلد العنق والأذن والعضلات الحزامية.',
    arterialSupply: 'Ascending cervical & vertebral arterial twigs',
    venousDrainage: 'Cervical & internal jugular venous plexuses',
    innervation: 'C1–C4 spinal cord segments',
    clinicalNotesEn:
      'A superficial cervical plexus block injected at Erb nerve point anesthetizes the anterolateral neck for carotid endarterectomy.',
    clinicalNotesAr:
      'نقطة إيرب على الحافة الخلفية للعضلة القصية الترقوية الخشائية تمثل موضع خروج الأعصاب الحسية للضفيرة العنقية.',
  },
  'intercostal nerves': {
    key: 'intercostal nerves',
    cleanNameEn: 'Intercostal Nerves (T1–T11)',
    cleanNameAr: 'الأعصاب الوربية (بين الأضلاع)',
    latinName: 'Nervi intercostales',
    ta98Code: 'A14.2.04.001',
    fmaId: 'FMA:5916',
    system: 'nervous',
    wikiSearchTitleEn: 'Intercostal nerves',
    wikiSearchTitleAr: 'أعصاب وربية',
    summaryEn:
      'Anterior rami of thoracic spinal nerves T1–T11 coursing inside each subcostal groove beneath the companion vein and artery.',
    summaryAr:
      'الفروع الأمامية للأعصاب الصدرية التي تسير في الثلم السفلي تحت كل ضلع لتعصيب جدار الصدر والبطن.',
    primaryFunctionEn:
      'Control rhythmic intercostal and abdominal muscle contraction alongside segmental dermatomal skin sensation.',
    primaryFunctionAr:
      'تعصيب العضلات الوربية وجدار البطن ونقل الحس الجلدي القطعي للصدر.',
    arterialSupply: 'Vasa nervorum from posterior intercostal arteries',
    venousDrainage: 'Intercostal veins -> Azygos system',
    innervation: 'T1–T11 thoracic spinal cord segments',
    clinicalNotesEn:
      'Herpes zoster (shingles) classically erupts along a single unilateral intercostal dermatome without crossing the midline.',
    clinicalNotesAr:
      'يظهر الحزام الناري (الهربس النطاقي) عادةً على امتداد عصب وربي واحد دون تجاوز خط المنتصف.',
  },
  'median ulnar radial nerves': {
    key: 'median ulnar radial nerves',
    cleanNameEn: 'Median, Ulnar & Radial Nerves',
    cleanNameAr: 'الأعصاب الناصف والزندي والكعبري',
    latinName: 'Nervi medianus, ulnaris et radialis',
    ta98Code: 'A14.2.03.031',
    fmaId: 'FMA:37067',
    system: 'nervous',
    wikiSearchTitleEn: 'Median nerve',
    wikiSearchTitleAr: 'عصب ناصف',
    summaryEn:
      'The three terminal motor-sensory trunks branching from the brachial plexus cords to supply the entire arm, forearm, and hand.',
    summaryAr:
      'الأعصاب الطرفية الثلاثة الرئيسية للطرف العلوي المنبثقة من الضفيرة العضدية لتعصيب العضد والساعد واليد.',
    primaryFunctionEn:
      'Radial extends arm/wrist; Median flexes forearm/thumb thenar opposition; Ulnar drives fine intrinsic hand dexterity.',
    primaryFunctionAr:
      'الكعبري لبسط اليد والناصف لقبض الأصابع وتقابل الإبهام والزندي لحركات اليد الدقيقة.',
    arterialSupply: 'Brachial, radial & ulnar companion vasa nervorum',
    venousDrainage: 'Deep concomitant brachial veins',
    innervation: 'Brachial plexus roots C5–T1',
    clinicalNotesEn:
      'Median compression at the wrist causes carpal tunnel syndrome; ulnar compression at the cubital tunnel causes clawing/intrinsic wasting.',
    clinicalNotesAr:
      'انضغاط العصب الناصف في الرسغ يسبب متلازمة النفق الرسغي، وإصابة الكعبري تسبب تدلي الرسغ.',
  },
  'lumbar sacral plexus': {
    key: 'lumbar sacral plexus',
    cleanNameEn: 'Lumbosacral Plexus (L1–S4)',
    cleanNameAr: 'الضفيرة القطنية العجزية',
    latinName: 'Plexus lumbosacralis',
    ta98Code: 'A14.2.07.001',
    fmaId: 'FMA:5912',
    system: 'nervous',
    wikiSearchTitleEn: 'Lumbosacral plexus',
    wikiSearchTitleAr: 'ضفيرة قطنية عجزية',
    summaryEn:
      'Deep retroperitoneal/pelvic network uniting lumbar (L1–L4: femoral, obturator) and sacral (L4–S4: sciatic, pudendal) rami to innervate pelvis and lower extremities.',
    summaryAr:
      'شبكة عصبية خلف الصفاق وفي الحوض تجمع الضفيرتين القطنية والعجزية لتعصيب الحوض والطرفين السفليين.',
    primaryFunctionEn:
      'Gives rise to femoral, obturator, gluteal, sciatic, and pudendal nerves controlling lower limb mobility, continence, and pelvic floor tone.',
    primaryFunctionAr:
      'إمداد الفخذ والساق والقدم والحوض بالأعصاب الحركية والحسية واللاإرادية.',
    arterialSupply: 'Iliolumbar, lumbar & internal iliac arterial branches',
    venousDrainage: 'Lumbar & internal iliac veins',
    innervation: 'L1–S4 spinal roots',
    clinicalNotesEn:
      'Retroperitoneal psoas hematoma or pelvic surgery can compress the femoral or obturator branches of the lumbar plexus.',
    clinicalNotesAr:
      'التجمعات الدموية في العضلة القطنية قد تضغط على العصب الفخذي المنبثق من هذه الضفيرة.',
  },
  'tibial fibular nerves': {
    key: 'tibial fibular nerves',
    cleanNameEn: 'Tibial & Common Fibular Nerves',
    cleanNameAr: 'العصبان الظنبوبي والشظوي المشترك',
    latinName: 'Nervi tibialis et fibularis communis',
    ta98Code: 'A14.2.07.058',
    fmaId: 'FMA:19037',
    system: 'nervous',
    wikiSearchTitleEn: 'Tibial nerve',
    wikiSearchTitleAr: 'عصب ظنبوبي',
    summaryEn:
      'The two terminal branches of the sciatic nerve separating above the popliteal fossa to serve the posterior leg/plantar foot (tibial) and anterior/lateral leg (fibular).',
    summaryAr:
      'الفرعان النهائيان للعصب الوركي خلف الركبة لتعصيب الساق والقدم.',
    primaryFunctionEn:
      'Tibial drives calf plantarflexion and plantar foot sensation; fibular nerves power dorsiflexion, toe extension, and foot eversion.',
    primaryFunctionAr:
      'الظنبوبي للثني الأخمصي وأخمص القدم، والشظوي لرفع القدم وبسط الأصابع.',
    arterialSupply: 'Popliteal, posterior & anterior tibial vasa nervorum',
    venousDrainage: 'Popliteal & tibial venae comitantes',
    innervation: 'L4–S3 spinal segments via sciatic nerve',
    clinicalNotesEn:
      'Tibial compression beneath the flexor retinaculum causes tarsal tunnel syndrome; fibular neck trauma produces foot drop.',
    clinicalNotesAr:
      'انضغاط العصب الظنبوبي خلف الكعب الإنسي يسبب متلازمة النفق الرصغي.',
  },
  'inferior vena cava': {
    key: 'inferior vena cava',
    cleanNameEn: 'Inferior Vena Cava (IVC)',
    cleanNameAr: 'الوريد الأجوف السفلي',
    latinName: 'Vena cava inferior',
    ta98Code: 'A12.3.09.001',
    fmaId: 'FMA:10951',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Inferior vena cava',
    wikiSearchTitleAr: 'وريد أجوف سفلي',
    summaryEn:
      'The widest venous trunk in the body, formed at L5 by confluence of common iliac veins, ascending retroperitoneally right of the aorta to pierce the diaphragm at T8.',
    summaryAr:
      'أكبر وريد في الجسم يتكون من التقاء الوريدين الحرقفيين المشتركين ويصعد ليدخل الأذين الأيمن حاملاً دم النصف السفلي.',
    primaryFunctionEn:
      'Returns deoxygenated venous blood from the lower limbs, pelvis, kidneys, gonads, and hepatic veins into the right atrium.',
    primaryFunctionAr:
      'إعادة الدم غير المؤكسج من الطرفين السفليين والحوض والكليتين والكبد إلى الأذين الأيمن للقلب.',
    arterialSupply: 'Vasa vasorum from retroperitoneal lumbar arteries',
    venousDrainage: 'Confluence directly into Right Atrium of heart',
    innervation: 'Autonomic lumbar/celiac perivascular fibers',
    clinicalNotesEn:
      'Right-sided retroperitoneal position explains why a gravid uterus in supine posture may cause aortocaval compression syndrome.',
    clinicalNotesAr:
      'انضغاط الوريد الأجوف السفلي عند الحامل في وضعية الاستلقاء قد يخفض العود الوريدي وضغط الدم.',
  },
  'carotid arteries': {
    key: 'carotid arteries',
    cleanNameEn: 'Common, Internal & External Carotid Arteries',
    cleanNameAr: 'الشرايين السباتية (المشترك والباطن والظاهر)',
    latinName: 'Arteriae carotides',
    ta98Code: 'A12.2.04.001',
    fmaId: 'FMA:3939',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Common carotid artery',
    wikiSearchTitleAr: 'شريان سباتي أصلي',
    summaryEn:
      'Paired great cervical arteries ascending within the carotid sheath before bifurcating at C3–C4 (carotid sinus) into external carotid (face/scalp) and internal carotid (brain/eye).',
    summaryAr:
      'الشريانان الرئيسيان في العنق اللذان ينقسمان عند مستوى الفقرة C4 إلى سباتي ظاهر للوجه وسباتي باطن للدماغ.',
    primaryFunctionEn:
      'Deliver continuous high-pressure oxygenated cerebral perfusion (internal carotid -> circle of Willis) alongside baroreceptor blood-pressure sensing.',
    primaryFunctionAr:
      'إمداد الدماغ والعين والوجه والرقبة بالدم المؤكسج واستشعار ضغط الدم عبر الجيب السباتي.',
    arterialSupply: 'Direct origin from aortic arch (left) & brachiocephalic trunk (right)',
    venousDrainage: 'Companion internal jugular veins',
    innervation: 'Carotid sinus nerve (CN IX), vagus (CN X) & sympathetic plexus',
    clinicalNotesEn:
      'Carotid bifurcation atherosclerotic stenosis is a leading thromboembolic cause of ischemic stroke.',
    clinicalNotesAr:
      'تضيق تفرع الشريان السباتي باللويحات العصيدية يُعد سبباً رئيسياً للسكتات الدماغية الإقفارية.',
  },
  'jugular veins': {
    key: 'jugular veins',
    cleanNameEn: 'Internal & External Jugular Veins',
    cleanNameAr: 'الأوردة الوداجية (الباطن والظاهر)',
    latinName: 'Venae jugulares',
    ta98Code: 'A12.3.05.001',
    fmaId: 'FMA:4724',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Internal jugular vein',
    wikiSearchTitleAr: 'وريد وداجي باطن',
    summaryEn:
      'Paired cervical venous channels draining intracranial dural sinuses through the jugular foramen (internal jugular) and scalp/neck superficially (external jugular) into brachiocephalic veins.',
    summaryAr:
      'الأوردة الرئيسية في العنق المسؤولة عن تصريف الدم من الدماغ والجيوب الوريدية القحفية والوجه.',
    primaryFunctionEn:
      'Returns cranial and cervical venous blood into the superior vena cava and serves as a clinical barometer of right atrial central venous pressure (JVP).',
    primaryFunctionAr:
      'تصريف الدم الوريدي من الرأس والعنق وتقييم ضغط الأذين الأيمن سريرياً (JVP).',
    arterialSupply: 'Cervical vasa vasorum',
    venousDrainage: 'Joins subclavian vein to form brachiocephalic vein',
    innervation: 'Cervical perivascular autonomic nerves',
    clinicalNotesEn:
      'The right internal jugular vein provides a straight high-yield corridor for central venous catheter placement between the two heads of SCM.',
    clinicalNotesAr:
      'يُعد الوريد الوداجي الباطن الأيمن الممر الأهم لتركيب القساطر الوريدية المركزية.',
  },
  'subclavian vessels': {
    key: 'subclavian vessels',
    cleanNameEn: 'Subclavian Artery & Vein',
    cleanNameAr: 'الشريان والوريد تحت الترقوة',
    latinName: 'Arteria et vena subclavia',
    ta98Code: 'A12.2.08.001',
    fmaId: 'FMA:3951',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Subclavian artery',
    wikiSearchTitleAr: 'شريان تحت الترقوة',
    summaryEn:
      'Major neurovascular arch vessels arching over the 1st rib beneath the clavicle (separated by scalenus anterior) to become the axillary vessels at the lateral rib border.',
    summaryAr:
      'الأوعية الدموية الكبرى التي تمر فوق الضلع الأول وتحت عظم الترقوة لإمداد الطرف العلوي والدماغ.',
    primaryFunctionEn:
      'Perfuse the entire upper limb as well as brain (vertebral branch) and anterior chest wall (internal thoracic branch).',
    primaryFunctionAr:
      'تروية الطرف العلوي وجزء من الدماغ (عبر الشريان الفقري) وجدار الصدر.',
    arterialSupply: 'Brachiocephalic trunk (right) / Aortic arch (left)',
    venousDrainage: 'Subclavian vein -> Brachiocephalic vein',
    innervation: 'Cervicothoracic sympathetic cardiac/brachial plexus',
    clinicalNotesEn:
      'Compression in the interscalene or costoclavicular interval produces thoracic outlet syndrome.',
    clinicalNotesAr:
      'انضغاطها مع الضفيرة العضدية بين الأضلاع والترقوة يسبب متلازمة مخرج الصدر.',
  },
  'brachial vessels': {
    key: 'brachial vessels',
    cleanNameEn: 'Brachial Artery & Veins',
    cleanNameAr: 'الشريان والوريد العضدي',
    latinName: 'Arteria et venae brachiales',
    ta98Code: 'A12.2.09.018',
    fmaId: 'FMA:22689',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Brachial artery',
    wikiSearchTitleAr: 'شريان عضدي',
    summaryEn:
      'Continuation of the axillary vessels descending medially along biceps brachii alongside the median nerve before bifurcating in the cubital fossa into radial and ulnar vessels.',
    summaryAr:
      'امتداد الأوعية الإبطية على الجانب الإنسي للعضد حتى الحفرة المرفقية حيث تتفرع إلى كعبرية وزندية.',
    primaryFunctionEn:
      'Supplies oxygenated blood to the arm, elbow anastomosis, and entire forearm/hand.',
    primaryFunctionAr:
      'تزويد العضد والساعد واليد بالدم المؤكسج وتصريف الدم الوريدي العميق.',
    arterialSupply: 'Continuation of axillary artery at inferior teres major border',
    venousDrainage: 'Brachial venae comitantes + Basilic -> Axillary vein',
    innervation: 'Medial brachial autonomic plexus',
    clinicalNotesEn:
      'Standard site for sphygmomanometer blood pressure auscultation medial to biceps tendon; vulnerable in supracondylar humeral fractures.',
    clinicalNotesAr:
      'الموضع القياسي لقياس ضغط الدم بالسماعة، وعرضة للإصابة في الكسور فوق اللقيمية عند الأطفال.',
  },
  'radial ulnar vessels': {
    key: 'radial ulnar vessels',
    cleanNameEn: 'Radial & Ulnar Arteries and Veins',
    cleanNameAr: 'الشرايين والأوردة الكعبرية والزندية',
    latinName: 'Arteriae et venae radialis et ulnaris',
    ta98Code: 'A12.2.09.027',
    fmaId: 'FMA:22730',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Radial artery',
    wikiSearchTitleAr: 'شريان كعبري',
    summaryEn:
      'Paired terminal forearm vessels arising at the cubital fossa and descending laterally (radial) and medially (ulnar) into the palmar arches of the hand.',
    summaryAr:
      'الشريانان الرئيسيان في الساعد اللذان يتحدان في راحة اليد لتشكيل الأقواس الشريانية الراحيّة.',
    primaryFunctionEn:
      'Provide redundant dual collateral blood perfusion and venous drainage for the forearm compartments and digits.',
    primaryFunctionAr:
      'ضمان التروية المزدوجة والمتوازية للساعد وعضلات وأصابع اليد.',
    arterialSupply: 'Bifurcation of brachial artery',
    venousDrainage: 'Paired venae comitantes -> Brachial vein',
    innervation: 'Autonomic sympathetic fibers',
    clinicalNotesEn:
      'The modified Allen test confirms collateral palmar arch patency via the ulnar artery before radial artery cannulation.',
    clinicalNotesAr:
      'يُجرى اختبار ألن للتحقق من كفاءة الشريان الزندي قبل قسطرة الشريان الكعبري أو سحب غازات الدم.',
  },
  'common iliac vessels': {
    key: 'common iliac vessels',
    cleanNameEn: 'Common Iliac Arteries & Veins',
    cleanNameAr: 'الأوعية الحرقفية المشتركة',
    latinName: 'Vasa iliaca communia',
    ta98Code: 'A12.2.14.001',
    fmaId: 'FMA:14770',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Common iliac artery',
    wikiSearchTitleAr: 'شريان حرقفي أصلي',
    summaryEn:
      'Terminal bifurcation trunks emerging from the abdominal aorta at L4 (and uniting into IVC at L5), dividing near the sacroiliac joint into internal (pelvic) and external (lower limb) vessels.',
    summaryAr:
      'الأوعية الحوضية الكبرى الناتجة عن تفرع الأبهر البطني لتغذية الحوض والطرفين السفليين.',
    primaryFunctionEn:
      'Distributes systemic blood flow bilaterally to pelvic viscera, gluteal region, and lower extremities.',
    primaryFunctionAr:
      'توصيل الدم المؤكسج لأعضاء الحوض والطرفين السفليين وإعادة الدم الوريدي نحو الوريد الأجوف السفلي.',
    arterialSupply: 'Terminal bifurcation of abdominal aorta at L4',
    venousDrainage: 'Confluence forming Inferior Vena Cava at L5',
    innervation: 'Hypogastric autonomic plexus',
    clinicalNotesEn:
      'May–Thurner syndrome occurs where the right common iliac artery compresses the left common iliac vein against L5 vertebrae.',
    clinicalNotesAr:
      'متلازمة ماي-ثورنر تحدث عندما يضغط الشريان الحرقفي الأيمن على الوريد الحرقفي الأيسر مسبباً خثاراً وريدياً.',
  },
  'femoral vessels': {
    key: 'femoral vessels',
    cleanNameEn: 'Femoral Artery & Vein',
    cleanNameAr: 'الشريان والوريد الفخذي',
    latinName: 'Arteria et vena femoralis',
    ta98Code: 'A12.2.16.010',
    fmaId: 'FMA:70248',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Femoral artery',
    wikiSearchTitleAr: 'شريان فخذي',
    summaryEn:
      'Continuation of the external iliac vessels passing beneath the mid-inguinal ligament inside the femoral sheath (NAVEL lateral-to-medial order) through the femoral triangle and adductor canal.',
    summaryAr:
      'الأوعية الرئيسية في الفخذ التي تمر تحت الرباط الإربي في المثلث الفخذي ثم القناة المقربة نحو خلف الركبة.',
    primaryFunctionEn:
      'Delivers principal arterial perfusion to the thigh, leg, and foot while draining deep femoral and great saphenous venous return.',
    primaryFunctionAr:
      'التروية الشريانية الأساسية للطرف السفلي وتصريف الدم الوريدي نحو الحوض.',
    arterialSupply: 'Continuation of external iliac artery below inguinal ligament',
    venousDrainage: 'Femoral vein -> External iliac vein',
    innervation: 'Sympathetic perivascular fibers (alongside femoral nerve laterally)',
    clinicalNotesEn:
      'Remember NAVEL (Nerve-Artery-Vein-Empty space-Lymphatics) lateral-to-medial in the groin for arterial angiography and central access.',
    clinicalNotesAr:
      'قاعدة NAVEL (من الوحشي للإنسي: العصب ثم الشريان ثم الوريد) تحدد موضع القسطرة الفخذية.',
  },
  'popliteal tibial vessels': {
    key: 'popliteal tibial vessels',
    cleanNameEn: 'Popliteal & Tibial Arteries and Veins',
    cleanNameAr: 'الأوعية المأبضية والظنبوبية',
    latinName: 'Arteriae et venae poplitea et tibiales',
    ta98Code: 'A12.2.16.033',
    fmaId: 'FMA:77155',
    system: 'cardiovascular',
    wikiSearchTitleEn: 'Popliteal artery',
    wikiSearchTitleAr: 'شريان مأبضي',
    summaryEn:
      'Continuation of femoral vessels entering the posterior knee popliteal fossa (deepest structure beneath vein and tibial nerve) and bifurcating into anterior and posterior tibial branches.',
    summaryAr:
      'الأوعية الواقعة في الحفرة المأبضية خلف الركبة والمتفرعة إلى الأوعية الظنبوبية الأمامية والخلفية والشظوية.',
    primaryFunctionEn:
      'Supplies knee genicular anastomosis, anterior/posterior/lateral crural compartments, and plantar/dorsal arches of the foot.',
    primaryFunctionAr:
      'تروية مفصل الركبة وعضلات الساق والقدم وتصريف الدم الوريدي نحو الوريد الفخذي.',
    arterialSupply: 'Continuation of femoral artery through adductor hiatus',
    venousDrainage: 'Popliteal vein -> Femoral vein',
    innervation: 'Tibial autonomic vasomotor branches',
    clinicalNotesEn:
      'Posterior knee dislocation endangers the tethered popliteal artery; dorsalis pedis and posterior tibial pulses screen peripheral arterial disease.',
    clinicalNotesAr:
      'خلع الركبة الخلفي يشكل خطورةً على الشريان المأبضي، كما يُتحرى النبض الظنبوبي الخلفي وظهر القدم سريرياً.',
  },
  aorta: {
    key: 'aorta',
    cleanNameEn: 'Aorta (Ascending, Arch, Thoracic & Abdominal)',
    cleanNameAr: 'الشريان الأبهر (الصاعد والقوس والصدري والبطني)',
    latinName: 'Aorta',
    ta98Code: 'A12.2.02.001',
    fmaId: 'FMA:3734',
    system: 'cardiovascular',
    region: 'Thorax (Mediastinum) & Retroperitoneum',
    wikiSearchTitleEn: 'Aorta',
    wikiSearchTitleAr: 'أبهر (شريان)',
    summaryEn:
      'The largest elastic systemic artery in the human body, originating at the aortic valve of the left ventricle, arching over the left pulmonary hilum, traversing the posterior mediastinum and aortic hiatus (T12), and bifurcating into the common iliac arteries at L4.',
    summaryAr:
      'أكبر شريان مرن في جسم الإنسان، ينشأ من البطين الأيسر عند الصمام الأبهري ويمتد عبر المنصف الصدري وخلف الصفاق البطني ليتفرع عند الفقرة القطنية الرابعة L4.',
    primaryFunctionEn:
      'Conducts high-pressure oxygenated cardiac output from the left ventricle into the systemic circulation while buffering systolic pulse pressure via Windkessel elastic recoil.',
    primaryFunctionAr:
      'نقل الدم المؤكسج عالي الضغط من البطين الأيسر إلى كافة أجهزة الجسم والحفاظ على استمرارية الجريان الشرياني أثناء الانبساط.',
    arterialSupply: 'Vasa vasorum from coronary, bronchial, intercostal & lumbar arteries',
    venousDrainage: 'Bronchial, azygos, hemiazygos & lumbar venous plexuses',
    innervation: 'Aortic arch baroreceptors (CN IX/X) & sympathetic vasomotor fibers',
    clinicalNotesEn:
      'Intimal tearing causes life-threatening Stanford Type A (ascending) or Type B (descending) aortic dissection; abdominal aortic aneurysms (>5.5 cm infrarenal) carry high rupture risk.',
    clinicalNotesAr:
      'تسلخ الأبهر (نوع A الصاعد أو نوع B النازل) وأم الدم الأبهرية البطنية من أخطر الطوارئ الوعائية المهددة للحياة.',
  },
  sartorius: {
    key: 'sartorius',
    cleanNameEn: 'Sartorius Muscle',
    cleanNameAr: 'العضلة الخياطية',
    latinName: 'Musculus sartorius',
    ta98Code: 'A04.7.02.015',
    fmaId: 'FMA:22353',
    system: 'muscular',
    region: 'Anterior Compartment of Thigh',
    origin: 'Anterior superior iliac spine (ASIS) and superior half of notch below it',
    insertion: 'Superior medial surface of tibia via pes anserinus (with gracilis & semitendinosus)',
    action: 'Flexes, abducts, and laterally rotates the thigh at the hip; flexes and medially rotates the flexed leg at the knee',
    relationsEn: 'Forms the lateral border of the femoral triangle and roofs the adductor (Hunter) canal over the femoral vessels.',
    wikiSearchTitleEn: 'Sartorius muscle',
    wikiSearchTitleAr: 'عضلة خياطية',
    summaryEn:
      'The longest strap-like muscle in the human body, coursing obliquely from the ASIS inferomedially across the anterior thigh to insert onto the proximal medial tibia as part of the pes anserinus.',
    summaryAr:
      'أطول عضلة في جسم الإنسان، تمتد بشكل مائل من الشوكة الحرقفية الأمامية العلوية إلى الوجه الإنسي للظنبوب ضمن "قدم الوزة" (Pes anserinus).',
    primaryFunctionEn:
      'Coordinates combined flexion, abduction, and external rotation of the hip with knee flexion (the classic cross-legged tailor posture).',
    primaryFunctionAr:
      'ثني الورك وتبعيده وتدويره للخارج مع ثني الركبة (وضعية الجلوس متربعاً).',
    arterialSupply: 'Muscular branches of the femoral, lateral femoral circumflex & descending genicular arteries',
    venousDrainage: 'Femoral & great saphenous venous tributaries',
    innervation: 'Femoral nerve (L2, L3)',
    clinicalNotesEn:
      'Anatomical landmark forming the lateral boundary of the femoral triangle and covering the femoral vessels inside the subsartorial (adductor) canal; pes anserinus bursitis causes medial knee pain.',
    clinicalNotesAr:
      'معلم تشريحي يحد المثلث الفخذي وحشياً ويغطي الأوعية الفخذية في قناة هانتر، والتهاب جراب قدم الوزة يسبب ألماً إنسي الركبة.',
  },
  soleus: {
    key: 'soleus',
    cleanNameEn: 'Soleus Muscle',
    cleanNameAr: 'العضلة النعلية',
    latinName: 'Musculus soleus',
    ta98Code: 'A04.7.02.047',
    fmaId: 'FMA:22542',
    system: 'muscular',
    region: 'Superficial Posterior Compartment of Leg',
    origin: 'Posterior aspect of head and upper quarter of fibula, soleal line of tibia & tendinous arch of soleus',
    insertion: 'Posterior calcaneal tuberosity via the calcaneal (Achilles) tendon',
    action: 'Strong plantarflexor of the foot at the ankle joint independent of knee flexion; stabilizes the leg over the planted foot in standing',
    relationsEn: 'Lies deep to the gastrocnemius; the popliteal artery, vein, and tibial nerve pass deep to its tendinous arch.',
    wikiSearchTitleEn: 'Soleus muscle',
    wikiSearchTitleAr: 'عضلة نعلية',
    summaryEn:
      'Broad, multipennate anti-gravity calf muscle deep to gastrocnemius whose aponeurosis unites with gastrocnemius to form the calcaneal (Achilles) tendon.',
    summaryAr:
      'عضلة عميقة عريضة في مسكن الساق الخلفي تتحد مع عضلة الساق السطحية لتشكيل وتر أخيل.',
    primaryFunctionEn:
      'Maintains upright standing posture and powers ankle plantarflexion; acts as the peripheral skeletal-muscle venous pump returning blood from deep leg veins.',
    primaryFunctionAr:
      'تثبيت القامة أثناء الوقوف وتنفيذ الثني الأخمصي للكاحل والعمل كمضخة وريدية للساق.',
    arterialSupply: 'Popliteal, posterior tibial & fibular (peroneal) muscular branches',
    venousDrainage: 'Soleal venous sinuses -> Posterior tibial & fibular veins -> Popliteal vein',
    innervation: 'Tibial nerve (S1, S2)',
    clinicalNotesEn:
      'Intramuscular soleal venous sinusoids are a prime site of deep vein thrombosis (DVT); the tendinous arch of soleus transmits the tibial nerve and posterior tibial vessels.',
    clinicalNotesAr:
      'الجيوب الوريدية داخل العضلة النعلية موقع شائع لتشكل الخثرات الوريدية العميقة (DVT).',
  },
  iliopsoas: {
    key: 'iliopsoas',
    cleanNameEn: 'Iliopsoas Muscle (Psoas Major & Iliacus)',
    cleanNameAr: 'العضلة الحرقفية القطنية',
    latinName: 'Musculus iliopsoas',
    ta98Code: 'A04.7.02.001',
    fmaId: 'FMA:64918',
    system: 'muscular',
    region: 'Posterior Abdominal Wall & Anterior Hip',
    origin: 'T12–L5 vertebral bodies/transverse processes (psoas major) & iliac fossa (iliacus)',
    insertion: 'Lesser trochanter of the femur',
    action: 'Chief flexor of the thigh at the hip joint; flexes the trunk laterally and anteriorly when the lower limb is fixed',
    wikiSearchTitleEn: 'Iliopsoas',
    wikiSearchTitleAr: 'عضلة حرقفية قطنية',
    summaryEn:
      'Composite deep flexor formed by the convergence of psoas major and iliacus beneath the inguinal ligament to insert on the lesser trochanter of the femur.',
    summaryAr:
      'العضلة الرئيسية المثنية للورك، تتكون من التقاء العضلة القطنية الكبيرة والعضلة الحرقفية تحت الرباط الإربي.',
    primaryFunctionEn:
      'Primary hip flexor during swing phase of gait and postural trunk stabilization on the pelvis.',
    primaryFunctionAr: 'الثني الأساسي لمفصل الورك وتثبيت الجذع والحوض.',
    arterialSupply: 'Lumbar segmental arteries & iliolumbar artery (internal iliac branch)',
    venousDrainage: 'Lumbar veins & iliolumbar vein -> Common iliac vein',
    innervation: 'Femoral nerve (L2–L3) to iliacus; anterior rami L1–L3 to psoas major',
    clinicalNotesEn:
      'Retroperitoneal psoas abscess tracking beneath the inguinal fascia presents with painful hip flexion and positive psoas sign in retrocecal appendicitis.',
    clinicalNotesAr:
      'علامة العضلة القطنية (Psoas sign) تشير لتهيجها في التهاب الزائدة خلف الأعور أو خراج القطنية.',
  },
  pectineus: {
    key: 'pectineus',
    cleanNameEn: 'Pectineus Muscle',
    cleanNameAr: 'العضلة المشطية',
    latinName: 'Musculus pectineus',
    ta98Code: 'A04.7.02.025',
    fmaId: 'FMA:22440',
    system: 'muscular',
    region: 'Anterior/Medial Thigh (Femoral Triangle Floor)',
    origin: 'Pectineal line (pecten pubis) of superior pubic ramus',
    insertion: 'Pectineal line of femur inferior to lesser trochanter',
    action: 'Adducts and flexes the thigh at the hip joint',
    wikiSearchTitleEn: 'Pectineus muscle',
    wikiSearchTitleAr: 'عضلة مشطية',
    summaryEn:
      'Flat quadrangular muscle forming the medial floor of the femoral triangle, bridging anterior hip flexors and medial thigh adductors.',
    summaryAr: 'عضلة مسطحة تشكّل القسم الإنسي من أرضية المثلث الفخذي وتجمع بين ثني الفخذ وتقريبه.',
    primaryFunctionEn: 'Adducts and assists flexion of the thigh at the hip joint.',
    primaryFunctionAr: 'تقريب الفخذ والمساعدة في ثنيه عند مفصل الورك.',
    arterialSupply: 'Medial femoral circumflex artery & obturator artery',
    venousDrainage: 'Medial femoral circumflex vein -> Femoral vein',
    innervation: 'Femoral nerve (L2, L3); occasionally accessory branch from obturator nerve',
    clinicalNotesEn: 'Dual embryological derivation explains its transitional femoral/obturator innervation and clinical relevance in groin adductor strains.',
    clinicalNotesAr: 'تُصاب في تمزقات عضلات المغبن لدى الرياضيين وتشكل جزءاً من أرضية المثلث الفخذي.',
  },
  gracilis: {
    key: 'gracilis',
    cleanNameEn: 'Gracilis Muscle',
    cleanNameAr: 'العضلة الرشيقة',
    latinName: 'Musculus gracilis',
    ta98Code: 'A04.7.02.031',
    fmaId: 'FMA:43874',
    system: 'muscular',
    region: 'Medial Compartment of Thigh',
    origin: 'Body and inferior ramus of pubis',
    insertion: 'Superior medial shaft of tibia via pes anserinus',
    action: 'Adducts the thigh and flexes/medially rotates the leg at the knee',
    wikiSearchTitleEn: 'Gracilis muscle',
    wikiSearchTitleAr: 'عضلة رشيقة',
    summaryEn:
      'Most superficial and medial strap muscle of the adductor compartment, spanning both the hip and knee joints to join the pes anserinus.',
    summaryAr: 'أكثر عضلات المسكن الإنسي للفخذ سطحيةً وإنسيةً، وتعبر الورك والركبة نحو قدم الوزة.',
    primaryFunctionEn: 'Adducts the hip and flexes/internally rotates the knee.',
    primaryFunctionAr: 'تقريب الورك وثني الركبة وتدوير الساق للداخل.',
    arterialSupply: 'Medial femoral circumflex & obturator arteries (via profunda femoris)',
    venousDrainage: 'Profunda femoris & great saphenous venous tributaries',
    innervation: 'Obturator nerve (L2, L3)',
    clinicalNotesEn:
      'Commonly harvested alongside the semitendinosus tendon for anterior cruciate ligament (ACL) autograft reconstruction with minimal functional deficit.',
    clinicalNotesAr: 'يُستخدم وترها مع العضلة نصف الوترية في ترقيع الرباط الصليبي الأمامي للركبة.',
  },
  'adductor longus': {
    key: 'adductor longus',
    cleanNameEn: 'Adductor Longus Muscle',
    cleanNameAr: 'العضلة المقربة الطويلة',
    latinName: 'Musculus adductor longus',
    ta98Code: 'A04.7.02.026',
    fmaId: 'FMA:22441',
    system: 'muscular',
    region: 'Medial Compartment of Thigh',
    origin: 'Body of pubis inferior to pubic crest',
    insertion: 'Middle third of linea aspera of femur',
    action: 'Adducts the thigh at the hip joint',
    wikiSearchTitleEn: 'Adductor longus muscle',
    wikiSearchTitleAr: 'عضلة مقربة طويلة',
    summaryEn:
      'Large triangular adductor defining the medial border of the femoral triangle and concealing deeper adductor brevis and magnus.',
    summaryAr: 'عضلة مثلثة تشكّل الحد الإنسي للمثلث الفخذي في المسكن الإنسي للفخذ.',
    primaryFunctionEn: 'Powerfully adducts the thigh and assists in early hip flexion.',
    primaryFunctionAr: 'تقريب الفخذ عند مفصل الورك.',
    arterialSupply: 'Profunda femoris (deep femoral) & obturator arteries',
    venousDrainage: 'Profunda femoris vein -> Femoral vein',
    innervation: 'Anterior division of obturator nerve (L2–L4)',
    clinicalNotesEn: 'The most frequently strained adductor muscle in soccer and ice-hockey groin injuries.',
    clinicalNotesAr: 'أكثر العضلات المقربة تعرضاً للتمزق في إصابات الرياضيين.',
  },
  'adductor magnus': {
    key: 'adductor magnus',
    cleanNameEn: 'Adductor Magnus Muscle',
    cleanNameAr: 'العضلة المقربة الكبيرة',
    latinName: 'Musculus adductor magnus',
    ta98Code: 'A04.7.02.028',
    fmaId: 'FMA:22443',
    system: 'muscular',
    region: 'Medial Compartment of Thigh',
    origin: 'Inferior pubic ramus & ischial ramus (adductor part); ischial tuberosity (hamstring part)',
    insertion: 'Gluteal tuberosity, linea aspera & medial supracondylar line; adductor tubercle (hamstring part)',
    action: 'Powerful thigh adduction; adductor part flexes hip while ischiocondylar part extends hip',
    relationsEn: 'Aponeurotic gap creates the adductor hiatus transmitting the femoral artery and vein into the popliteal fossa.',
    wikiSearchTitleEn: 'Adductor magnus muscle',
    wikiSearchTitleAr: 'عضلة مقربة كبيرة',
    summaryEn:
      'Massive composite muscle dividing into an adductor portion and an ischiocondylar hamstring portion separated distally by the adductor hiatus.',
    summaryAr: 'أضخم عضلات المسكن الإنسي للفخذ، تتألف من جزء مقرب وآخر مأبضي بينهما الفرجة المقربة.',
    primaryFunctionEn: 'Adducts and extends the thigh while transmitting the femoral vessels through the adductor hiatus.',
    primaryFunctionAr: 'تقريب الفخذ وبسطه وتكوين الفرجة المقربة لمرور الأوعية الفخذية.',
    arterialSupply: 'Profunda femoris, obturator & medial femoral circumflex arteries',
    venousDrainage: 'Profunda femoris & popliteal veins',
    innervation: 'Dual innervation: Obturator nerve (L2–L4, adductor part) & tibial division of sciatic nerve (L4, hamstring part)',
    clinicalNotesEn: 'Femoral vessels traverse its adductor hiatus to become the popliteal artery and vein.',
    clinicalNotesAr: 'يمر الشريان والوريد الفخذيان عبر فرجتها ليصبحا الأوعية المأبضية خلف الركبة.',
  },
  'vastus lateralis': {
    key: 'vastus lateralis',
    cleanNameEn: 'Vastus Lateralis Muscle',
    cleanNameAr: 'العضلة المتسعة الوحشية',
    latinName: 'Musculus vastus lateralis',
    ta98Code: 'A04.7.02.019',
    fmaId: 'FMA:22432',
    system: 'muscular',
    region: 'Anterior Compartment of Thigh',
    origin: 'Greater trochanter & lateral lip of linea aspera of femur',
    insertion: 'Lateral base of patella and tibial tuberosity via patellar ligament',
    action: 'Extends the leg at the knee joint',
    wikiSearchTitleEn: 'Vastus lateralis muscle',
    wikiSearchTitleAr: 'عضلة متسعة وحشية',
    summaryEn: 'Largest of the four quadriceps femoris heads occupying the anterolateral thigh.',
    summaryAr: 'أكبر رؤوس العضلة رباعية الرؤوس الفخذية وتشغل القسم الوحشي الأمامي من الفخذ.',
    primaryFunctionEn: 'Extends the knee joint during gait, climbing, and standing up.',
    primaryFunctionAr: 'بسط مفصل الركبة.',
    arterialSupply: 'Descending & transverse branches of lateral femoral circumflex artery',
    venousDrainage: 'Lateral femoral circumflex vein -> Femoral vein',
    innervation: 'Femoral nerve (L2, L3, L4)',
    clinicalNotesEn: 'Preferred anterolateral middle-third thigh site for pediatric and adult intramuscular injections and epinephrine auto-injectors.',
    clinicalNotesAr: 'الموقع السريري المفضل للحقن العضلي الآمن في الفخذ بعيداً عن العصب الوركي والأوعية الفخذية.',
  },
  'vastus medialis': {
    key: 'vastus medialis',
    cleanNameEn: 'Vastus Medialis Muscle',
    cleanNameAr: 'العضلة المتسعة الإنسية',
    latinName: 'Musculus vastus medialis',
    ta98Code: 'A04.7.02.021',
    fmaId: 'FMA:22434',
    system: 'muscular',
    region: 'Anterior Compartment of Thigh',
    origin: 'Intertrochanteric line & medial lip of linea aspera of femur',
    insertion: 'Medial border of patella and tibial tuberosity via patellar ligament',
    action: 'Extends the knee joint; oblique fibers (VMO) stabilize patellar tracking against lateral subluxation',
    wikiSearchTitleEn: 'Vastus medialis',
    wikiSearchTitleAr: 'عضلة متسعة إنسية',
    summaryEn: 'Teardrop-shaped medial quadriceps head whose distal oblique fibers prevent lateral patellar maltracking during terminal knee extension.',
    summaryAr: 'الرأس الإنسي للعضلة رباعية الرؤوس الفخذية، تسهم أليافها المائلة بتثبيت الرضفة ومنع خلعها وحشياً.',
    primaryFunctionEn: 'Completes terminal knee extension and stabilizes medial patellar tracking.',
    primaryFunctionAr: 'إتمام البسط النهائي للركبة وتثبيت الرضفة إنسياً.',
    arterialSupply: 'Femoral & descending genicular arteries',
    venousDrainage: 'Femoral & popliteal venous tributaries',
    innervation: 'Femoral nerve (L2, L3, L4)',
    clinicalNotesEn: 'VMO atrophy rapidly follows knee effusion or ACL injury, exacerbating patellofemoral pain syndrome.',
    clinicalNotesAr: 'يؤدي ضعفها السريع بعد إصابات الركبة لاضطراب مسار الرضفة.',
  },
  'gluteus medius': {
    key: 'gluteus medius',
    cleanNameEn: 'Gluteus Medius Muscle',
    cleanNameAr: 'العضلة الألوية الوسطى',
    latinName: 'Musculus gluteus medius',
    ta98Code: 'A04.7.02.007',
    fmaId: 'FMA:22315',
    system: 'muscular',
    region: 'Gluteal Region',
    origin: 'External ilium between anterior and posterior gluteal lines',
    insertion: 'Lateral surface of greater trochanter of femur',
    action: 'Abducts and medially rotates the thigh; keeps the pelvis level during single-leg stance',
    wikiSearchTitleEn: 'Gluteus medius',
    wikiSearchTitleAr: 'عضلة ألوية وسطى',
    summaryEn: 'Thick fan-shaped gluteal abductor lying largely beneath gluteus maximus and inserting into the greater trochanter.',
    summaryAr: 'عضلة مروحية سميكة في الناحية الألوية مسؤولة عن تبعيد الفخذ ومنع سقوط الحوض.',
    primaryFunctionEn: 'Abducts and internally rotates the hip while leveling the contralateral pelvis during walking.',
    primaryFunctionAr: 'تبعيد الورك وتثبيت مستوى الحوض أثناء الوقوف على ساق واحدة والمشي.',
    arterialSupply: 'Deep branch of superior gluteal artery',
    venousDrainage: 'Superior gluteal vein -> Internal iliac vein',
    innervation: 'Superior gluteal nerve (L4, L5, S1)',
    clinicalNotesEn: 'Superior gluteal nerve palsy causes contralateral pelvic drop during single-leg stance (positive Trendelenburg sign).',
    clinicalNotesAr: 'إصابة العصب الألوي العلوي تسبب علامة تريندلنبورغ الإيجابية ومشية مائلة.',
  },
  piriformis: {
    key: 'piriformis',
    cleanNameEn: 'Piriformis Muscle',
    cleanNameAr: 'العضلة الكمثرية',
    latinName: 'Musculus piriformis',
    ta98Code: 'A04.7.02.011',
    fmaId: 'FMA:19082',
    system: 'muscular',
    region: 'Deep Gluteal Region & Posterior Pelvis',
    origin: 'Anterior (pelvic) surface of sacrum & sacrotuberous ligament',
    insertion: 'Superior border of greater trochanter of femur',
    action: 'Externally rotates the extended thigh and abducts the flexed thigh; stabilizes femoral head in acetabulum',
    wikiSearchTitleEn: 'Piriformis muscle',
    wikiSearchTitleAr: 'عضلة كمثرية',
    summaryEn: 'Keystone deep gluteal external rotator exiting the pelvis through the greater sciatic foramen.',
    summaryAr: 'المعلم الرئيسي في الناحية الألوية العميقة، تخرج من الحوض عبر الثقبة الوركية الكبيرة.',
    primaryFunctionEn: 'Laterally rotates the extended hip and stabilizes the femoral head in the acetabulum.',
    primaryFunctionAr: 'تدوير الفخذ للخارج وتثبيت رأس الفخذ في الجوف الحقي.',
    arterialSupply: 'Superior & inferior gluteal and lateral sacral arteries',
    venousDrainage: 'Internal iliac venous tributaries',
    innervation: 'Nerve to piriformis (S1, S2 anterior rami)',
    clinicalNotesEn: 'The sciatic nerve usually emerges immediately inferior to piriformis; spasm or hypertrophy compresses it in piriformis syndrome.',
    clinicalNotesAr: 'يمر العصب الوركي عادة أسفلها مباشرةً، وانضغاطه يسبب متلازمة العضلة الكمثرية.',
  },
  'tensor fasciae latae': {
    key: 'tensor fasciae latae',
    cleanNameEn: 'Tensor Fasciae Latae Muscle',
    cleanNameAr: 'العضلة الموترة للفافة العريضة',
    latinName: 'Musculus tensor fasciae latae',
    ta98Code: 'A04.7.02.010',
    fmaId: 'FMA:22428',
    system: 'muscular',
    region: 'Anterolateral Thigh & Hip',
    origin: 'Anterior superior iliac spine (ASIS) & anterior iliac crest',
    insertion: 'Iliotibial tract attaching to Gerdy tubercle on anterolateral tibia',
    action: 'Tenses the iliotibial tract, assists hip abduction/flexion/internal rotation and stabilizes extended knee',
    wikiSearchTitleEn: 'Tensor fasciae latae muscle',
    wikiSearchTitleAr: 'عضلة موترة للفافة العريضة',
    summaryEn: 'Fusiform anterolateral hip muscle enclosed between layers of fascia lata that transmits tension along the iliotibial band to the knee.',
    summaryAr: 'عضلة أمامية وحشية في الورك تشد السبيل الحرقفي الظنبوبي نحو الركبة.',
    primaryFunctionEn: 'Tenses the iliotibial tract to brace the hip and knee during upright weight bearing.',
    primaryFunctionAr: 'شد اللفافة العريضة والسبيل الحرقفي الظنبوبي لتثبيت الورك والركبة.',
    arterialSupply: 'Ascending branch of lateral femoral circumflex & superior gluteal arteries',
    venousDrainage: 'Lateral femoral circumflex vein -> Femoral vein',
    innervation: 'Superior gluteal nerve (L4, L5, S1)',
    clinicalNotesEn: 'Hypertonicity contributes to iliotibial band friction syndrome over the lateral femoral epicondyle in runners.',
    clinicalNotesAr: 'توترها يسهم في متلازمة احتكاك السبيل الحرقفي الظنبوبي لدى العدّائين.',
  },
  semitendinosus: {
    key: 'semitendinosus',
    cleanNameEn: 'Semitendinosus Muscle',
    cleanNameAr: 'العضلة نصف الوترية',
    latinName: 'Musculus semitendinosus',
    ta98Code: 'A04.7.02.035',
    fmaId: 'FMA:22357',
    system: 'muscular',
    region: 'Posterior Compartment of Thigh',
    origin: 'Ischial tuberosity (shared tendon with long head of biceps femoris)',
    insertion: 'Medial surface of superior tibia via pes anserinus',
    action: 'Extends the thigh at the hip and flexes/medially rotates the leg at the knee',
    wikiSearchTitleEn: 'Semitendinosus muscle',
    wikiSearchTitleAr: 'عضلة نصف وترية',
    summaryEn: 'Medial hamstring distinguished by a remarkably long cord-like distal tendon inserting into the pes anserinus.',
    summaryAr: 'إحدى عضلات المأبض الإنسية تتميز بوتر طويل يرتكز ضمن قدم الوزة على الظنبوب.',
    primaryFunctionEn: 'Extends the hip and flexes/internally rotates the knee.',
    primaryFunctionAr: 'بسط الورك وثني الركبة وتدوير الساق للداخل.',
    arterialSupply: 'Perforating branches of profunda femoris & inferior gluteal arteries',
    venousDrainage: 'Profunda femoris & popliteal veins',
    innervation: 'Tibial division of sciatic nerve (L5, S1, S2)',
    clinicalNotesEn: 'Premier hamstring tendon graft source for ACL reconstruction.',
    clinicalNotesAr: 'المصدر الأكثر استخداماً لترقيع الرباط الصليبي الأمامي.',
  },
  semimembranosus: {
    key: 'semimembranosus',
    cleanNameEn: 'Semimembranosus Muscle',
    cleanNameAr: 'العضلة نصف الغشائية',
    latinName: 'Musculus semimembranosus',
    ta98Code: 'A04.7.02.036',
    fmaId: 'FMA:22358',
    system: 'muscular',
    region: 'Posterior Compartment of Thigh',
    origin: 'Ischial tuberosity',
    insertion: 'Posterior surface of medial tibial condyle & oblique popliteal ligament',
    action: 'Extends the thigh and flexes/medially rotates the leg at the knee',
    wikiSearchTitleEn: 'Semimembranosus muscle',
    wikiSearchTitleAr: 'عضلة نصف غشائية',
    summaryEn: 'Broad membranous medial hamstring lying deep to semitendinosus and reinforcing the posterior knee capsule via the oblique popliteal ligament.',
    summaryAr: 'عضلة مأبضية عريضة غشائية تقع عميقاً تحت نصف الوترية وتدعم محفظة الركبة الخلفية.',
    primaryFunctionEn: 'Extends the thigh, flexes/internally rotates the leg, and retracts the medial meniscus during knee flexion.',
    primaryFunctionAr: 'بسط الورك وثني الركبة ودعم استقرار محفظة الركبة الخلفية.',
    arterialSupply: 'Perforating branches of profunda femoris & superior medial genicular arteries',
    venousDrainage: 'Profunda femoris & popliteal veins',
    innervation: 'Tibial division of sciatic nerve (L5, S1, S2)',
    clinicalNotesEn: 'The semimembranosus-gastrocnemius bursa commonly distends as a popliteal (Baker) cyst.',
    clinicalNotesAr: 'تمدد جرابها مع العضلة الساقية يشكّل كيسة بيكر المأبضية خلف الركبة.',
  },
  'fibularis longus': {
    key: 'fibularis longus',
    cleanNameEn: 'Fibularis (Peroneus) Longus Muscle',
    cleanNameAr: 'العضلة الشظوية الطويلة',
    latinName: 'Musculus fibularis longus',
    ta98Code: 'A04.7.02.041',
    fmaId: 'FMA:22539',
    system: 'muscular',
    region: 'Lateral Compartment of Leg',
    origin: 'Head and upper two-thirds of lateral surface of fibula',
    insertion: 'Plantar base of first metatarsal and medial cuneiform (crossing sole obliquely)',
    action: 'Everts the foot and weakly plantarflexes the ankle while supporting the transverse and lateral longitudinal arches',
    wikiSearchTitleEn: 'Fibularis longus',
    wikiSearchTitleAr: 'عضلة شظوية طويلة',
    summaryEn: 'Superficial lateral crural evertor whose long tendon curves beneath the cuboid and across the plantar vault to the first ray.',
    summaryAr: 'عضلة المسكن الوحشي السطحية في الساق، يلتف وترها أسفل القدم لدعم قوس القدم.',
    primaryFunctionEn: 'Everts the foot and maintains transverse plantar arch integrity during gait push-off.',
    primaryFunctionAr: 'شنف القدم (انقلاب للخارج) ودعم قوسي القدم العرضي والطولي.',
    arterialSupply: 'Anterior tibial & fibular (peroneal) muscular branches',
    venousDrainage: 'Fibular & anterior tibial veins -> Popliteal vein',
    innervation: 'Superficial fibular (peroneal) nerve (L5, S1, S2)',
    clinicalNotesEn: 'Common fibular nerve wraps directly around the fibular neck superficial to/within fibularis longus origin, risking foot drop when compressed.',
    clinicalNotesAr: 'يلتف العصب الشظوي المشترك حول عنق الشظية عند منشئها ما يعرضه للانضغاط وهبوط القدم.',
  },
  supraspinatus: {
    key: 'supraspinatus',
    cleanNameEn: 'Supraspinatus Muscle',
    cleanNameAr: 'العضلة فوق الشوكة',
    latinName: 'Musculus supraspinatus',
    ta98Code: 'A04.6.02.006',
    fmaId: 'FMA:32544',
    system: 'muscular',
    region: 'Shoulder (Rotator Cuff)',
    origin: 'Supraspinous fossa of scapula',
    insertion: 'Superior facet of greater tubercle of humerus',
    action: 'Initiates glenohumeral abduction (first 0–15°) and compresses the humeral head into the glenoid cavity',
    wikiSearchTitleEn: 'Supraspinatus muscle',
    wikiSearchTitleAr: 'عضلة فوق الشوكة',
    summaryEn: 'Superior rotator cuff muscle passing beneath the acromion and coracoacromial ligament to insert onto the greater humeral tubercle.',
    summaryAr: 'إحدى عضلات الكفة المدورة الأربع، تمر تحت الناتئ الأخرمي نحو الحديبة الكبيرة للعضد.',
    primaryFunctionEn: 'Initiates arm abduction (0–15°) before deltoid takeover and stabilizes the humeral head inside the glenoid.',
    primaryFunctionAr: 'بدء تبعيد الذراع (أول 15 درجة) وتثبيت رأس العضد في الجوف الحقاني.',
    arterialSupply: 'Suprascapular artery (from thyrocervical trunk)',
    venousDrainage: 'Suprascapular vein -> Subclavian vein',
    innervation: 'Suprascapular nerve (C5, C6)',
    clinicalNotesEn: 'The most frequently torn rotator cuff tendon due to subacromial impingement and a relative watershed hypovascular zone ~1 cm proximal to insertion.',
    clinicalNotesAr: 'أكثر أوتار الكفة المدورة تعرضاً للتمزق ومتلازمة الانحشار تحت الأخرم.',
  },
  infraspinatus: {
    key: 'infraspinatus',
    cleanNameEn: 'Infraspinatus Muscle',
    cleanNameAr: 'العضلة تحت الشوكة',
    latinName: 'Musculus infraspinatus',
    ta98Code: 'A04.6.02.008',
    fmaId: 'FMA:32546',
    system: 'muscular',
    region: 'Shoulder (Rotator Cuff)',
    origin: 'Infraspinous fossa of scapula',
    insertion: 'Middle facet of greater tubercle of humerus',
    action: 'Externally (laterally) rotates the humerus and stabilizes the glenohumeral joint',
    wikiSearchTitleEn: 'Infraspinatus muscle',
    wikiSearchTitleAr: 'عضلة تحت الشوكة',
    summaryEn: 'Thick triangular posterior rotator cuff muscle filling the infraspinous fossa.',
    summaryAr: 'عضلة مثلثة في الحفرة تحت الشوكة بالكتف تعمل كمُدَوِّر وحشي رئيسي للعضد.',
    primaryFunctionEn: 'Powerfully laterally rotates the arm and prevents posterior humeral translation.',
    primaryFunctionAr: 'التدوير الوحشي (الخارجي) للذراع وتثبيت مفصل الكتف.',
    arterialSupply: 'Suprascapular & circumflex scapular arteries',
    venousDrainage: 'Suprascapular & subscapular veins',
    innervation: 'Suprascapular nerve (C5, C6)',
    clinicalNotesEn: 'Spinoglenoid notch paralabral cysts selectively denervate infraspinatus while sparing supraspinatus.',
    clinicalNotesAr: 'انضغاط العصب فوق الكتف عند الثلمة الشوكية الحقانية يضمر هذه العضلة وحدها.',
  },
  subscapularis: {
    key: 'subscapularis',
    cleanNameEn: 'Subscapularis Muscle',
    cleanNameAr: 'العضلة تحت الكتف',
    latinName: 'Musculus subscapularis',
    ta98Code: 'A04.6.02.012',
    fmaId: 'FMA:13413',
    system: 'muscular',
    region: 'Shoulder / Posterior Axillary Wall (Rotator Cuff)',
    origin: 'Subscapular fossa (anterior costal surface of scapula)',
    insertion: 'Lesser tubercle of humerus',
    action: 'Internally (medially) rotates and adducts the humerus; stabilizes anterior glenohumeral capsule',
    wikiSearchTitleEn: 'Subscapularis muscle',
    wikiSearchTitleAr: 'عضلة تحت الكتف',
    summaryEn: 'Largest and sole anterior rotator cuff muscle, forming most of the posterior wall of the axilla.',
    summaryAr: 'أكبر عضلات الكفة المدورة والعضلة الأمامية الوحيدة فيها، وتشكّل الجدار الخلفي للإبط.',
    primaryFunctionEn: 'Internally rotates the arm and resists anterior shoulder dislocation.',
    primaryFunctionAr: 'التدوير الإنسي للعضد ومنع خلع الكتف الأمامي.',
    arterialSupply: 'Subscapular & lateral thoracic arteries',
    venousDrainage: 'Subscapular vein -> Axillary vein',
    innervation: 'Upper and lower subscapular nerves (C5, C6, posterior cord of brachial plexus)',
    clinicalNotesEn: 'Tested clinically via Gerber lift-off and belly-press tests for subscapularis tendon integrity.',
    clinicalNotesAr: 'تُفحص سلامة وترها سريرياً باختباري Lift-off و Belly-press.',
  },
  'teres major': {
    key: 'teres major',
    cleanNameEn: 'Teres Major Muscle',
    cleanNameAr: 'العضلة المدورة الكبيرة',
    latinName: 'Musculus teres major',
    ta98Code: 'A04.6.02.011',
    fmaId: 'FMA:32549',
    system: 'muscular',
    region: 'Posterior Scapular / Axillary Fold',
    origin: 'Posterior surface of inferior angle of scapula',
    insertion: 'Medial lip of intertubercular sulcus of humerus',
    action: 'Adducts and medially rotates the humerus ("latissimus dorsi’s little helper")',
    wikiSearchTitleEn: 'Teres major muscle',
    wikiSearchTitleAr: 'عضلة مدورة كبيرة',
    summaryEn: 'Thick rounded muscle bounding the posterior axillary fold and forming the inferior border of the quadrangular space.',
    summaryAr: 'عضلة سميكة تشارك في الطية الإبطية الخلفية وتحد المسافة المربعة من الأسفل.',
    primaryFunctionEn: 'Adducts and internally rotates the arm alongside latissimus dorsi.',
    primaryFunctionAr: 'تقريب العضد وتدويره للداخل.',
    arterialSupply: 'Circumflex scapular artery (subscapular branch)',
    venousDrainage: 'Subscapular vein -> Axillary vein',
    innervation: 'Lower subscapular nerve (C5, C6)',
    clinicalNotesEn: 'Not part of the rotator cuff; delineates the quadrangular (axillary nerve) and triangular spaces.',
    clinicalNotesAr: 'ليست من عضلات الكفة المدورة، وتحد المسافة المربعة التي يمر بها العصب الإبطي.',
  },
  brachialis: {
    key: 'brachialis',
    cleanNameEn: 'Brachialis Muscle',
    cleanNameAr: 'العضلة العضدية',
    latinName: 'Musculus brachialis',
    ta98Code: 'A04.6.02.018',
    fmaId: 'FMA:37670',
    system: 'muscular',
    region: 'Anterior Compartment of Arm',
    origin: 'Distal half of anterior surface of humerus & intermuscular septa',
    insertion: 'Coronoid process and tuberosity of ulna',
    action: 'Primary pure flexor of the forearm at the elbow in all forearm positions (pronated, neutral, or supinated)',
    wikiSearchTitleEn: 'Brachialis muscle',
    wikiSearchTitleAr: 'عضلة عضدية',
    summaryEn: 'Deep anterior brachial muscle lying directly beneath biceps brachii and generating the greatest cross-sectional elbow flexion torque.',
    summaryAr: 'العضلة المثنية الرئيسية النقية للمرفق في كل أوضاع الساعد، تقع عميقاً خلف ذات الرأسين.',
    primaryFunctionEn: 'Pure elbow flexor independent of radioulnar pronation or supination.',
    primaryFunctionAr: 'الثني الصرف لمفصل المرفق بغض النظر عن كبّ الساعد أو استلقائه.',
    arterialSupply: 'Brachial, radial recurrent & muscular branches',
    venousDrainage: 'Brachial venae comitantes -> Axillary vein',
    innervation: 'Musculocutaneous nerve (C5, C6) medially; small lateral proprioceptive branch from radial nerve (C7)',
    clinicalNotesEn: 'Dual nerve supply (musculocutaneous + radial) reflects fusion of ventral and dorsal myotomes; prone to heterotopic myositis ossificans after supracondylar elbow trauma.',
    clinicalNotesAr: 'تستمد تعصيباً مزدوجاً وتُعد موقعاً معروفاً لتعظم العضل الرضي بعد رضوض المرفق.',
  },
  brachioradialis: {
    key: 'brachioradialis',
    cleanNameEn: 'Brachioradialis Muscle',
    cleanNameAr: 'العضلة العضدية الكعبرية',
    latinName: 'Musculus brachioradialis',
    ta98Code: 'A04.6.02.040',
    fmaId: 'FMA:38485',
    system: 'muscular',
    region: 'Posterior/Lateral Forearm Compartment (Cubital Border)',
    origin: 'Proximal two-thirds of lateral supracondylar ridge of humerus',
    insertion: 'Lateral surface of distal radius just proximal to styloid process',
    action: 'Flexes the forearm at the elbow most effectively when the forearm is in mid-pronation ("hammer position")',
    wikiSearchTitleEn: 'Brachioradialis',
    wikiSearchTitleAr: 'عضلة عضدية كعبرية',
    summaryEn: 'Fusiform lateral forearm muscle forming the lateral wall of the cubital fossa and paradoxically innervated by the radial nerve despite flexing the elbow.',
    summaryAr: 'عضلة وحشية في الساعد تشكّل الحد الوحشي للحفرة المرفقية وتعصَّب بالعصب الكعبري رغم قيامها بالثني.',
    primaryFunctionEn: 'Flexes the elbow in mid-pronated neutral position and stabilizes rapid flexion.',
    primaryFunctionAr: 'ثني المرفق بفعالية قصوى في الوضع المتوسط للساعد.',
    arterialSupply: 'Radial recurrent artery & muscular branches of radial/brachial arteries',
    venousDrainage: 'Radial venae comitantes & cephalic vein',
    innervation: 'Radial nerve (C5, C6) prior to its bifurcation',
    clinicalNotesEn: 'Tapping its distal radial tendon elicits the brachioradialis (C6) deep tendon reflex.',
    clinicalNotesAr: 'نقر وترها القاصي يختبر منعكس الجذر العصبي الرقبي السادس (C6).',
  },
  'pronator teres': {
    key: 'pronator teres',
    cleanNameEn: 'Pronator Teres Muscle',
    cleanNameAr: 'العضلة الكابة المدورة',
    latinName: 'Musculus pronator teres',
    ta98Code: 'A04.6.02.025',
    fmaId: 'FMA:38450',
    system: 'muscular',
    region: 'Superficial Anterior Compartment of Forearm',
    origin: 'Medial epicondyle of humerus (humeral head) & coronoid process of ulna (ulnar head)',
    insertion: 'Middle convexity of lateral surface of radius',
    action: 'Pronates the forearm at the radioulnar joints and assists elbow flexion',
    wikiSearchTitleEn: 'Pronator teres muscle',
    wikiSearchTitleAr: 'عضلة كابة مدورة',
    summaryEn: 'Oblique superficial forearm flexor forming the medial boundary of the cubital fossa.',
    summaryAr: 'عضلة سطحية مائلة في الساعد تحد الحفرة المرفقية إنسياً وتقوم بكبّ الساعد.',
    primaryFunctionEn: 'Pronates the forearm and assists elbow flexion.',
    primaryFunctionAr: 'كب الساعد (تدوير راحة اليد للأسفل) والمساعدة في ثني المرفق.',
    arterialSupply: 'Ulnar & brachial arteries (anterior ulnar recurrent branch)',
    venousDrainage: 'Ulnar & brachial venae comitantes',
    innervation: 'Median nerve (C6, C7)',
    clinicalNotesEn: 'The median nerve passes directly between its humeral and ulnar heads; hypertrophy compresses it in pronator teres syndrome.',
    clinicalNotesAr: 'يمر العصب الناصف بين رأسيها وقد ينضغط في متلازمة الكابة المدورة.',
  },
  'pectoralis minor': {
    key: 'pectoralis minor',
    cleanNameEn: 'Pectoralis Minor Muscle',
    cleanNameAr: 'العضلة الصدرية الصغيرة',
    latinName: 'Musculus pectoralis minor',
    ta98Code: 'A04.4.01.006',
    fmaId: 'FMA:13109',
    system: 'muscular',
    region: 'Anterior Thoracic Wall & Axilla',
    origin: 'Anterior surfaces of ribs 3–5 near costal cartilages',
    insertion: 'Medial border and superior surface of coracoid process of scapula',
    action: 'Stabilizes, depresses, and protracts the scapula; assists forced inspiration when scapula is fixed',
    wikiSearchTitleEn: 'Pectoralis minor muscle',
    wikiSearchTitleAr: 'عضلة صدرية صغيرة',
    summaryEn: 'Thin triangular deep pectoral muscle dividing the underlying axillary artery into three anatomical parts.',
    summaryAr: 'عضلة مثلثة عميقة تحت الصدرية الكبيرة وتُعد المعلم الذي يقسم الشريان الإبطي لثلاثة أجزاء.',
    primaryFunctionEn: 'Stabilizes the scapula against the thoracic wall and draws the coracoid anteriorly and inferiorly.',
    primaryFunctionAr: 'خفض وتثبيت لوح الكتف وسحبه للأمام والأسفل.',
    arterialSupply: 'Pectoral branch of thoracoacromial trunk & lateral thoracic artery',
    venousDrainage: 'Thoracoacromial & lateral thoracic veins -> Axillary vein',
    innervation: 'Medial pectoral nerve (C8, T1)',
    clinicalNotesEn: 'Anatomical surgical landmark dividing the axillary artery into parts I, II, and III and a site of neurovascular compression in pectoralis minor syndrome.',
    clinicalNotesAr: 'معلم جراحي رئيسي لتقسيم الشريان الإبطي وموضع محتمل لانضغاط الضفيرة العضدية.',
  },
  'rhomboid major': {
    key: 'rhomboid major',
    cleanNameEn: 'Rhomboid Major & Minor Muscles',
    cleanNameAr: 'العضلة المعينية الكبيرة والصغيرة',
    latinName: 'Musculus rhomboideus major et minor',
    ta98Code: 'A04.3.01.008',
    fmaId: 'FMA:13379',
    system: 'muscular',
    region: 'Superficial Extrinsic Back',
    origin: 'Spinous processes of T2–T5 (major) & nuchal ligament/C7–T1 spines (minor)',
    insertion: 'Medial border of scapula from scapular spine to inferior angle',
    action: 'Retracts, elevates, and downwardly rotates the scapula, bracing it firmly to the thoracic cage',
    wikiSearchTitleEn: 'Rhomboid major muscle',
    wikiSearchTitleAr: 'عضلة معينية كبيرة',
    summaryEn: 'Parallel deep-to-trapezius dorsal muscles slanting from thoracic spinous processes to the medial scapular border.',
    summaryAr: 'عضلتان معينيتان تقعان عميقاً تحت شبه المنحرفة وتثبتان لوح الكتف بالعمود الفقري.',
    primaryFunctionEn: 'Retracts the scapula toward the midline spine and rotates the glenoid inferiorly.',
    primaryFunctionAr: 'تقريب لوح الكتف نحو الخط الناصف وتدويره للأسفل.',
    arterialSupply: 'Dorsal scapular artery',
    venousDrainage: 'Dorsal scapular vein -> Subclavian vein',
    innervation: 'Dorsal scapular nerve (C4, C5)',
    clinicalNotesEn: 'Forms the floor/medial border of the Triangle of Auscultation; weakness contributes to lateral scapular winging.',
    clinicalNotesAr: 'تشكّل قاعدة مثلث الإصغاء وتشارك في تثبيت لوح الكتف.',
  },
  'levator scapulae': {
    key: 'levator scapulae',
    cleanNameEn: 'Levator Scapulae Muscle',
    cleanNameAr: 'العضلة رافعة الكتف',
    latinName: 'Musculus levator scapulae',
    ta98Code: 'A04.3.01.007',
    fmaId: 'FMA:13385',
    system: 'muscular',
    region: 'Posterior Triangle of Neck & Upper Back',
    origin: 'Posterior tubercles of transverse processes of C1–C4',
    insertion: 'Medial border of scapula superior to root of scapular spine',
    action: 'Elevates the scapula and tilts the glenoid cavity inferiorly by downward scapular rotation',
    wikiSearchTitleEn: 'Levator scapulae muscle',
    wikiSearchTitleAr: 'عضلة رافعة الكتف',
    summaryEn: 'Strap-like muscle descending from C1–C4 transverse processes under sternocleidomastoid and trapezius to the superior scapular angle.',
    summaryAr: 'عضلة تمتد من الفقرات الرقبية العلوية الأربع إلى الزاوية العلوية للوح الكتف.',
    primaryFunctionEn: 'Elevates the scapula and laterally flexes the cervical spine when the shoulder is fixed.',
    primaryFunctionAr: 'رفع لوح الكتف وإمالة العنق جانبياً عند ثبات الكتف.',
    arterialSupply: 'Dorsal scapular, transverse cervical & ascending cervical arteries',
    venousDrainage: 'Dorsal scapular & transverse cervical veins',
    innervation: 'Dorsal scapular nerve (C5) & cervical nerves (C3, C4)',
    clinicalNotesEn: 'Frequent source of myofascial trigger points causing stiff neck and superior scapular angle pain.',
    clinicalNotesAr: 'مصدر شائع لآلام وتيبس الرقبة والزاوية العلوية للكتف.',
  },
  'erector spinae': {
    key: 'erector spinae',
    cleanNameEn: 'Erector Spinae Muscle Group',
    cleanNameAr: 'العضلة الناصبة للفقار',
    latinName: 'Musculus erector spinae',
    ta98Code: 'A04.3.02.002',
    fmaId: 'FMA:71302',
    system: 'muscular',
    region: 'Intrinsic Deep Back',
    origin: 'Sacrum, iliac crest, sacroiliac ligaments & T11–L5 spinous processes (common aponeurosis)',
    insertion: 'Angles of ribs, thoracic/cervical transverse & spinous processes and mastoid/occipital bone (Iliocostalis, Longissimus, Spinalis)',
    action: 'Bilateral spinal and head extension; unilateral lateral flexion of vertebral column',
    wikiSearchTitleEn: 'Erector spinae muscles',
    wikiSearchTitleAr: 'عضلة ناصبة للفقار',
    summaryEn: 'Chief paraspinal column extensor complex arranged lateral-to-medial as iliocostalis, longissimus, and spinalis ("I Love Spine").',
    summaryAr: 'المجموعة العضلية العميقة الرئيسية المسؤولة عن انتصاب العمود الفقري (الحرقفية الضلعية، الطولى، الشوكية).',
    primaryFunctionEn: 'Maintains erect bipedal spinal posture and controls eccentric forward trunk flexion.',
    primaryFunctionAr: 'الحفاظ على انتصاب العمود الفقري وبسطه ومقاومة السقوط للأمام.',
    arterialSupply: 'Posterior branches of posterior intercostal, lumbar & lateral sacral arteries',
    venousDrainage: 'External vertebral venous plexus -> Azygos & lumbar veins',
    innervation: 'Posterior (dorsal) rami of spinal nerves across corresponding segments',
    clinicalNotesEn: 'Paraspinal spasm splints the lumbar spine in disc herniation and acute lumbago.',
    clinicalNotesAr: 'تشنجها الانعكاسي يرافق آلام أسفل الظهر وانفتاق الأقراص بين الفقرات.',
  },
  'internal oblique': {
    key: 'internal oblique',
    cleanNameEn: 'Internal Abdominal Oblique',
    cleanNameAr: 'العضلة المائلة البطنية الباطنة',
    latinName: 'Musculus obliquus internus abdominis',
    ta98Code: 'A04.5.01.017',
    fmaId: 'FMA:13336',
    system: 'muscular',
    region: 'Anterolateral Abdominal Wall',
    origin: 'Thoracolumbar fascia, anterior iliac crest & lateral half of inguinal ligament',
    insertion: 'Inferior borders of ribs 10–12, linea alba & conjoint tendon to pubic crest',
    action: 'Compresses abdominal viscera, flexes trunk and rotates torso ipsilaterally',
    wikiSearchTitleEn: 'Abdominal internal oblique muscle',
    wikiSearchTitleAr: 'عضلة مائلة بطنية باطنة',
    summaryEn: 'Intermediate abdominal wall muscular sheet whose fibers fan superomedially perpendicular to external oblique and contribute to the conjoint tendon and cremaster muscle.',
    summaryAr: 'الطبقة العضلية المتوسطة لجدار البطن، تتجه أليافها للأعلى والإنسى وتشارك في تكوين الوتر المشترك والعضلة المشمرة.',
    primaryFunctionEn: 'Compresses abdominal contents, supports forced expiration, and turns trunk ipsilaterally.',
    primaryFunctionAr: 'دعم أحشاء البطن وتدوير الجذع إلى نفس الجهة.',
    arterialSupply: 'Subcostal, inferior epigastric & deep circumflex iliac arteries',
    venousDrainage: 'Inferior epigastric & lumbar veins',
    innervation: 'Thoracoabdominal (T7–T11), subcostal (T12) & iliohypogastric/ilioinguinal nerves (L1)',
    clinicalNotesEn: 'Forms the conjoint tendon (falx inguinalis) with transversus abdominis, reinforcing the medial posterior inguinal canal wall.',
    clinicalNotesAr: 'تتحد مع المستعرضة البطنية لتشكيل الوتر المشترك الحامي لجدار القناة الإربية الخلفي.',
  },
  'transversus abdominis': {
    key: 'transversus abdominis',
    cleanNameEn: 'Transversus Abdominis',
    cleanNameAr: 'العضلة المستعرضة البطنية',
    latinName: 'Musculus transversus abdominis',
    ta98Code: 'A04.5.01.019',
    fmaId: 'FMA:15570',
    system: 'muscular',
    region: 'Anterolateral Abdominal Wall',
    origin: 'Internal surfaces of costal cartilages 7–12, thoracolumbar fascia, iliac crest & lateral inguinal ligament',
    insertion: 'Linea alba, pubic crest & pecten pubis via conjoint tendon',
    action: 'Acts as a circumferential abdominal corset compressing and supporting intra-abdominal viscera',
    wikiSearchTitleEn: 'Transverse abdominal muscle',
    wikiSearchTitleAr: 'عضلة بطنية مستعرضة',
    summaryEn: 'Deepest horizontal muscular layer of the anterolateral abdominal wall; the transversus abdominis plane (TAP) separates it from internal oblique.',
    summaryAr: 'أعمق طبقات جدار البطن العضلية ذات الألياف الأفقية، وتعمل كحزام ضاغط طبيعي للأحشاء.',
    primaryFunctionEn: 'Increases intra-abdominal pressure and stabilizes lumbar spine stiffness prior to limb movement.',
    primaryFunctionAr: 'ضغط أحشاء البطن وتثبيت العمود الفقري القطني.',
    arterialSupply: 'Deep circumflex iliac, inferior epigastric & posterior intercostal arteries',
    venousDrainage: 'Inferior epigastric & deep circumflex iliac veins',
    innervation: 'Thoracoabdominal (T7–T11), subcostal (T12) & L1 nerves traversing the TAP plane',
    clinicalNotesEn: 'Ultrasound-guided TAP nerve block injects local anesthetic between internal oblique and transversus abdominis for abdominal wall analgesia.',
    clinicalNotesAr: 'تُجرى حقنة التخدير الموضعي لجدار البطن (TAP block) في المستوى الفاصل بينها وبين المائلة الباطنة.',
  },
  platysma: {
    key: 'platysma',
    cleanNameEn: 'Platysma Muscle',
    cleanNameAr: 'العضلة المبطحة للعنق',
    latinName: 'Platysma',
    ta98Code: 'A04.2.01.001',
    fmaId: 'FMA:45738',
    system: 'muscular',
    region: 'Superficial Cervical Fascia (Subcutaneous Neck)',
    origin: 'Subcutaneous fascia over superior parts of pectoralis major and deltoid',
    insertion: 'Base of mandible, skin of cheek, lower lip and angle of mouth',
    action: 'Draws corners of mouth inferiorly, widens mouth aperture (grimace) and tenses anterior neck skin',
    wikiSearchTitleEn: 'Platysma muscle',
    wikiSearchTitleAr: 'عضلة مبطحة',
    summaryEn: 'Broad paper-thin muscular sheet suspended within cervical superficial fascia overlying the external jugular vein and supraclavicular nerves.',
    summaryAr: 'صفيحة عضلية رقيقة سطحية في الرقبة تغطي الوريد الوداجي الظاهر وتسهم في تعابير الوجه.',
    primaryFunctionEn: 'Tenses anterior neck skin and depresses mandible and labial commissures.',
    primaryFunctionAr: 'شد جلد العنق الأمامي وخفض الفك وزاوية الفم.',
    arterialSupply: 'Submental (facial) & suprascapular arteries',
    venousDrainage: 'External & anterior jugular veins',
    innervation: 'Cervical branch of facial nerve (CN VII)',
    clinicalNotesEn: 'Surgeons verify wound depth in penetrating neck trauma by whether the injury violates the platysma.',
    clinicalNotesAr: 'اختراق العضلة المبطحة هو الفاصل السريري لتصنيف جروح الرقبة النافذة.',
  },
  buccinator: {
    key: 'buccinator',
    cleanNameEn: 'Buccinator Muscle',
    cleanNameAr: 'العضلة المبوقة',
    latinName: 'Musculus buccinator',
    ta98Code: 'A04.1.03.036',
    fmaId: 'FMA:46838',
    system: 'muscular',
    region: 'Oral Cheek / Facial Expression',
    origin: 'Molar alveolar processes of maxilla and mandible & pterygomandibular raphe',
    insertion: 'Angle of mouth (modiolus) blending with orbicularis oris',
    action: 'Compresses cheeks against molar teeth during chewing, whistling, and blowing ("trumpeter muscle")',
    wikiSearchTitleEn: 'Buccinator muscle',
    wikiSearchTitleAr: 'عضلة مبوقة',
    summaryEn: 'Deep muscular wall of the cheek pierced opposite the upper second molar by the parotid (Stensen) duct.',
    summaryAr: 'الجدار العضلي الأساسي للخد، يخترقها مجرى الغدة النكفية مقابل الرحى العلوية الثانية.',
    primaryFunctionEn: 'Maintains food bolus between occlusal molar surfaces and expels air during blowing/sucking.',
    primaryFunctionAr: 'تثبيت اللقمة الغذائية بين الأضراس أثناء المضغ والنفخ.',
    arterialSupply: 'Buccal branch of maxillary artery & facial artery',
    venousDrainage: 'Pterygoid venous plexus & facial vein',
    innervation: 'Buccal branches of facial nerve (CN VII) — purely motor; sensory cheek mucosa is CN V3 (long buccal)',
    clinicalNotesEn: 'Facial nerve (CN VII) palsy causes food pocketing in the vestibule and drooling ("Bell palsy cheek puff failure").',
    clinicalNotesAr: 'شلل العصب الوجهي يؤدي لتجمع الطعام في دهليز الخد وصعوبة النفخ.',
  },
  'orbicularis oculi': {
    key: 'orbicularis oculi',
    cleanNameEn: 'Orbicularis Oculi Muscle',
    cleanNameAr: 'العضلة الدويرية العينية',
    latinName: 'Musculus orbicularis oculi',
    ta98Code: 'A04.1.03.013',
    fmaId: 'FMA:46779',
    system: 'muscular',
    region: 'Orbital & Periorbital Region',
    origin: 'Medial orbital margin, medial palpebral ligament & lacrimal bone',
    insertion: 'Skin around orbital margin, lateral palpebral raphe & tarsal plates',
    action: 'Palpebral portion blinks gently; orbital portion tightly shuts eyelids in protective squinting; lacrimal part assists tear drainage',
    wikiSearchTitleEn: 'Orbicularis oculi muscle',
    wikiSearchTitleAr: 'عضلة دويرية عينية',
    summaryEn: 'Concentric sphincter muscle encircling the orbital rim and eyelids across orbital, palpebral, and deep lacrimal subdivisions.',
    summaryAr: 'عضلة عاصرة حلقية تحيط بمحجر العين والجفون وتتحكم بإغلاق العين والرمش وتصريف الدمع.',
    primaryFunctionEn: 'Closes the eyelids cleanly during corneal blinking reflex and forced squeezing.',
    primaryFunctionAr: 'إغلاق الجفنين وحماية القرنية خلال منعكس الرمش.',
    arterialSupply: 'Facial, superficial temporal & ophthalmic arteries',
    venousDrainage: 'Facial, superior ophthalmic & superficial temporal veins',
    innervation: 'Temporal & zygomatic branches of facial nerve (CN VII)',
    clinicalNotesEn: 'Paralysis (Bell palsy) prevents eyelid closure (lagophthalmos), risking exposure keratitis.',
    clinicalNotesAr: 'شللها يمنع إغلاق الجفن ويعرض القرنية للجفاف والتقرح.',
  },
  'orbicularis oris': {
    key: 'orbicularis oris',
    cleanNameEn: 'Orbicularis Oris Muscle',
    cleanNameAr: 'العضلة الدويرية الفموية',
    latinName: 'Musculus orbicularis oris',
    ta98Code: 'A04.1.03.023',
    fmaId: 'FMA:46841',
    system: 'muscular',
    region: 'Oral Lips',
    origin: 'Modiolus at angle of mouth, maxilla/mandible near midline & blending facial muscles',
    insertion: 'Mucous membrane and skin of upper and lower lips',
    action: 'Closes, compresses, and protrudes the lips during articulation, swallowing, and whistling',
    wikiSearchTitleEn: 'Orbicularis oris muscle',
    wikiSearchTitleAr: 'عضلة دويرية فموية',
    summaryEn: 'Multi-layered oral sphincter encircling the mouth aperture and serving as insertion hub for surrounding facial expression muscles.',
    summaryAr: 'العضلة العاصرة الحلقية للفم والمسؤولة عن إغلاق الشفتين والنطق والمص.',
    primaryFunctionEn: 'Maintains oral competence, articulates bilabial phonemes, and purses the lips.',
    primaryFunctionAr: 'إحكام إغلاق الفم والنطق والمص والصفير.',
    arterialSupply: 'Superior and inferior labial arteries (facial artery branches)',
    venousDrainage: 'Labial veins -> Facial vein',
    innervation: 'Buccal & marginal mandibular branches of facial nerve (CN VII)',
    clinicalNotesEn: 'Discontinuity across its circumferential ring requires meticulous vermilion border repair in cleft lip surgery.',
    clinicalNotesAr: 'يتطلب انقطاعها الخلقي في الشفة الأرنبية ترميماً جراحياً دقيقاً لاستعادة الوظيفة.',
  },
  calcaneus: {
    key: 'calcaneus',
    cleanNameEn: 'Calcaneus (Heel Bone)',
    cleanNameAr: 'عظم العقب (الكعب)',
    latinName: 'Calcaneus',
    ta98Code: 'A02.5.11.001',
    fmaId: 'FMA:24497',
    system: 'skeletal',
    region: 'Hindfoot (Tarsus)',
    wikiSearchTitleEn: 'Calcaneus',
    wikiSearchTitleAr: 'عظم العقب',
    summaryEn: 'Largest and strongest tarsal bone forming the heel prominence, supporting the talus via the sustentaculum tali and articulating anteriorly with the cuboid.',
    summaryAr: 'أكبر وأقوى عظام الرصغ، يشكّل بروز الكعب الخلفي ويدعم عظم القعب ويرتكز عليه وتر أخيل.',
    primaryFunctionEn: 'Bears initial heel-strike ground reaction load and provides a posterior lever arm for triceps surae plantarflexion.',
    primaryFunctionAr: 'تحمل صدمة ارتطام الكعب بالأرض والعمل كعتلة لعضلات الربلة.',
    arterialSupply: 'Posterior tibial, lateral calcaneal & medial tarsal arteries',
    venousDrainage: 'Plantar & dorsal venous arches -> Saphenous and tibial veins',
    innervation: 'Tibial (medial calcaneal) & sural periosteal nerves',
    clinicalNotesEn: 'Axial loading from falls onto the feet fractures the calcaneus (flattened Böhler angle <20°) and may trigger compartment syndrome.',
    clinicalNotesAr: 'السقوط من علو على القدمين يسبب كسر العقب وتناقص زاوية بوهلر (Böhler angle).',
  },
  talus: {
    key: 'talus',
    cleanNameEn: 'Talus (Ankle Bone)',
    cleanNameAr: 'عظم القعب',
    latinName: 'Talus',
    ta98Code: 'A02.5.10.001',
    fmaId: 'FMA:9708',
    system: 'skeletal',
    region: 'Hindfoot / Ankle Mortise',
    wikiSearchTitleEn: 'Talus bone',
    wikiSearchTitleAr: 'عظم القعب',
    summaryEn: 'Second largest tarsal bone lacking any muscular insertions, transmitting total body weight from the tibiofibular mortise to the calcaneus and navicular.',
    summaryAr: 'ثاني أكبر عظام الرصغ ولا يرتكز عليه أي وتر عضلي، وينقل كامل وزن الجسم من الساق إلى القدم.',
    primaryFunctionEn: 'Forms the talocrural (ankle hinge), subtalar, and talonavicular joints governing dorsiflexion, plantarflexion, inversion, and eversion.',
    primaryFunctionAr: 'تشكيل مفصل الكاحل وتوزيع وزن الجسم على عظام القدم.',
    arterialSupply: 'Artery of the tarsal canal (posterior tibial) & artery of sinus tarsi (peroneal/dorsalis pedis)',
    venousDrainage: 'Deep tibial & dorsalis pedis venous plexuses',
    innervation: 'Tibial & deep fibular articular branches',
    clinicalNotesEn: 'Retrograde blood supply across the talar neck creates high risk of avascular necrosis (Hawkins sign absence) after displaced talar neck fractures.',
    clinicalNotesAr: 'ترويته الرجعية عبر عنق القعب تجعل كسوره عرضة لنخر العظم اللاوعائي.',
  },
  'phrenic nerve': {
    key: 'phrenic nerve',
    cleanNameEn: 'Phrenic Nerve (C3–C5)',
    cleanNameAr: 'العصب الحجابي',
    latinName: 'Nervus phrenicus',
    ta98Code: 'A14.2.02.029',
    fmaId: 'FMA:5453',
    system: 'nervous',
    region: 'Neck, Mediastinum & Diaphragm',
    wikiSearchTitleEn: 'Phrenic nerve',
    wikiSearchTitleAr: 'عصب حجابي',
    summaryEn: 'Mixed nerve arising chiefly from C4 (with C3 and C5 contributions) descending across anterior scalene and anterior to pulmonary hila alongside pericardiacophrenic vessels to supply the diaphragm.',
    summaryAr: 'عصب مختلط ينشأ من الجذور الرقبية C3–C5 ويهبط عبر العنق والمنصف ليعصب الحجاب الحاجز.',
    primaryFunctionEn: 'Sole motor innervation to the thoracic diaphragm ("C3, 4, 5 keeps the diaphragm alive") plus sensory supply to mediastinal pleura, fibrous pericardium, and central diaphragmatic peritoneum.',
    primaryFunctionAr: 'التعصيب الحركي الوحيد للحجاب الحاجز والتعصيب الحسي للتأمور والجنبة الحجابية.',
    arterialSupply: 'Pericardiacophrenic & ascending cervical arteries (vasa nervorum)',
    venousDrainage: 'Pericardiacophrenic veins -> Internal thoracic veins',
    innervation: 'Cervical spinal roots C3, C4 (dominant), and C5 (motor & sensory)',
    clinicalNotesEn: 'Diaphragmatic irritation (e.g., subphrenic abscess or splenic rupture) refers pain via C3–C5 supraclavicular nerves to the ipsilateral shoulder tip (Kehr sign).',
    clinicalNotesAr: 'تهيج الحجاب الحاجز يُحيل الألم إلى قمة الكتف عبر نفس الجذور العصبية C3–C5 (علامة كير).',
  },
  'median nerve': {
    key: 'median nerve',
    cleanNameEn: 'Median Nerve',
    cleanNameAr: 'العصب الناصف',
    latinName: 'Nervus medianus',
    ta98Code: 'A14.2.03.031',
    fmaId: 'FMA:37067',
    system: 'nervous',
    region: 'Brachial Plexus -> Forearm -> Hand',
    wikiSearchTitleEn: 'Median nerve',
    wikiSearchTitleAr: 'عصب ناصف',
    summaryEn: 'Mixed peripheral nerve formed from lateral (C5–C7) and medial (C8–T1) cords of the brachial plexus, traversing arm, cubital fossa, pronator teres, and carpal tunnel.',
    summaryAr: 'عصب مختلط يتشكل من الحبلين الوحشي والإنسي للضفيرة العضدية ويمر عبر نفق الرسغ إلى اليد.',
    primaryFunctionEn: 'Innervates anterior forearm flexors/pronators (except FCU & medial FDP), thenar eminence (LOAF), and palmar sensation of lateral 3.5 digits.',
    primaryFunctionAr: 'تعصيب معظم قابضات الساعد وكاباته وعضلات ألية الإبهام وحس الأصابع الثلاثة والنصف الوحشية.',
    arterialSupply: 'Median artery (persistent/recurrent) & brachial/radial vasa nervorum',
    venousDrainage: 'Accompanying forearm & brachial venae comitantes',
    innervation: 'Brachial plexus roots C5–T1 (predominantly C6–T1)',
    clinicalNotesEn: 'Compression under the flexor retinaculum causes Carpal Tunnel Syndrome; supracondylar fracture injury impairs thumb opposition ("ape hand").',
    clinicalNotesAr: 'انضغاطه تحت قيد القابضات يسبب متلازمة النفق الرسغي وتنميل الإبهام والسبابة والوسطى.',
  },
  'ulnar nerve': {
    key: 'ulnar nerve',
    cleanNameEn: 'Ulnar Nerve',
    cleanNameAr: 'العصب الزندي',
    latinName: 'Nervus ulnaris',
    ta98Code: 'A14.2.03.039',
    fmaId: 'FMA:37069',
    system: 'nervous',
    region: 'Arm, Cubital Tunnel & Hand',
    wikiSearchTitleEn: 'Ulnar nerve',
    wikiSearchTitleAr: 'عصب زندي',
    summaryEn: 'Terminal branch of the medial cord (C8–T1) curving posteriorly behind the medial humeral epicondyle ("funny bone") before entering the hand via Guyon canal.',
    summaryAr: 'الفرع الانتهائي للحبل الإنسي للضفيرة العضدية، يمر خلف اللقيمة الإنسية للعضد ثم إلى عضلات اليد الجوهرية.',
    primaryFunctionEn: 'Innervates flexor carpi ulnaris, medial FDP, hypothenar, all interossei, adductor pollicis, and ulnar 1.5 digits.',
    primaryFunctionAr: 'تعصيب معظم عضلات اليد الدقيقة والعضلة المثنية الرسغية الزندية وحس الأصبعين الإنسيين.',
    arterialSupply: 'Superior/inferior ulnar collateral & ulnar artery vasa nervorum',
    venousDrainage: 'Ulnar & basilic venous tributaries',
    innervation: 'Medial cord of brachial plexus (C8, T1)',
    clinicalNotesEn: 'Injury behind the medial epicondyle or at Guyon canal causes ulnar claw hand deformity and Froment sign weakness.',
    clinicalNotesAr: 'إصابته تسبب اليد المخلبية الزندية وعلامة فرومنت الإيجابية.',
  },
  'radial nerve': {
    key: 'radial nerve',
    cleanNameEn: 'Radial Nerve',
    cleanNameAr: 'العصب الكعبري',
    latinName: 'Nervus radialis',
    ta98Code: 'A14.2.03.049',
    fmaId: 'FMA:37068',
    system: 'nervous',
    region: 'Axilla, Radial Groove, Forearm & Dorsum of Hand',
    wikiSearchTitleEn: 'Radial nerve',
    wikiSearchTitleAr: 'عصب كعبري',
    summaryEn: 'Largest terminal branch of the posterior cord (C5–T1) spiraling around the posterior humeral radial groove with profunda brachii vessels.',
    summaryAr: 'أكبر فروع الحبل الخلفي للضفيرة العضدية، يلتف حول الثلم الحلزوني لعظم العضد ويعصب الباسطات.',
    primaryFunctionEn: 'Innervates triceps brachii, anconeus, brachioradialis, and all posterior forearm wrist/finger extensor muscles plus dorsal hand skin.',
    primaryFunctionAr: 'تعصيب العضلة ثلاثية الرؤوس وجميع العضلات الباسطة للمرفق والرسغ والأصابع.',
    arterialSupply: 'Profunda brachii & radial recurrent vasa nervorum',
    venousDrainage: 'Profunda brachii & radial venae comitantes',
    innervation: 'Posterior cord of brachial plexus (C5–T1)',
    clinicalNotesEn: 'Midshaft humeral fracture in the radial groove lacerates or stretches the nerve causing wrist drop.',
    clinicalNotesAr: 'كسور منتصف جسم العضد تصيب العصب الكعبري وتسبب هبوط الرسغ (Wrist drop).',
  },
  'femoral nerve': {
    key: 'femoral nerve',
    cleanNameEn: 'Femoral Nerve (L2–L4)',
    cleanNameAr: 'العصب الفخذي',
    latinName: 'Nervus femoralis',
    ta98Code: 'A14.2.07.020',
    fmaId: 'FMA:16486',
    system: 'nervous',
    region: 'Lumbar Plexus -> Femoral Triangle',
    wikiSearchTitleEn: 'Femoral nerve',
    wikiSearchTitleAr: 'عصب فخذي',
    summaryEn: 'Largest branch of the lumbar plexus descending laterally to psoas major and entering the thigh lateral to the femoral sheath (N in NAVEL).',
    summaryAr: 'أكبر فروع الضفيرة القطنية، يدخل الفخذ وحشي الغمد الفخذي ويعصب رباعية الرؤوس الفخذية.',
    primaryFunctionEn: 'Provides motor innervation to iliacus, pectineus, sartorius, and quadriceps femoris, plus cutaneous sensation to anterior thigh and medial leg (saphenous nerve).',
    primaryFunctionAr: 'تعصيب مثنيات الورك وباسطات الركبة ونقل الحس عبر العصب الصافن إلى الساق الإنسية.',
    arterialSupply: 'Iliolumbar & lateral femoral circumflex vasa nervorum',
    venousDrainage: 'Femoral & external iliac veins',
    innervation: 'Posterior divisions of lumbar anterior rami L2, L3, L4',
    clinicalNotesEn: 'Femoral nerve palsy causes loss of knee extension, absent patellar jerk reflex, and buckling gait.',
    clinicalNotesAr: 'شلل العصب الفخذي يؤدي لضعف بسط الركبة وغياب المنعكس الرضفي.',
  },
  'obturator nerve': {
    key: 'obturator nerve',
    cleanNameEn: 'Obturator Nerve (L2–L4)',
    cleanNameAr: 'العصب السدادي',
    latinName: 'Nervus obturatorius',
    ta98Code: 'A14.2.07.012',
    fmaId: 'FMA:16488',
    system: 'nervous',
    region: 'Pelvis -> Obturator Canal -> Medial Thigh',
    wikiSearchTitleEn: 'Obturator nerve',
    wikiSearchTitleAr: 'عصب سدادي',
    summaryEn: 'Major medial-thigh mixed nerve formed from anterior divisions of L2–L4 descending along the lateral pelvic wall through the obturator canal.',
    summaryAr: 'العصب الرئيسي للمسكن الإنسي للفخذ، يخرج من الحوض عبر القناة السدادية.',
    primaryFunctionEn: 'Supplies medial hip adductor compartment (obturator externus, adductor longus/brevis/magnus, gracilis) and medial thigh skin.',
    primaryFunctionAr: 'تعصيب عضلات تقريب الفخذ والجلد الإنسي للفخذ ومفصل الورك.',
    arterialSupply: 'Obturator artery (internal iliac branch)',
    venousDrainage: 'Obturator vein -> Internal iliac vein',
    innervation: 'Anterior divisions of L2, L3, L4 spinal rami',
    clinicalNotesEn: 'May be irritated during pelvic tumor growth, obturator hernia, or anterior hip/urological surgery.',
    clinicalNotesAr: 'قد يتأثر بالفتق السدادي أو جراحات الحوض الجانبية مسبباً ألم الحوض الداخلي.',
  },
  'portal vein': {
    key: 'portal vein',
    cleanNameEn: 'Hepatic Portal Vein',
    cleanNameAr: 'الوريد البابي الكبدي',
    latinName: 'Vena portae hepatis',
    ta98Code: 'A12.3.12.001',
    fmaId: 'FMA:14338',
    system: 'cardiovascular',
    region: 'Abdomen (Hepatoduodenal Ligament)',
    wikiSearchTitleEn: 'Portal vein',
    wikiSearchTitleAr: 'وريد بابي كبدي',
    summaryEn: 'Valveless ~8 cm venous conduit formed behind the pancreatic neck (L1–L2) by confluence of superior mesenteric and splenic veins, delivering ~75% of hepatic blood flow.',
    summaryAr: 'الوريد الذي ينقل الدم الغني بالمغذيات من القناة الهضمية والطحال إلى الكبد بعد التقاء الوريد المساريقي العلوي والطحالي.',
    primaryFunctionEn: 'Drains nutrient-rich, hormone- and toxin-laden splanchnic venous blood from the GI tract, pancreas, gallbladder, and spleen to liver sinusoids.',
    primaryFunctionAr: 'نقل الدم المحمّل بالمغذيات والسموم من الأمعاء والطحال إلى الكبد للمعالجة والتمثيل الغذائي.',
    arterialSupply: 'Vasa vasorum from hepatic/gastroduodenal arterial branches',
    venousDrainage: 'Hepatic sinusoids -> Hepatic veins -> Inferior vena cava',
    innervation: 'Hepatic autonomic plexus (sympathetic & vagal)',
    clinicalNotesEn: 'Portal hypertension in liver cirrhosis opens portosystemic anastomoses causing esophageal varices, caput medusae, and hemorrhoids.',
    clinicalNotesAr: 'فرط ضغط الدم البابي يفتح المفاغرات البابية الجهازية مسبباً دوالي المريء ورأس الميدوسا والحبن.',
  },
  'pulmonary trunk': {
    key: 'pulmonary trunk',
    cleanNameEn: 'Pulmonary Trunk & Pulmonary Arteries',
    cleanNameAr: 'الجذع الرئوي والشرايين الرئوية',
    latinName: 'Truncus pulmonalis',
    ta98Code: 'A12.2.01.001',
    fmaId: 'FMA:8615',
    system: 'cardiovascular',
    region: 'Middle Mediastinum & Pulmonary Hila',
    wikiSearchTitleEn: 'Pulmonary artery',
    wikiSearchTitleAr: 'شريان رئوي',
    summaryEn: 'Wide arterial trunk emerging from the right ventricular conus arteriosus anterior to the ascending aorta and bifurcating beneath the aortic arch into left and right pulmonary arteries.',
    summaryAr: 'الجذع الشرياني الناشئ من البطين الأيمن والذي ينقسم أسفل قوس الأبهر إلى الشريانين الرئويين الأيمن والأيسر.',
    primaryFunctionEn: 'Carries low-pressure deoxygenated mixed venous blood from the right ventricle directly to bilateral pulmonary alveolar capillary beds for gas exchange.',
    primaryFunctionAr: 'نقل الدم غير المؤكسج من البطين الأيمن إلى الرئتين للتبادل الغازي.',
    arterialSupply: 'Vasa vasorum from bronchial & coronary arterial branches',
    venousDrainage: 'Bronchial & cardiac venous drainage',
    innervation: 'Autonomic cardiopulmonary plexus & pulmonary baroreceptors',
    clinicalNotesEn: 'Saddle pulmonary embolism obstructing the bifurcation causes acute right heart strain, obstructive shock, and cardiovascular collapse.',
    clinicalNotesAr: 'الصمة الرئوية السرجية عند تفرعه تسبب قصور قلب أيمن حاد وصدمة مهددة للحياة.',
  },
  'right ventricle': {
    key: 'right ventricle',
    cleanNameEn: 'Right Ventricle',
    cleanNameAr: 'البطين الأيمن للقلب',
    latinName: 'Ventriculus dexter cordis',
    ta98Code: 'A12.1.02.001',
    fmaId: 'FMA:7098',
    system: 'cardiovascular',
    region: 'Heart Chambers (Middle Mediastinum)',
    wikiSearchTitleEn: 'Right_ventricle',
    wikiSearchTitleAr: 'بطين_أيمن',
    summaryEn:
      'Anterior-most muscular chamber of the heart located behind the sternum, receiving deoxygenated venous blood from the right atrium through the tricuspid valve and ejecting it through the infundibulum and pulmonary valve into the pulmonary trunk.',
    summaryAr:
      'الحجرة العضلية الأمامية السفلى في الجانب الأيمن للقلب، يستقبل الدم غير المؤكسج من الأذين الأيمن عبر الصمام ثلاثي الشرفات ويضخه إلى الجذع الرئوي عبر الصمام الرئوي.',
    primaryFunctionEn:
      'Pumps low-pressure mixed venous blood through the pulmonary arterial circulation for oxygenation in the alveolar capillary beds.',
    primaryFunctionAr:
      'ضخ الدم غير المؤكسج بضغط منخفض نحو الرئتين لإتمام التبادل الغازي.',
    arterialSupply: 'Right coronary artery (right marginal branch) & LAD anterior septal branches',
    venousDrainage: 'Anterior cardiac veins & great/middle cardiac veins -> Coronary sinus',
    innervation: 'Cardiac autonomic plexus (sympathetic T1–T4 & vagus CN X) + His–Purkinje right bundle branch',
    clinicalNotesEn:
      'Right ventricular hypertrophy causes a left parasternal heave; right ventricular infarction (often accompanying inferior MI from proximal RCA occlusion) presents with hypotension, elevated JVP, and clear lung fields.',
    clinicalNotesAr:
      'تضخم البطين الأيمن يظهر برفعة يسار القص؛ واحتشاء البطين الأيمن يسبب هبوط ضغط مع احتقان وداجي ورئتين صافيتين.',
  },
  'left ventricle': {
    key: 'left ventricle',
    cleanNameEn: 'Left Ventricle',
    cleanNameAr: 'البطين الأيسر للقلب',
    latinName: 'Ventriculus sinister cordis',
    ta98Code: 'A12.1.04.001',
    fmaId: 'FMA:7101',
    system: 'cardiovascular',
    region: 'Heart Chambers (Middle Mediastinum & Apex)',
    wikiSearchTitleEn: 'Left_ventricle',
    wikiSearchTitleAr: 'بطين_أيسر',
    summaryEn:
      'Thick-walled conical chamber forming the apex of the heart; its myocardium is roughly three times thicker than the right ventricle to sustain high systemic arterial pressure.',
    summaryAr:
      'الحجرة القلبية المخروطية سميكة الجدار التي تشكل قمة القلب، ويفوق سمك عضلتها البطين الأيمن بثلاثة أضعاف لتوليد الضغط الجهازي.',
    primaryFunctionEn:
      'Receives oxygenated pulmonary venous blood via the mitral valve and ejects systemic cardiac output through the aortic valve into the aorta.',
    primaryFunctionAr:
      'استقبال الدم المؤكسج من الأذين الأيسر عبر الصمام التاجي وضخه بقوة عالية إلى الأبهر وجميع أنحاء الجسم.',
    arterialSupply: 'Left anterior descending (LAD) & left circumflex (LCx) coronary arteries',
    venousDrainage: 'Great cardiac vein & posterior left ventricular vein -> Coronary sinus',
    innervation: 'Cardiac autonomic plexus + left bundle branch Purkinje network',
    clinicalNotesEn:
      'Most common site of myocardial infarction (LAD territory), concentric hypertrophy in systemic hypertension/aortic stenosis, and systolic heart failure (reduced ejection fraction).',
    clinicalNotesAr:
      'أكثر حجرات القلب عرضة لاحتشاء عضلة القلب وتضخم البطين في فرط الضغط وتضيق الأبهر وقصور القلب الانقباضي.',
  },
  'right atrium': {
    key: 'right atrium',
    cleanNameEn: 'Right Atrium',
    cleanNameAr: 'الأذين الأيمن للقلب',
    latinName: 'Atrium dextrum cordis',
    ta98Code: 'A12.1.01.001',
    fmaId: 'FMA:7096',
    system: 'cardiovascular',
    region: 'Heart Chambers (Right Cardiac Border)',
    wikiSearchTitleEn: 'Right_atrium',
    wikiSearchTitleAr: 'أذين_أيمن',
    summaryEn:
      'Quadrangular upper-right chamber forming the right cardiac border on chest radiograph, subdivided by the crista terminalis into a smooth sinus venarum and a ridged pectinate right auricle.',
    summaryAr:
      'الحجرة العلوية اليمنى للقلب التي تشكل الحد الأيمن في صورة الصدر، وتستقبل الجيب الوريدي والوريدين الأجوفين والجيب التاجي.',
    primaryFunctionEn:
      'Collects systemic venous return from the superior vena cava, inferior vena cava, and coronary sinus, houses the sinoatrial (SA) and atrioventricular (AV) nodes, and fills the right ventricle.',
    primaryFunctionAr:
      'استقبال الدم الوريدي الجهازي من الأجوفين والجيب التاجي، واحتضان العقدتين الجيبية والأذينية البطينية لضبط نظم القلب.',
    arterialSupply: 'SA nodal & atrial branches of the right coronary artery (60%)',
    venousDrainage: 'Thebesian (smallest cardiac) veins & coronary sinus',
    innervation: 'Rich vagal & sympathetic innervation converging on SA and AV nodes',
    clinicalNotesEn:
      'Contains Koch triangle (bordering AV node), fossa ovalis (site of secundum ASD / PFO), and the crista terminalis (common circuit substrate for atrial flutter).',
    clinicalNotesAr:
      'يضم مثلث كوخ المحتوي على العقدة الأذينية البطينية والحفرة البيضوية موضع عيوب الحاجز الأذيني والرفرفة الأذينية.',
  },
  'left atrium': {
    key: 'left atrium',
    cleanNameEn: 'Left Atrium',
    cleanNameAr: 'الأذين الأيسر للقلب',
    latinName: 'Atrium sinistrum cordis',
    ta98Code: 'A12.1.03.001',
    fmaId: 'FMA:7097',
    system: 'cardiovascular',
    region: 'Heart Chambers (Posterior Base)',
    wikiSearchTitleEn: 'Left_atrium',
    wikiSearchTitleAr: 'أذين_أيسر',
    summaryEn:
      'Posterior-most chamber forming most of the base of the heart directly anterior to the esophagus and tracheal carina, receiving four valveless pulmonary veins.',
    summaryAr:
      'الحجرة الخلفية العليا للقلب التي تقع أمام المريء مباشرة وتستقبل الأوردة الرئوية الأربعة الحاملة للدم المؤكسج.',
    primaryFunctionEn:
      'Receives oxygenated blood from both lungs and delivers ventricular preload across the mitral valve into the left ventricle during diastole.',
    primaryFunctionAr:
      'استقبال الدم المؤكسج من الرئتين عبر الأوردة الرئوية الأربعة ودفعه عبر الصمام التاجي إلى البطين الأيسر.',
    arterialSupply: 'Left circumflex atrial branches & sinoatrial nodal branch (40%)',
    venousDrainage: 'Oblique vein of left atrium (Marshall) -> Coronary sinus',
    innervation: 'Pulmonary vein myocardial sleeves & posterior left atrial autonomic ganglia',
    clinicalNotesEn:
      'Left atrial enlargement in mitral stenosis compresses the esophagus (dysphagia) or left recurrent laryngeal nerve (Ortner hoarseness) and predisposes to atrial fibrillation with left atrial appendage thrombus.',
    clinicalNotesAr:
      'تضخم الأذين الأيسر في تضيق الصمام التاجي يضغط على المريء والعصب الحنجري الراجع الأيسر ويهيئ للرجفان الأذيني وتكوّن الخثرات في الزائدة الأذينية.',
  },
  'interventricular septum': {
    key: 'interventricular septum',
    cleanNameEn: 'Interventricular Septum',
    cleanNameAr: 'الحاجز بين البطينين',
    latinName: 'Septum interventriculare',
    ta98Code: 'A12.1.00.013',
    fmaId: 'FMA:7133',
    system: 'cardiovascular',
    region: 'Internal Heart Septa',
    wikiSearchTitleEn: 'Interventricular_septum',
    wikiSearchTitleAr: 'حاجز_بين_البطينين',
    summaryEn:
      'Oblique osteomuscular/membranous partition separating the high-pressure left ventricle from the lower-pressure right ventricle, comprising a thin superior membranous part and thick muscular part.',
    summaryAr:
      'الجدار العضلي والغشائي الفاصل بين البطينين الأيمن والأيسر، ويتألف من جزء غشائي علوي رقيق وجزء عضلي سفلي سميك.',
    primaryFunctionEn:
      'Maintains hemodynamic separation between pulmonary and systemic circuits while transmitting the AV bundle of His and right/left bundle branches.',
    primaryFunctionAr:
      'الفصل التام بين الدورتين الرئوية والجهازية وتمرير حزمة هيس وفروعها الكهربائية لتزامن انقباض البطينين.',
    arterialSupply: 'LAD septal perforators (anterior two-thirds) & PDA septal branches (posterior third)',
    venousDrainage: 'Anterior & posterior septal veins -> Great/middle cardiac veins',
    innervation: 'Bundle of His, right bundle branch, and left bundle branch fascicles',
    clinicalNotesEn:
      'Membranous septum is the commonest site of congenital ventricular septal defect (VSD); post-infarction septal rupture produces acute holosystolic murmur and cardiogenic shock.',
    clinicalNotesAr:
      'الجزء الغشائي هو الموقع الأشيع لفتحة بين البطينين الخلقية (VSD)، وتمزقه بعد الاحتشاء يسبب نفخة شاملة للانقباض وصدمة قلبية.',
  },
  'interatrial septum': {
    key: 'interatrial septum',
    cleanNameEn: 'Interatrial Septum',
    cleanNameAr: 'الحاجز بين الأذينين',
    latinName: 'Septum interatriale',
    ta98Code: 'A12.1.00.015',
    fmaId: 'FMA:7108',
    system: 'cardiovascular',
    region: 'Internal Heart Septa',
    wikiSearchTitleEn: 'Interatrial_septum',
    wikiSearchTitleAr: 'حاجز_بين_الأذينين',
    summaryEn:
      'Thin fibromuscular septum dividing the right and left atria, featuring the depressed fossa ovalis marking closure of the fetal foramen ovale.',
    summaryAr:
      'الحاجز الفاصل بين الأذينين الأيمن والأيسر، ويحوي الحفرة البيضوية الناتجة عن انغلاق الثقبة البيضوية الجنينية.',
    primaryFunctionEn:
      'Separates deoxygenated right atrial return from oxygenated left atrial return after postnatal pulmonary transition.',
    primaryFunctionAr:
      'فصل الدم الوريدي غير المؤكسج في الأذين الأيمن عن الدم المؤكسج في الأذين الأيسر بعد الولادة.',
    arterialSupply: 'Atrial branches of right coronary and left circumflex arteries',
    venousDrainage: 'Thebesian & coronary sinus tributaries',
    innervation: 'Bachmann interatrial conduction bundle & septal autonomic fibers',
    clinicalNotesEn:
      'Failure of primum/secundum septum fusion results in atrial septal defect (ASD) with fixed split S2, or patent foramen ovale (PFO) permitting paradoxical embolism.',
    clinicalNotesAr:
      'فشل التحامه يسبب عيب الحاجز الأذيني (ASD) مع انقسام ثابت للصوت الثاني، أو بقاء الثقبة البيضوية السالكة للصمات المتناقضة.',
  },
  'tricuspid valve': {
    key: 'tricuspid valve',
    cleanNameEn: 'Tricuspid Valve (Right AV Valve)',
    cleanNameAr: 'الصمام ثلاثي الشرفات',
    latinName: 'Valva tricuspidalis',
    ta98Code: 'A12.1.02.003',
    fmaId: 'FMA:7234',
    system: 'cardiovascular',
    region: 'Right Atrioventricular Orifice',
    wikiSearchTitleEn: 'Tricuspid_valve',
    wikiSearchTitleAr: 'صمام_ثلاثي_الشرفات',
    summaryEn:
      'Three-cusp (anterior, posterior, septal leaflets) atrioventricular valve guarding the right atrioventricular orifice, tethered to right ventricular papillary muscles via chordae tendineae.',
    summaryAr:
      'الصمام القلبي المكون من ثلاث شرفات (أمامية وخلفية وحاجزية) بين الأذين الأيمن والبطين الأيمن، المثبت بالحبال الوترية والعضلات الحليمية.',
    primaryFunctionEn:
      'Permits diastolic right ventricular filling and seals tightly during systole to prevent backward regurgitation into the right atrium.',
    primaryFunctionAr:
      'السماح بمرور الدم من الأذين الأيمن إلى البطين الأيمن أثناء الانبساط ومنع ارتداده أثناء الانقباض.',
    arterialSupply: 'Right coronary artery annular plexus (leaflets largely avascular)',
    venousDrainage: 'Adjacent right atrial/ventricular subendocardial veins',
    innervation: 'Autonomic fibers along valve annulus',
    clinicalNotesEn:
      'Tricuspid regurgitation classically creates holosystolic murmur increasing on inspiration (Carvallo sign) and large CV waves in JVP; infective endocarditis affects it in IV drug use.',
    clinicalNotesAr:
      'قلس الصمام ثلاثي الشرفات يحدث نفخة انقباضية تزداد بالشهيق (علامة كارفالو) وموجة V بارزة في النبض الوداجي.',
  },
  'mitral valve': {
    key: 'mitral valve',
    cleanNameEn: 'Mitral Valve (Bicuspid / Left AV Valve)',
    cleanNameAr: 'الصمام التاجي (المترالي / ثنائي الشرفات)',
    latinName: 'Valva mitralis',
    ta98Code: 'A12.1.04.003',
    fmaId: 'FMA:7235',
    system: 'cardiovascular',
    region: 'Left Atrioventricular Orifice',
    wikiSearchTitleEn: 'Mitral_valve',
    wikiSearchTitleAr: 'صمام_تاجي',
    summaryEn:
      'Bicuspid valve (anterior and posterior leaflets) positioned between the left atrium and left ventricle, supported against high systolic pressure by papillary muscles and chordae tendineae.',
    summaryAr:
      'صمام ثنائي الشرفات يفصل الأذين الأيسر عن البطين الأيسر ويقاوم الضغط الانقباضي العالي بمساعدة الحبال الوترية والعضلات الحليمية.',
    primaryFunctionEn:
      'Maintains unidirectional left atrial-to-ventricular diastolic inflow without systolic regurgitant leak.',
    primaryFunctionAr:
      'تأمين تدفق الدم المؤكسج أحادي الاتجاه من الأذين الأيسر إلى البطين الأيسر ومنع ارتجاعه.',
    arterialSupply: 'Left circumflex coronary artery annular twigs',
    venousDrainage: 'Coronary sinus tributaries',
    innervation: 'Cardiac plexus parasympathetic & sympathetic annular afferents',
    clinicalNotesEn:
      'Best auscultated at the 5th left intercostal midclavicular apex; rheumatic heart disease causes mitral stenosis, whereas papillary muscle/chordal rupture triggers acute severe mitral regurgitation.',
    clinicalNotesAr:
      'يُسمع بوضوح عند قمة القلب؛ الحصبة الرثوية تسبب تضيقه، وتمزق العضلة الحليمية أو الحبال الوترية يسبب قلساً حاداً مهدداً للحياة.',
  },
  'aortic valve': {
    key: 'aortic valve',
    cleanNameEn: 'Aortic Valve',
    cleanNameAr: 'الصمام الأبهري',
    latinName: 'Valva aortae',
    ta98Code: 'A12.1.04.012',
    fmaId: 'FMA:7236',
    system: 'cardiovascular',
    region: 'Left Ventricular Outflow Tract',
    wikiSearchTitleEn: 'Aortic_valve',
    wikiSearchTitleAr: 'صمام_أبهري',
    summaryEn:
      'Semilunar tricuspid valve (left, right, and non-coronary cusps forming the aortic sinuses of Valsalva) separating the left ventricle from the ascending aorta.',
    summaryAr:
      'صمام هلالي ثلاثي الجيوب (يميني ويساري ولا-تاجي) يقع في مخرج البطين الأيسر عند منشأ الشريان الأبهر الصاعد.',
    primaryFunctionEn:
      'Opens smoothly during left ventricular systole and snaps shut in early diastole (S2 A2 component) to sustain diastolic aortic pressure and coronary artery perfusion.',
    primaryFunctionAr:
      'ينفتح في الانقباض لضخ الدم الجهازي وينغلق بإحكام في الانبساط لإغلاق الصوت الثاني وتروية الشرايين التاجية عبر جيوب فالسالفا.',
    arterialSupply: 'Left and right coronary ostia originate just superior to its cusps',
    venousDrainage: 'Aortic root vasa venosa',
    innervation: 'Aortic root baroreceptor & cardiac plexus afferents',
    clinicalNotesEn:
      'Calcific aortic stenosis or congenital bicuspid aortic valve produces a harsh crescendo-decrescendo systolic murmur radiating to the carotids (SAD triad: syncope, angina, dyspnea).',
    clinicalNotesAr:
      'تضيق الصمام الأبهري الكلسي أو ثنائي الشرف يسبب نفخة انقباضية تنتشر للسباتي وتؤدي للغشي والذبحة وضيق النفس.',
  },
  'pulmonary valve': {
    key: 'pulmonary valve',
    cleanNameEn: 'Pulmonary Valve',
    cleanNameAr: 'الصمام الرئوي',
    latinName: 'Valva trunci pulmonalis',
    ta98Code: 'A12.1.02.011',
    fmaId: 'FMA:7246',
    system: 'cardiovascular',
    region: 'Right Ventricular Outflow Tract',
    wikiSearchTitleEn: 'Pulmonary_valve',
    wikiSearchTitleAr: 'صمام_رئوي',
    summaryEn:
      'Anterior superior semilunar valve (anterior, left, right cusps) guarding the junction between the right ventricular infundibulum and the pulmonary trunk.',
    summaryAr:
      'صمام هلالي ثلاثي الجيوب يقع بين القمع الشرياني للبطين الأيمن والجذع الرئوي.',
    primaryFunctionEn:
      'Prevents diastolic backflow of blood from the pulmonary trunk into the right ventricle (P2 component of S2).',
    primaryFunctionAr:
      'توجيه الدم نحو الدورة الرئوية ومنع ارتداده إلى البطين الأيمن خلال الانبساط (المركبة P2 من الصوت الثاني).',
    arterialSupply: 'Conal branches of right and left anterior descending coronary arteries',
    venousDrainage: 'Anterior cardiac veins',
    innervation: 'Autonomic cardiopulmonary plexus',
    clinicalNotesEn:
      'Congenital pulmonary valve stenosis contributes to Tetralogy of Fallot right ventricular outflow obstruction; auscultated at the 2nd left sternal border.',
    clinicalNotesAr:
      'تضيقه الخلقي عنصر أساسي في رباعية فالو، وتُسمع نفخته في الورب الثاني أيسر القص.',
  },
  'papillary muscles': {
    key: 'papillary muscles',
    cleanNameEn: 'Papillary Muscles of Heart',
    cleanNameAr: 'العضلات الحليمية القلبية',
    latinName: 'Musculi papillares',
    ta98Code: 'A12.1.00.020',
    fmaId: 'FMA:7135',
    system: 'cardiovascular',
    region: 'Ventricular Subendocardial Apparatus',
    wikiSearchTitleEn: 'Papillary_muscle',
    wikiSearchTitleAr: 'عضلة_حليمية',
    summaryEn:
      'Conical myocardial projections inside both ventricles (2 large in left ventricle: anterolateral & posteromedial; 3 in right ventricle) anchoring chordae tendineae to AV valve cusps.',
    summaryAr:
      'نتوءات عضلية مخروطية داخل البطينين ترتبط بها الحبال الوترية لمنع انقلاب الصمامين التاجي وثلاثي الشرفات.',
    primaryFunctionEn:
      'Contract just ahead of ventricular pressure peak to tension chordae tendineae and prevent systolic prolapse of mitral/tricuspid leaflets into atria.',
    primaryFunctionAr:
      'الانقباض المبكر لشد الحبال الوترية ومنع تدلي شرفات الصمامات نحو الأذينين أثناء الانقباض.',
    arterialSupply: 'Posteromedial LV papillary muscle: single supply (PDA) — vulnerable to ischemia; Anterolateral: dual (LAD + LCx)',
    venousDrainage: 'Thebesian & coronary sinus veins',
    innervation: 'Purkinje subendocardial terminal branches',
    clinicalNotesEn:
      'Rupture of the posteromedial papillary muscle 2–7 days after an inferior myocardial infarction precipitates catastrophic acute mitral regurgitation and pulmonary edema.',
    clinicalNotesAr:
      'تمزق العضلة الحليمية الخلفية الإنسية بعد احتشاء الجدار السفلي يسبب قلساً تاجياً حاداً ووذمة رئوية مفاجئة.',
  },
  'chordae tendineae': {
    key: 'chordae tendineae',
    cleanNameEn: 'Chordae Tendineae',
    cleanNameAr: 'الحبال الوترية القلبية',
    latinName: 'Chordae tendineae',
    ta98Code: 'A12.1.00.021',
    fmaId: 'FMA:7212',
    system: 'cardiovascular',
    region: 'Ventricular Subvalvular Apparatus',
    wikiSearchTitleEn: 'Chordae_tendineae',
    wikiSearchTitleAr: 'حبال_وترية',
    summaryEn:
      'Tough fibrous collagen cords ("heart strings") linking the apices of the papillary muscles to the ventricular surfaces and free margins of the mitral and tricuspid leaflets.',
    summaryAr:
      'أوتار ليفية متينة تصل رؤوس العضلات الحليمية بحواف شرفات الصمامين التاجي وثلاثي الشرفات.',
    primaryFunctionEn:
      'Transmit papillary muscle tension evenly across AV valve leaflets so cusps coapt tightly under systolic load without everting.',
    primaryFunctionAr:
      'نقل الشد الميكانيكي من العضلات الحليمية لضمان انطباق الشرفات ومنع انقلابها للأذين أثناء الانقباض.',
    arterialSupply: 'Avascular dense fibrous collagen nourished by intracavitary blood & papillary bases',
    venousDrainage: 'Via papillary base subendocardial venules',
    innervation: 'Passive collagenous tensile cords',
    clinicalNotesEn:
      'Chordal elongation in myxomatous mitral valve prolapse or rupture in infective endocarditis produces a flail leaflet and eccentric regurgitant jet.',
    clinicalNotesAr:
      'ارتخاؤها في انسدال الصمام التاجي أو تمزقها بالتهاب الشغاف يسبب تسيب الشرفة وقلساً حاداً.',
  },
  'coronary sinus': {
    key: 'coronary sinus',
    cleanNameEn: 'Coronary Sinus',
    cleanNameAr: 'الجيب التاجي (الإكليلي)',
    latinName: 'Sinus coronarius',
    ta98Code: 'A12.3.01.002',
    fmaId: 'FMA:4706',
    system: 'cardiovascular',
    region: 'Posterior Atrioventricular Groove',
    wikiSearchTitleEn: 'Coronary_sinus',
    wikiSearchTitleAr: 'جيب_تاجي',
    summaryEn:
      'Wide venous channel running left-to-right in the posterior coronary sulcus between the left atrium and left ventricle, draining directly into the right atrium beside the IVC ostium.',
    summaryAr:
      'قناة وريدية واسعة في الثلم التاجي الخلفي تجمع معظم الدم الوريدي لعضلة القلب وتصبه في الأذين الأيمن.',
    primaryFunctionEn:
      'Drains ~75–85% of myocardial venous blood (via great, middle, small, and posterior LV cardiac veins) into the right atrium.',
    primaryFunctionAr:
      'تصريف الغالبية العظمى من الدم الوريدي القادم من عضلة القلب إلى الأذين الأيمن.',
    arterialSupply: 'Vasa vasorum from left circumflex and right coronary arteries',
    venousDrainage: 'Opens into posterior-inferior right atrium guarded by the Thebesian valve',
    innervation: 'Subepicardial coronary autonomic plexus',
    clinicalNotesEn:
      'Critical anatomical conduit for left ventricular pacing lead placement in cardiac resynchronization therapy (CRT) and retrograde cardioplegia during cardiac surgery.',
    clinicalNotesAr:
      'مسار أساسي لوضع مسرى البطين الأيسر في أجهزة مزامنة القلب ولإعطاء محلول شلل القلب الرجوعي جراحياً.',
  },
  'cerebral cortex': {
    key: 'cerebral cortex',
    cleanNameEn: 'Cerebral Cortex',
    cleanNameAr: 'القشرة المخية',
    latinName: 'Cortex cerebri',
    ta98Code: 'A14.1.09.002',
    fmaId: 'FMA:61830',
    system: 'nervous',
    region: 'Telencephalon (Cerebral Hemispheres)',
    wikiSearchTitleEn: 'Cerebral_cortex',
    wikiSearchTitleAr: 'قشرة_مخية',
    summaryEn:
      'Highly folded outer grey-matter mantle of gyri and sulci (2–4 mm thick, six-layered neocortex) covering both cerebral hemispheres.',
    summaryAr:
      'الطبقة الرمادية الخارجية المطوية المكونة من التلافيف والأثلام التي تغطي نصفي الكرة المخية.',
    primaryFunctionEn:
      'Executes higher-order cognition, voluntary motor planning, conscious somatosensory/visual/auditory perception, language, and executive reasoning.',
    primaryFunctionAr:
      'تنفيذ العمليات المعرفية العليا، والتخطيط الحركي الإرادي، والإدراك الحسي والسمعي والبصري، واللغة، واتخاذ القرار.',
    arterialSupply: 'Anterior, middle, and posterior cerebral arteries (ACA, MCA, PCA)',
    venousDrainage: 'Superficial & deep cerebral veins -> Dural venous sinuses',
    innervation: 'Thalamocortical projections, cholinergic nucleus basalis, monoaminergic brainstem nuclei',
    clinicalNotesEn:
      'Cortical MCA stroke produces focal contralateral weakness/aphasia/neglect matching homunculus and Brodmann functional maps.',
    clinicalNotesAr:
      'سكتات القشرة المخية في نطاق الشريان المخي الأوسط تسبب خزلاً نصفياً معاكساً أو حبسة كلامية حسب الباحة الوظيفية المصابة.',
  },
  'frontal lobe': {
    key: 'frontal lobe',
    cleanNameEn: 'Frontal Lobe',
    cleanNameAr: 'الفص الجبهي',
    latinName: 'Lobus frontalis',
    ta98Code: 'A14.1.09.110',
    fmaId: 'FMA:61824',
    system: 'nervous',
    region: 'Anterior Cranial Fossa (Rostral to Central Sulcus)',
    wikiSearchTitleEn: 'Frontal_lobe',
    wikiSearchTitleAr: 'فص_جبهي',
    summaryEn:
      'Largest cerebral lobe situated anterior to the central sulcus of Rolando and superior to the Sylvian fissure, encompassing primary motor cortex, premotor, and prefrontal areas plus Broca area.',
    summaryAr:
      'أكبر فصوص المخ يقع أمام الثلم المركزي وفوق الشق الوحشي، ويضم الباحة الحركية الأولية والقشرة الجبهية الأمامية ومنطقة بروكا.',
    primaryFunctionEn:
      'Governs voluntary skeletal motor output (precentral gyrus), expressive speech production (Broca), working memory, impulse inhibition, and executive judgment.',
    primaryFunctionAr:
      'توليد الأوامر الحركية الإرادية، وإنتاج الكلام، والذاكرة العاملة، والتخطيط التنفيذي، والتحكم السلوكي.',
    arterialSupply: 'Anterior cerebral artery (medial) & superior division of MCA (lateral)',
    venousDrainage: 'Superior sagittal & superficial middle cerebral veins',
    innervation: 'Corticospinal, corticobulbar, frontopontine, and frontostriatal circuits',
    clinicalNotesEn:
      'Precentral gyrus injury causes contralateral spastic hemiparesis; inferior frontal gyrus (dominant hemisphere) lesions cause Broca expressive aphasia.',
    clinicalNotesAr:
      'أذية التلفيف أمام المركزي تسبب شللاً نصفياً تشنجياً، وإصابة باحة بروكا تسبب حبسة تعبيرية حركية.',
  },
  'parietal lobe': {
    key: 'parietal lobe',
    cleanNameEn: 'Parietal Lobe',
    cleanNameAr: 'الفص الجداري',
    latinName: 'Lobus parietalis',
    ta98Code: 'A14.1.09.130',
    fmaId: 'FMA:61826',
    system: 'nervous',
    region: 'Posterior to Central Sulcus (Cerebral Convexity)',
    wikiSearchTitleEn: 'Parietal_lobe',
    wikiSearchTitleAr: 'فص_جداري',
    summaryEn:
      'Cerebral lobe bounded anteriorly by the central sulcus and posteriorly by the parieto-occipital sulcus, housing the primary somatosensory cortex (postcentral gyrus).',
    summaryAr:
      'فص دماغي يقع خلف الثلم المركزي وأمام الفص القذالي، ويحتوي القشرة الحسية الجسدية الأولية ومناطق التكامل المكاني.',
    primaryFunctionEn:
      'Integrates fine touch, proprioception, pain/temperature perception, visuospatial attention, and multisensory object manipulation.',
    primaryFunctionAr:
      'معالجة الحس الجسدي الدقيق واستقبال الحس العميق والوعي المكاني والتناسق البصري الحركي.',
    arterialSupply: 'Middle cerebral artery (lateral convexity) & anterior/posterior cerebral branches',
    venousDrainage: 'Superior anastomotic vein of Trolard -> Superior sagittal sinus',
    innervation: 'Ventral posterolateral/posteromedial (VPL/VPM) thalamocortical sensory radiations',
    clinicalNotesEn:
      'Non-dominant (usually right) parietal lesion causes contralateral hemineglect; dominant angular gyrus injury produces Gerstmann syndrome (acalculia, agraphia, finger agnosia).',
    clinicalNotesAr:
      'إصابة الفص الجداري غير المسيطر تسبب متلازمة الإهمال المكاني المعاكس، والمسيطر تسبب متلازمة غيرستمان.',
  },
  'temporal lobe': {
    key: 'temporal lobe',
    cleanNameEn: 'Temporal Lobe',
    cleanNameAr: 'الفص الصدغي',
    latinName: 'Lobus temporalis',
    ta98Code: 'A14.1.09.135',
    fmaId: 'FMA:61829',
    system: 'nervous',
    region: 'Middle Cranial Fossa (Inferior to Sylvian Fissure)',
    wikiSearchTitleEn: 'Temporal_lobe',
    wikiSearchTitleAr: 'فص_صدغي',
    summaryEn:
      'Lateral and inferior lobe nestled inside the middle cranial fossa below the Sylvian fissure, integrating primary auditory cortex (Heschl gyri), Wernicke language comprehension area, and medial limbic memory structures.',
    summaryAr:
      'الفص الجانبي السفلي الواقع في الحفرة القحفية الوسطى أسفل الشق الوحشي، ويضم القشرة السمعية وباحة فيرنيكه والحصين.',
    primaryFunctionEn:
      'Processes hearing, spoken language comprehension (Wernicke area), visual object recognition, and declarative memory consolidation via medial temporal lobe.',
    primaryFunctionAr:
      'السمع وفهم اللغة المنطوقة (باحة فيرنيكه) وتخزين الذاكرة التصريحية والتعرف البصري على الوجوه والأشياء.',
    arterialSupply: 'Inferior division of middle cerebral artery & posterior cerebral artery (inferior surface)',
    venousDrainage: 'Superficial middle cerebral vein & vein of Labbe -> Transverse sinus',
    innervation: 'Meyer loop (optic radiation) & medial geniculate auditory radiations',
    clinicalNotesEn:
      'Wernicke lesion causes fluent receptive aphasia; Meyer loop injury produces contralateral superior homonymous quadrantanopia ("pie in the sky").',
    clinicalNotesAr:
      'إصابة فيرنيكه تسبب حبسة استقبالية، وتضرر عروة ماير يحدث عمى ربعياً علوياً معاكساً في الساحة البصرية.',
  },
  'occipital lobe': {
    key: 'occipital lobe',
    cleanNameEn: 'Occipital Lobe',
    cleanNameAr: 'الفص القذالي (الخلفي)',
    latinName: 'Lobus occipitalis',
    ta98Code: 'A14.1.09.138',
    fmaId: 'FMA:67325',
    system: 'nervous',
    region: 'Posterior Cerebral Pole (Above Tentorium Cerebelli)',
    wikiSearchTitleEn: 'Occipital_lobe',
    wikiSearchTitleAr: 'فص_قذالي',
    summaryEn:
      'Posterior-most cerebral lobe resting upon the tentorium cerebelli, organized around the calcarine sulcus containing the primary visual cortex (V1 / striate cortex).',
    summaryAr:
      'الفص الخلفي للمخ المستقر فوق خيمة المخيخ، وتتركز فيه القشرة البصرية الأولية على ضفتي الثلم المهمازي.',
    primaryFunctionEn:
      'Decodes retinal visuospatial fields, color, orientation, motion, and visual depth cues.',
    primaryFunctionAr:
      'استقبال ومعالجة الإشارات البصرية من الشبكية وتحليل الألوان والحركة والعمق والأشكال.',
    arterialSupply: 'Posterior cerebral artery (calcarine branch) + MCA macular collateral anastomoses',
    venousDrainage: 'Occipital & straight/transverse dural venous sinuses',
    innervation: 'Lateral geniculate nucleus (LGN) geniculocalcarine optic radiations',
    clinicalNotesEn:
      'Posterior cerebral artery infarction causes contralateral homonymous hemianopia with macular sparing due to dual MCA collateralization of the occipital pole.',
    clinicalNotesAr:
      'احتشاء الشريان المخي الخلفي يسبب عمى شقياً متجانساً معاكساً مع بقاء الرؤية البقعية سليمة غالباً.',
  },
  hypothalamus: {
    key: 'hypothalamus',
    cleanNameEn: 'Hypothalamus',
    cleanNameAr: 'الوطاء (تحت المهاد)',
    latinName: 'Hypothalamus',
    ta98Code: 'A14.1.08.401',
    fmaId: 'FMA:62008',
    system: 'nervous',
    region: 'Ventral Diencephalon (Floor/Walls of 3rd Ventricle)',
    wikiSearchTitleEn: 'Hypothalamus',
    wikiSearchTitleAr: 'وطاء',
    summaryEn:
      'Master neuroendocrine and autonomic integrator forming the ventral walls and floor of the third ventricle immediately superior to the optic chiasm and pituitary stalk.',
    summaryAr:
      'المركز الأعلى للتكامل العصبي الصماوي والذاتي، يشكل قاع وجدران البطين الثالث السفلى فوق التصالب البصري والسويقة النخامية.',
    primaryFunctionEn:
      'Regulates body temperature, hunger, thirst/osmolality (ADH & oxytocin synthesis), circadian rhythm (SCN), autonomic balance, and anterior pituitary releasing hormones.',
    primaryFunctionAr:
      'تنظيم حرارة الجسم والجوع والعطش والأسمولية وإيقاع الساعة البيولوجية وإفراز هرمونات النخامية والتحكم الذاتي.',
    arterialSupply: 'Circle of Willis hypothalamic perforating branches (ACA, AComm, PComm)',
    venousDrainage: 'Hypophysial portal & basal cerebral veins',
    innervation: 'Limbic-hypothalamic (fornix, stria terminalis) & brainstem autonomic tracts',
    clinicalNotesEn:
      'Craniopharyngioma or hypothalamic injury triggers diabetes insipidus, poikilothermia, hyperphagic obesity, or panhypopituitarism.',
    clinicalNotesAr:
      'إصابة الوطاء (مثل الورم القحفي البلعومي) تسبب البوال التفه واضطراب تنظيم الحرارة والشهية وقصور النخامية.',
  },
  'insular cortex': {
    key: 'insular cortex',
    cleanNameEn: 'Insular Cortex (Insula)',
    cleanNameAr: 'الفص الجزيري (القشرة الجزيرية)',
    latinName: 'Cortex insularis (Insula)',
    ta98Code: 'A14.1.09.149',
    fmaId: 'FMA:67330',
    system: 'nervous',
    region: 'Deep Floor of Lateral (Sylvian) Sulcus',
    wikiSearchTitleEn: 'Insular_cortex',
    wikiSearchTitleAr: 'فص_جزيري',
    summaryEn:
      'Fifth cerebral lobe folded deep within the lateral sulcus beneath the frontal, parietal, and temporal opercula.',
    summaryAr:
      'الفص الدماغي الخامس المخبأ في عمق الشق الوحشي تحت الغطاء الجبهي والجداري والصدغي.',
    primaryFunctionEn:
      'Integrates gustatory taste sensation, visceral interoception, pain empathy, speech articulation rhythm, and cardiovascular autonomic control.',
    primaryFunctionAr:
      'معالجة التذوق والإحساس الحشوي الداخلي والألم وتنظيم التوازن القلبي الوعائي الذاتي.',
    arterialSupply: 'M2 insular branches of middle cerebral artery',
    venousDrainage: 'Deep middle cerebral vein -> Basal vein of Rosenthal',
    innervation: 'Thalamocortical gustatory & visceral interoceptive afferents',
    clinicalNotesEn:
      'Insular ribbon loss on non-contrast head CT is an early sign of acute MCA ischemia; insular infarction increases risk of neurogenic cardiac arrhythmias.',
    clinicalNotesAr:
      'فقدان حدود الشريط الجزيري علامة باكرة لنقص تروية الشريان المخي الأوسط، وإصابته ترتبط باضطرابات نظم القلب العصبية.',
  },
  fornix: {
    key: 'fornix',
    cleanNameEn: 'Fornix of Brain',
    cleanNameAr: 'قبو الدماغ (القبو الحصيني)',
    latinName: 'Fornix cerebri',
    ta98Code: 'A14.1.09.424',
    fmaId: 'FMA:61964',
    system: 'nervous',
    region: 'Limbic White Matter Arch (Ventricular Roof/Septum)',
    wikiSearchTitleEn: 'Fornix_(neuroanatomy)',
    wikiSearchTitleAr: 'قبو_الدماغ',
    summaryEn:
      'C-shaped efferent white-matter commissural arch sweeping from the hippocampal fimbria beneath the corpus callosum to terminate in the mammillary bodies of the hypothalamus.',
    summaryAr:
      'حزمة ألياف عصبية بيضاء مقوسة تنقل مخرجات الحصين تحت الجسم الثفني لتنتهي في الأجسام الحلمية بالوطاء.',
    primaryFunctionEn:
      'Core Papez memory circuit output pathway mediating episodic memory encoding and spatial recall.',
    primaryFunctionAr:
      'المسار الناقل الرئيسي في دارة بابيز لترميز الذاكرة العرضية واستدعائها.',
    arterialSupply: 'Medial lenticulostriate & choroidal arterial branches',
    venousDrainage: 'Internal cerebral veins',
    innervation: 'Hippocampo-mammillary projection fibers',
    clinicalNotesEn:
      'Surgical transection during third-ventricle colloid cyst resection causes acute anterograde amnesia.',
    clinicalNotesAr:
      'أذية قبو الدماغ خلال جراحة كيسة البطين الثالث تسبب فقدان الذاكرة التقدمي الحاد.',
  },
};

const ENTRY_ALIASES: Record<string, string> = {
  'skin epidermis': 'skin',
  cutis: 'skin',
  aorta: 'aorta',
  'ascending aorta': 'aorta',
  'descending aorta': 'aorta',
  'thoracic aorta': 'aorta',
  'abdominal aorta': 'aorta',
  tibia: 'tibia fibula',
  'prostate gland': 'prostate gland',
  prostate: 'prostate gland',
  testis: 'testes',
  testicles: 'testes',
  'large intestine': 'large intestine colon',
  colon: 'large intestine colon',
  ovaries: 'ovary',
  'uterine tubes': 'fallopian tubes',
  'ribs 1 12': 'ribs',
  'ribs left 1 12': 'ribs',
  'ribs right 1 12': 'ribs',
  'vagus nerve cn x': 'vagus nerve',
  mesencephalon: 'midbrain',
  'corpus amygdaloideum': 'amygdala',
  'cerebral cortex nerves': 'brain',
  'lumbar plexus': 'lumbar sacral plexus',
  'sacral plexus': 'lumbar sacral plexus',
  'iliac vessels': 'common iliac vessels',
  'femoral arteries': 'femoral vessels',
  'brachial artery': 'brachial vessels',
  'femoral artery': 'femoral vessels',
  'subclavian artery': 'subclavian vessels',
  'carotid artery': 'carotid arteries',
  'jugular vein': 'jugular veins',
  'triceps surae': 'gastrocnemius soleus',
  gastrocnemius: 'gastrocnemius soleus',
  soleus: 'soleus',
  quadriceps: 'quadriceps rectus femoris',
  'quadriceps femoris': 'quadriceps rectus femoris',
  'vastus intermedius': 'quadriceps rectus femoris',
  hamstrings: 'biceps femoris hamstrings',
  'biceps femoris': 'biceps femoris hamstrings',
  iliacus: 'iliopsoas',
  'psoas major': 'iliopsoas',
  'psoas minor': 'iliopsoas',
  'adductor brevis': 'adductor longus',
  'gluteus minimus': 'gluteus medius',
  'teres minor': 'infraspinatus',
  'rhomboid minor': 'rhomboid major',
  coracobrachialis: 'biceps brachii',
  popliteus: 'tibialis anterior',
  'fibularis brevis': 'fibularis longus',
  'peroneus longus': 'fibularis longus',
  'peroneus brevis': 'fibularis longus',
  brachioradialis: 'brachioradialis',
  'radius ulna': 'radius',
  'rib cage': 'thoracic cage',
  skull: 'cranium',
  encephalon: 'brain',
  hepar: 'liver',
  gaster: 'stomach',
  cor: 'heart',
  sacrum: 'sacrum coccyx',
  coccyx: 'sacrum coccyx',
  triceps: 'triceps brachii',
  bronchus: 'trachea',
  'main bronchus': 'trachea',
  'renal pelvis': 'kidneys',
  'tibial nerve': 'tibial fibular nerves',
  'common fibular nerve': 'tibial fibular nerves',
  'common peroneal nerve': 'tibial fibular nerves',
  'pulmonary artery': 'pulmonary trunk',
  'hepatic portal vein': 'portal vein',
  'cervical vertebra': 'cervical vertebrae',
  'thoracic vertebra': 'thoracic vertebrae',
  'lumbar vertebra': 'lumbar vertebrae',
  metacarpal: 'carpals metacarpals phalanges',
  'metacarpal bone': 'carpals metacarpals phalanges',
  'carpal bone': 'carpals metacarpals phalanges',
  'phalanx of finger': 'carpals metacarpals phalanges',
  'phalanx of thumb': 'carpals metacarpals phalanges',
  metatarsal: 'tarsals metatarsals phalanges',
  'metatarsal bone': 'tarsals metatarsals phalanges',
  'tarsal bone': 'tarsals metatarsals phalanges',
  'phalanx of toe': 'tarsals metatarsals phalanges',
  'phalanx of great toe': 'tarsals metatarsals phalanges',
  'medial cuneiform': 'tarsals metatarsals phalanges',
  'intermediate cuneiform': 'tarsals metatarsals phalanges',
  'lateral cuneiform': 'tarsals metatarsals phalanges',
  'bicuspid valve': 'mitral valve',
  'left atrioventricular valve': 'mitral valve',
  'right atrioventricular valve': 'tricuspid valve',
  'pulmonary semilunar valve': 'pulmonary valve',
  'aortic semilunar valve': 'aortic valve',
  'papillary muscle': 'papillary muscles',
  'anterior papillary muscle': 'papillary muscles',
  'posterior papillary muscle': 'papillary muscles',
  'septal papillary muscle': 'papillary muscles',
  'trabeculae carneae': 'right ventricle',
  'moderator band': 'right ventricle',
  'conus arteriosus': 'right ventricle',
  'right auricle': 'right atrium',
  'left auricle': 'left atrium',
  'cardiac ventricle': 'right ventricle',
  'ventricular septum': 'interventricular septum',
  'atrial septum': 'interatrial septum',
  'cerebral hemisphere': 'cerebral cortex',
  'precentral gyrus': 'frontal lobe',
  'postcentral gyrus': 'parietal lobe',
  'broca area': 'frontal lobe',
  'wernicke area': 'temporal lobe',
  'insular lobe': 'insular cortex',
  insula: 'insular cortex',
};

const SYSTEM_ARABIC_NAMES: Record<AnatomicalSystem, string> = {
  integumentary: 'الجهاز اللحافي (الجلد)',
  skeletal: 'الجهاز الهيكلي',
  muscular: 'الجهاز العضلي',
  visceral: 'الأحشاء الداخلية',
  cardiovascular: 'الجهاز القلبي الوعائي',
  nervous: 'الجهاز العصبي',
};

const LEGITIMATE_ROOT_TA98_CODES = new Set([
  'A12.0.00.001',
  'A13.0.00.001',
  'A14.0.00.001',
  'A16.0.00.001',
]);

export function cleanTextbookArtifactText(text?: string | null): string {
  if (!text) return '';
  let s = String(text);

  // Strip figure / eFig / table citation parentheses (e.g., "(Fig. 4.106)", "(eFigs. 9.100 and 9.101)")
  // and trailing "; Fig. ..." clauses inside parentheses
  s = s.replace(/\(\s*(?:also\s+|see\s+|p\.?\s*\d+[,;\s]+)*e?Figs?\.\s*[^)]*\)/gi, '');
  s = s.replace(/\(([^()]*?)[;,\s]+(?:also\s+|see\s+|p\.?\s*\d+[,;\s]+)*e?Figs?\.\s*[^)]*\)/gi, '($1)');
  s = s.replace(/\s*\([^)]*\be?Figs?\b[^)]*$/gi, '');

  // Strip Gray's diagram panel-callout prefixes & pairs (e.g. "A Splenic artery B ", "A B ", "A C")
  s = s.replace(/^\s*[A-F]\s+[A-Za-z][A-Za-z\s-]{1,40}\s+[B-F]\s+(?=[A-Z])/, '');
  s = s.replace(/^\s*(?:[A-F]\s+)+(?=[A-Z])/, (m) => {
    const tokens = m.trim().split(/\s+/);
    // Preserve genuine English indefinite article "A " unless paired with another panel letter
    return tokens.length === 1 && tokens[0] === 'A' ? m : '';
  });
  s = s.replace(/([.:;!?]\s+)(?:[A-F]\s+){2,}/g, '$1');
  s = s.replace(/\s+(?:[A-F]\s+){1,}[A-F]\s*$/g, '');

  // Rejoin mid-word PDF hyphenation wraps (e.g. "origi - nates" -> "originates")
  s = s.replace(
    /([A-Za-z]{2,})\s+-\s+(?!(?:and|or|to|of|in|on|with|the|from|for|by|as|a|an)\b)([a-z]{2,})/g,
    '$1$2'
  );

  // Clean stray leading bullets/punctuation and spacing before punctuation
  s = s
    .replace(/^\s*[-■•–]+\s*/, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return s;
}

function isTruncatedTextbookFragment(text?: string | null): boolean {
  const trimmed = cleanTextbookArtifactText(text);
  if (!trimmed || trimmed.length < 4) return true;
  if (/[,;:\-(/]$/.test(trimmed)) return true;
  return /\b(?:and|or|the|a|an|of|to|in|on|at|by|for|with|from|via|into|onto|between|through|under|over|near|as|which|that|such|also|both|including|chiefly)$/i.test(
    trimmed
  );
}

function pickCleanTextbookField(
  tbVal: string | undefined,
  fallbackVal: string
): string;
function pickCleanTextbookField(
  tbVal: string | undefined,
  fallbackVal?: string
): string | undefined;
function pickCleanTextbookField(
  tbVal: string | undefined,
  fallbackVal?: string
): string | undefined {
  const cleaned = cleanTextbookArtifactText(tbVal);
  if (cleaned && !isTruncatedTextbookFragment(cleaned)) {
    return cleaned;
  }
  return fallbackVal;
}

function pickResolvedTa98Code(
  partCode?: string,
  entryCode?: string
): string {
  const isFallbackHash =
    !partCode ||
    partCode === 'TA98 Pending' ||
    (/\.0\.00\.\d{3}$/.test(partCode) && !LEGITIMATE_ROOT_TA98_CODES.has(partCode));
  if (!isFallbackHash && partCode) {
    return partCode;
  }
  return entryCode || partCode || 'TA98 Pending';
}

interface RegionalClinicalGuidance {
  regionEn: string;
  regionAr: string;
  arterial: string;
  venous: string;
  innervation: string;
  functionEn: string;
  functionAr: string;
  clinicalNotesEn: string;
  clinicalNotesAr: string;
}

const REGIONAL_CLINICAL_GUIDANCE_RULES: Array<{
  pattern: RegExp;
  systems?: AnatomicalSystem[];
  guidance: (cleanNameEn: string) => RegionalClinicalGuidance;
}> = [
  {
    pattern: /\b(?:incisor|canine|premolar|molar|tooth|teeth|gingiva|alveolar|enamel|dentin|pulp|periodont)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Stomatognathic Apparatus (Maxilla / Mandible)',
      regionAr: 'الجهاز الماضغ (الفك العلوي والسفلي)',
      arterial: 'Superior and inferior alveolar arteries (branches of maxillary artery)',
      venous: 'Alveolar veins -> Pterygoid venous plexus -> Retromandibular vein',
      innervation: 'Superior alveolar nerves (CN V2 maxillary) & Inferior alveolar nerve (CN V3 mandibular)',
      functionEn: `${n} participates directly in mastication (incision, tearing, or occlusal grinding), phonetic articulation, and vertical facial dimension.`,
      functionAr: `تؤدي بنية ${n} دوراً مباشراً في المضغ وتقطيع أو طحن الطعام والنطق ودعم القوس السنية.`,
      clinicalNotesEn: 'Mandibular third molars lie adjacent to the inferior alveolar canal and lingual nerve; maxillary molar roots closely border the maxillary sinus floor.',
      clinicalNotesAr: 'تجاور جذور الأرحاء السفلية القناة السنخية السفلية والعصب اللساني، بينما تقترب الأرحاء العلوية من أرضية الجيب الفكي.',
    }),
  },
  {
    pattern: /\b(?:eyelash|eyebrow|palpebr|conjunctiv|cornea|lacrimal|orbit|sclera)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Orbital & Periorbital Region',
      regionAr: 'الناحية الحجاجية وحول العين',
      arterial: 'Ophthalmic, lacrimal, supraorbital & angular (facial) arteries',
      venous: 'Superior & inferior ophthalmic veins -> Cavernous sinus & facial vein',
      innervation: 'Ophthalmic division of trigeminal nerve (CN V1 sensory); Facial nerve (CN VII motor to orbicularis)',
      functionEn: `${n} forms part of the protective adnexal apparatus shielding the ocular surface from particulate debris, desiccation, and excessive glare.`,
      functionAr: `تشكّل بنية ${n} جزءاً من الملحقات الواقية للعين لحماية القرنية والملتحمة من الأجسام الغريبة والجفاف.`,
      clinicalNotesEn: 'Danger triangle periorbital veins communicate valvelessly with the cavernous sinus via the superior ophthalmic vein.',
      clinicalNotesAr: 'تتصل أوردة حول الحجاج بدون صمامات بالجيب الكهفي القحفي عبر الوريد العيني العلوي.',
    }),
  },
  {
    pattern: /\b(?:vertebra|cervical|thoracic|lumbar|sacral|coccy|atlas|axis|pedicle|lamina|spinous|transverse process|intervertebr|ligamentum flavum|longitudinal ligament)[a-z]*\b/i,
    systems: ['skeletal', 'muscular'],
    guidance: (n) => ({
      regionEn: 'Axial Vertebral Column',
      regionAr: 'العمود الفقري المحوري',
      arterial: 'Segmental spinal branches of vertebral, posterior intercostal, lumbar & lateral sacral arteries',
      venous: 'Internal & external vertebral venous plexuses (Batson plexus) -> Azygos & lumbar veins',
      innervation: 'Sinuvertebral (recurrent meningeal) nerves & posterior rami of adjacent spinal nerves',
      functionEn: `${n} transmits axial compressive loads while safeguarding the spinal cord, nerve roots, and vertebral vasculature during spinal flexion, extension, and rotation.`,
      functionAr: `تساهم بنية ${n} في نقل الأحمال المحورية وحماية الحبل الشوكي وجذور الأعصاب مع السماح بحركة الجذع.`,
      clinicalNotesEn: 'Batson valveless vertebral venous plexus permits retrograde pelvic/thoracic metastatic spread; ligamentum flavum is pierced during lumbar puncture.',
      clinicalNotesAr: 'تفتقر ضفيرة باتسون الوريدية الفقرية للصمامات مما يسمح بالانتشار الوريدي الراجع نحو الفقرات.',
    }),
  },
  {
    pattern: /\b(?:rib|costal|stern|manubrium|xiphoid|intercostal|costochondral|costovertebral|subcostal)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Thoracic Cage & Chest Wall',
      regionAr: 'القفص الصدري وجدار الصدر',
      arterial: 'Posterior intercostal arteries (thoracic aorta) & anterior intercostal branches (internal thoracic artery)',
      venous: 'Posterior intercostal veins -> Azygos/hemiazygos system; anterior intercostal veins -> Internal thoracic vein',
      innervation: 'Intercostal nerves (T1–T11 ventral rami) & subcostal nerve (T12)',
      functionEn: `${n} expands and recoils the thoracic cage through pump-handle and bucket-handle kinematics while protecting intrathoracic cardiopulmonary viscera.`,
      functionAr: `تشارك بنية ${n} في ميكانيكية الشهيق والزفير الصدري وحماية القلب والرئتين والأوعية الكبرى.`,
      clinicalNotesEn: 'The VAN neurovascular bundle (Vein-Artery-Nerve) runs along the inferior costal groove; needle thoracostomy traverses just above the rib margin.',
      clinicalNotesAr: 'تسير الحزمة الوعائية العصبية (وريد-شريان-عصب) في الثلم الضلعي السفلي، لذا يُجرى البزل فوق الحافة العلوية للضلع.',
    }),
  },
  {
    pattern: /\b(?:carpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarp|finger|thumb|pollicis|indicis|manus|palmar|thenar|hypothenar|lumbrical|pronator|supinator|brachioradial|flexor retinaculum|extensor retinaculum|flexor carpi|extensor carpi)[a-z]*\b|\b(?:flexor|extensor)\s+digitorum(?:\s+(?:superficialis|profundus))?\b/i,
    guidance: (n) => ({
      regionEn: 'Forearm, Wrist & Hand Complex',
      regionAr: 'الساعد والرسغ واليد',
      arterial: 'Radial & ulnar arteries -> Superficial/deep palmar & dorsal carpal arterial arches',
      venous: 'Radial/ulnar venae comitantes & superficial cephalic/basilic venous networks',
      innervation: 'Median (C6–T1), Ulnar (C8–T1) & Radial/Posterior interosseous (C6–C8) nerves',
      functionEn: `${n} coordinates fine manual dexterity, precision pinch, power grasp, and radiocarpal/radioulnar load transfer across the upper extremity.`,
      functionAr: `تُسهم بنية ${n} في القبض الدقيق وحركات الأصابع والرسغ ونقل القوة عبر الطرف العلوي.`,
      clinicalNotesEn: 'Scaphoid waist fractures jeopardize retrograde distal-to-proximal blood flow causing nonunion/AVN; carpal tunnel median compression impairs thenar opposition.',
      clinicalNotesAr: 'كسور عظم القاربي تعرضه للنخر اللاوعائي بسبب التروية الرجعية، وانضغاط العصب الناصف يسبب متلازمة النفق الرسغي.',
    }),
  },
  {
    pattern: /\b(?:glenohumeral|acromioclavicular|coracoacromial|coracoclavicular|coracoid|acromion|supraspin|infraspin|subscapular|teres|deltoid|biceps brach|triceps brach|humer|axill|subacromial|clavic|scapul)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Pectoral Girdle, Shoulder & Arm',
      regionAr: 'الحزام الكتفي والكتف والعضد',
      arterial: 'Subclavian/axillary branches (thoracoacromial, subscapular, circumflex humeral) & profunda brachii artery',
      venous: 'Axillary, subclavian, cephalic & basilic veins',
      innervation: 'Supraclavicular cords & terminal branches of the brachial plexus (C5–T1)',
      functionEn: `${n} integrates multi-planar glenohumeral/scapulothoracic mobility with dynamic humeral head centralization in the shallow glenoid fossa.`,
      functionAr: `تُسهم بنية ${n} في تحريك وتثبيت المفصل الحقاني العضدي وحزام الكتف خلال المدى الحركي الواسع للذراع.`,
      clinicalNotesEn: 'Surgical humeral neck trauma endangers the axillary nerve and posterior circumflex humeral artery; radial groove fractures threaten the radial nerve.',
      clinicalNotesAr: 'كسور العنق الجراحي للعضد تهدد العصب الإبطي بينما تهدد كسور الثلم الحلزوني العصب الكعبري.',
    }),
  },
  {
    pattern: /\b(?:tarsal|calcane|talus|navicular|cuboid|cuneiform|metatars|toe|halluc|pedis|plantar|ankle|subtalar|talocrural|fibular|tibial|gastrocnem|soleus|poplite|crural|achilles)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Leg, Ankle & Foot Complex',
      regionAr: 'الساق والكاحل والقدم',
      arterial: 'Anterior tibial, posterior tibial, fibular (peroneal) & dorsalis pedis -> Medial/lateral plantar arches',
      venous: 'Deep tibial/fibular venae comitantes & superficial great/small saphenous venous arches',
      innervation: 'Tibial nerve (medial/lateral plantar, S1–S3) & deep/superficial fibular nerves (L4–S1)',
      functionEn: `${n} stabilizes the ankle mortise, supports the longitudinal and transverse pedal arches, and propels bipedal gait push-off.`,
      functionAr: `تدعم بنية ${n} استقرار الكاحل وأقواس القدم الطولية والعرضية وتؤمن الدفع الحركي أثناء المشي والوقوف.`,
      clinicalNotesEn: 'Lisfranc (tarsometatarsal) instability, fifth metatarsal Jones fracture avascular zones, and ankle inversion sprains (ATFL) are critical pedal clinical considerations.',
      clinicalNotesAr: 'يعد مفصل ليسفرانك وأوتار الكاحل الوحشية والقاعدة الدانية للمشط الخامس من أبرز النقاط السريرية في إصابات القدم.',
    }),
  },
  {
    pattern: /\b(?:ilium|ischium|pubis|pubic|pelv|acetabul|sacroiliac|sacrotuberous|sacrospinous|obturator|glute|piriform|gemellus|quadratus femoris|perine|levator ani|coccygeus|inguinal|iliofemoral|pubofemoral|ischiofemoral)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Pelvic Girdle, Hip & Perineum',
      regionAr: 'الحوض والورك والعجان',
      arterial: 'Internal iliac (superior/inferior gluteal, obturator, internal pudendal) & medial/lateral femoral circumflex arteries',
      venous: 'Internal & external iliac venous plexuses -> Common iliac vein -> IVC',
      innervation: 'Lumbar & sacral plexuses (L4–S4: gluteal, obturator, pudendal & nerve to quadratus femoris/obturator internus)',
      functionEn: `${n} transfers upper-body loads across the sacroiliac-acetabular arch while supporting pelvic floor viscera and hip joint stability.`,
      functionAr: `تؤمّن بنية ${n} نقل وزن الجذع إلى الطرفين السفليين ودعم أحشاء الحوض وتثبيت مفصل الورك.`,
      clinicalNotesEn: 'Sacral plexus and internal iliac vessels lie closely on the posterior pelvic wall; medial femoral circumflex vessels are crucial for femoral head viability.',
      clinicalNotesAr: 'تجاور الضفيرة العجزية والأوعية الحرقفية الباطنة الجدار الحوضي الخلفي، كما تغذي الأوعية المنعطفة الفخذية رأس الفخذ.',
    }),
  },
  {
    pattern: /\b(?:femur|femoral|patella|knee|meniscus|cruciate|quadricep|vastus|rectus femoris|sartorius|gracilis|pectineus|adductor|hamstring|semitendinos|semimembranos|iliotibial)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Thigh & Knee Complex',
      regionAr: 'الفخذ ومفصل الركبة',
      arterial: 'Femoral, profunda femoris (perforating/circumflex) & genicular anastomotic branches',
      venous: 'Femoral, profunda femoris, popliteal & great saphenous veins',
      innervation: 'Femoral nerve (L2–L4 anterior), Obturator nerve (L2–L4 medial) & Sciatic nerve (L4–S3 posterior)',
      functionEn: `${n} governs weight-bearing locomotion, multi-planar knee stability, and hip propulsion across the anterior, medial, or posterior femoral compartments.`,
      functionAr: `تساهم بنية ${n} في حركات الفخذ والركبة ونقل الأحمال الحركية في الطرف السفلي.`,
      clinicalNotesEn: 'Check femoral canal/adductor hiatus neurovascular passage and meniscal-cruciate integrity ("Unhappy Triad": ACL, MCL, medial meniscus).',
      clinicalNotesAr: 'ترتبط سريرياً بقناة هانتر الممرّ للأوعية الفخذية وسلامة الأربطة الصليبية والغضاريف الهلالية.',
    }),
  },
  {
    pattern: /\b(?:cranial|skull|cranium|frontal|parietal|occipital|temporal|sphenoid|ethmoid|maxilla|mandib|zygomat|nasal|lacrimal|vomer|hyoid|tmj|temporomandibular|masseter|pterygo|buccin|orbicular|platysma|sternocleidomastoid|scalen|suprahyoid|infrahyoid)[a-z]*\b/i,
    guidance: (n) => ({
      regionEn: 'Cranium, Face & Cervical Region',
      regionAr: 'القحف والوجه والعنق',
      arterial: 'External/internal carotid, maxillary, facial, lingual & vertebral arterial branches',
      venous: 'Facial, retromandibular, external/internal jugular veins & dural venous sinuses',
      innervation: 'Cranial nerves (CN V trigeminal, CN VII facial, CN XI spinal accessory) & upper cervical plexus (C1–C4)',
      functionEn: `${n} provides craniofacial structural scaffolding, airway/mastication mechanics, and neurovascular protection across head and neck planes.`,
      functionAr: `تؤمّن بنية ${n} الدعامة القحفية الوجهية أو حركة المضغ والتعابير وحماية البنى العصبية والوعائية بالرأس والعنق.`,
      clinicalNotesEn: 'Carotid sheath and parotid facial nerve arborization govern surgical approaches across lateral neck and craniofacial triangles.',
      clinicalNotesAr: 'يعد الغمد السباتي وتفرعات العصب الوجهي في النكفة معالم حاسمة في جراحات الرأس والعنق.',
    }),
  },
  {
    pattern: /\b(?:gyrus|gyri|sulcus|sulci|cortex|lobe|hippocamp|amygdal|thalam|hypothalam|basal|caudate|putamen|pallidus|striatum|corpus callosum|fornix|ventricle|choroid|cerebell|pons|medulla|midbrain|brainstem|peduncle|mening|dura|arachnoid|pia|falx|tentorium)[a-z]*\b/i,
    systems: ['nervous'],
    guidance: (n) => ({
      regionEn: 'Central Nervous System (Encephalon)',
      regionAr: 'الجهاز العصبي المركزي (الدماغ)',
      arterial: 'Circle of Willis (internal carotid: anterior/middle cerebral) & vertebrobasilar (posterior cerebral/cerebellar) territories',
      venous: 'Superficial & deep cerebral veins -> Dural venous sinuses -> Internal jugular vein',
      innervation: 'Intrinsic central neural circuits; meninges supplied by trigeminal (CN V) & upper cervical C1–C3 meningeal rami',
      functionEn: `${n} mediates specialized integrative cortical, subcortical, limbic, brainstem, or cerebrospinal fluid homeostasis within the cranial vault.`,
      functionAr: `تؤدي بنية ${n} وظائف عصبية مركزية متخصصة في المعالجة القشرية أو التنظيم التحت قشري أو ديناميكية السائل الدماغي الشوكي.`,
      clinicalNotesEn: 'Vascular occlusion produces territorial neurological deficits reflecting anterior/middle/posterior cerebral or vertebrobasilar distribution.',
      clinicalNotesAr: 'يؤدي انسداد التروية في هذا الحيز إلى متلازمات عصبية بؤرية تتبع التوزع الشرياني الدماغي.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['nervous'],
    guidance: (n) => ({
      regionEn: 'Peripheral / Autonomic Neural Pathway',
      regionAr: 'المسار العصبي المحيطي والذاتي',
      arterial: 'Segmental neural nutrient arterioles arising from adjacent compartmental arterial trunks',
      venous: 'Concomitant epineurial venous channels -> Regional deep systemic veins',
      innervation: 'Myelinated somatic motor/sensory axons and/or unmyelinated autonomic postganglionic fibers',
      functionEn: `${n} conducts rapid bidirectional action potentials linking central spinal/brainstem nuclei with peripheral effector organs and sensory receptors.`,
      functionAr: `ينقل ${n} الإشارات العصبية الحركية والحسية والذاتية بين الجهاز العصبي المركزي والأعضاء المستهدفة.`,
      clinicalNotesEn: 'Vulnerable to entrapment syndromes, traction neuropathy, and iatrogenic compression along osteofibrous tunnels.',
      clinicalNotesAr: 'معرض لمتلازمات الانضغاط العصبي أو الإصابات الرضية ضمن الأنفاق العظمية الليفية.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['cardiovascular'],
    guidance: (n) => ({
      regionEn: 'Systemic / Regional Vascular & Cardiac Bed',
      regionAr: 'الشبكة القلبية الوعائية الجهازية',
      arterial: 'Coronary / adventitial mural nutrient supply & primary luminal arterial perfusion',
      venous: 'Concomitant venous drainage returning via venae comitantes, coronary sinus, or systemic caval trunks',
      innervation: 'Sympathetic vasomotor noradrenergic fibers & parasympathetic vagal/pelvic splanchnic innervation',
      functionEn: `${n} regulates luminal blood flow, intravascular pressure gradients, and tissue oxygen/nutrient exchange across its anatomical vascular bed.`,
      functionAr: `ينظم ${n} تدفق الدم والضغط الوعائي وتبادل الأكسجين والمغذيات في التروية الموضعية.`,
      clinicalNotesEn: 'Patency and anastomotic collateral capacity determine ischemic tolerance during atherosclerosis, thromboembolism, or surgical ligation.',
      clinicalNotesAr: 'تحدد سالكية هذا الوعاء وكفاءة المفاغرات الوعائية مدى مقاومة النسيج للإقفار والانصمام.',
    }),
  },
  {
    pattern: /\b(?:stomach|gastric|duoden|jejun|ileum|colon|caecum|cecum|rectum|rectal|esophag|oesophag|liver|hepat|gallbladder|bile|biliary|pancrea|spleen|splen|appendi|taenia|periton|mesocol|mesent|oment)[a-z]*\b/i,
    systems: ['visceral'],
    guidance: (n) => ({
      regionEn: 'Abdominopelvic Digestive & Hepatobiliary Viscera',
      regionAr: 'الأحشاء الهضمية والكبدية الصفراوية',
      arterial: 'Unpaired ventral aortic trunks: Celiac trunk (foregut), Superior mesenteric (midgut) & Inferior mesenteric (hindgut) arteries',
      venous: 'Splenic & superior/inferior mesenteric veins -> Hepatic portal vein -> IVC via hepatic veins',
      innervation: 'Celiac, superior/inferior mesenteric autonomic plexuses, Vagus nerve (CN X) & pelvic splanchnic (S2–S4)',
      functionEn: `${n} executes specialized gastrointestinal propulsion, enzymatic digestion, nutrient absorption, or hepatobiliary metabolic processing.`,
      functionAr: `يضطلع ${n} بوظائف الهضم أو الامتصاص أو الاستقلاب الكبدي الصفراوي ضمن القناة الهضمية.`,
      clinicalNotesEn: 'Embryological foregut/midgut/hindgut divisions dictate referred visceral pain zones (epigastric, periumbilical, suprapubic) and portosystemic collateral routes.',
      clinicalNotesAr: 'يحدد التقسيم الجنيني (أمامي/أوسط/خلفي) موضع الألم الحشوي المحال ومسارات التروية البابية.',
    }),
  },
  {
    pattern: /\b(?:kidney|renal|ureter|bladder|urethra|prostate|testis|uterus|ovary|ovarian|vagina|fallopian|adrenal|suprarenal|mammary|breast|nipple|seminal|epididym|deferens|penis|clitor)[a-z]*\b/i,
    systems: ['visceral'],
    guidance: (n) => ({
      regionEn: 'Retroperitoneal / Pelvic Urogenital & Endocrine Tract',
      regionAr: 'الجهاز البولي والتناسلي والكظري',
      arterial: 'Renal, gonadal & internal iliac (vesical, uterine, prostatic, middle rectal) arterial branches',
      venous: 'Renal, gonadal & internal iliac venous plexuses -> Inferior vena cava',
      innervation: 'Renal/hypogastric autonomic plexuses (T10–L2 sympathetic; S2–S4 pelvic splanchnic parasympathetic)',
      functionEn: `${n} mediates renal filtration/urine transport, neuroendocrine homeostasis, or reproductive gametogenesis and pelvic visceral support.`,
      functionAr: `يؤدي ${n} دوراً أساسياً في الترشيح الكلوي أو تصريف البول أو الوظيفة الغدية والتناسلية في الحوض.`,
      clinicalNotesEn: 'Close retroperitoneal ureter-gonadal-iliac crossing ("water under the bridge" beneath uterine artery / vas deferens) is critical in pelvic surgery.',
      clinicalNotesAr: 'تقاطع الحالب مع الأوعية الحرقفية والشريان الرحمي أو الأسهر من أبرز المعالم الجراحية الحوضية.',
    }),
  },
  {
    pattern: /\b(?:lung|pleura|trachea|bronch|larynx|laryngeal|pharynx|pharyngeal|nasopharynx|oropharynx|laryngopharynx|thyroid|parathyroid|thymus|tonsil|palate|tongue|salivary|parotid|submandibular|sublingual|epiglott|uvula)[a-z]*\b/i,
    systems: ['visceral'],
    guidance: (n) => ({
      regionEn: 'Aerodigestive, Thoracic & Cervical Visceral Tract',
      regionAr: 'المجرى التنفسي والهضمي العلوي والغدد العنقية والصدرية',
      arterial: 'Superior/inferior thyroid, lingual, ascending pharyngeal, facial, internal thoracic & bronchial arteries',
      venous: 'Internal jugular, brachiocephalic & azygos bronchial venous tributaries',
      innervation: 'Glossopharyngeal (CN IX), Vagus / Recurrent laryngeal (CN X), Hypoglossal (CN XII) & cervical sympathetic trunk',
      functionEn: `${n} coordinates airway patency and pulmonary pleural mechanics, swallowing deglutition, phonation, salivation, or thymic/thyroid immune-endocrine regulation.`,
      functionAr: `تؤمّن بنية ${n} سالكية مجرى التنفس أو الغشاء الجنبي والبلع والتصويت والإفراز اللعابي والتنظيم الصدري العنقي.`,
      clinicalNotesEn: 'Recurrent laryngeal nerves ascend in the tracheoesophageal groove behind the thyroid lobes, requiring meticulous intraoperative preservation.',
      clinicalNotesAr: 'يصعد العصب الحنجري الراجع في الثلم الرغامي المريئي خلف الغدة الدرقية ويتطلب حماية دقيقة جراحياً.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['visceral'],
    guidance: (n) => ({
      regionEn: 'Thoracoabdominal Visceral Cavities',
      regionAr: 'الأحشاء الصدرية والبطنية الحوضية',
      arterial: 'Direct visceral branches of the thoracic/abdominal aorta (celiac, mesenteric, renal, bronchial, thyroid) & internal iliac trunks',
      venous: 'Portal hepatic venous system & systemic azygos/caval venous tributaries',
      innervation: 'Autonomic cardiopulmonary, celiac, mesenteric & hypogastric plexuses (Sympathetic + Vagus CN X)',
      functionEn: `${n} executes specialized internal organ homeostasis across respiratory, digestive, endocrine, lymphoid, or urogenital physiological pathways.`,
      functionAr: `يؤدي ${n} وظائف حشوية داخلية متخصصة في التنفس أو الهضم أو الإفراز الغدي أو المناعة.`,
      clinicalNotesEn: 'Visceral peritoneum, pleura, and autonomic afferents transmit poorly localized deep midline pain whereas parietal serosal irritation sharpens localization.',
      clinicalNotesAr: 'تتميز الأحشاء بتوزع عصبي ذاتي يجعل الألم الحشوي مبهماً مقارنة بألم الصفاق أو الجنبة الجدارية.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['muscular'],
    guidance: (n) => ({
      regionEn: 'Musculoskeletal Motor Compartment',
      regionAr: 'الحيز العضلي الحركي',
      arterial: 'Muscular perforating branches of the adjacent compartmental arterial trunk & anastomotic arcades',
      venous: 'Paired deep venae comitantes -> Compartmental collecting vein',
      innervation: 'Compartmental somatic motor nerve & muscle spindle/Golgi tendon proprioceptive afferents',
      functionEn: `${n} generates coordinated contractile tension across its joint lever axis to power posture, joint stability, and smooth kinematics.`,
      functionAr: `تُولّد عضلة أو بنية ${n} شداً انقباضياً متناغماً لتحقيق الثبات المفصلي والحركة الميكانيكية المتزنة.`,
      clinicalNotesEn: 'Compartment fascia tightness predisposes this compartment to exertional or post-traumatic compartment syndrome and myotendinous strain.',
      clinicalNotesAr: 'قد تتعرض للإجهاد الوتري العضلي أو متلازمة الحيز عند ارتفاع الضغط اللفافي.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['skeletal'],
    guidance: (n) => ({
      regionEn: 'Osteoarticular Load-Bearing Framework',
      regionAr: 'الإطار العظمي المفصلي',
      arterial: 'Diaphyseal nutrient artery & epiphyseal/metaphyseal periosteal arterial plexuses',
      venous: 'Intraosseous medullary & periosteal veins -> Concomitant regional deep veins',
      innervation: 'Somatic periosteal nociceptive fibers & Hilton-law articular nerve branches',
      functionEn: `${n} provides rigid mechanical leverage, trabecular load distribution, hematopoietic marrow housing, and mineral reservoir regulation.`,
      functionAr: `يؤمّن ${n} الارتكاز الميكانيكي ونقل الأحمال عبر التربيق العظمي وخزن المعادن والنقي.`,
      clinicalNotesEn: 'Periosteal vascular stripping or high-energy comminution impairs callus remodeling; articular involvement requires anatomical joint-surface reduction.',
      clinicalNotesAr: 'تعتمد التئام الكسور على سلامة السمحاق والتروية الغذائية وعودة تطابق السطوح المفصلية.',
    }),
  },
  {
    pattern: /.+/,
    systems: ['integumentary'],
    guidance: (n) => ({
      regionEn: 'Integumentary Cutaneous Surface',
      regionAr: 'الجهاز اللحافي والجلد',
      arterial: 'Subdermal, papillary & musculocutaneous perforating arterial plexuses',
      venous: 'Subpapillary & subcutaneous venous plexuses -> Superficial & deep veins',
      innervation: 'Segmental dermatomal cutaneous sensory fibers & sympathetic cholinergic/adrenergic efferents',
      functionEn: `${n} forms the primary barrier against pathogens and UV radiation while regulating cutaneous thermoregulation and mechanoreception.`,
      functionAr: `يؤمّن ${n} الحماية الحاجزية وتنظيم الحرارة واستقبال المنبهات الحسية السطحية.`,
      clinicalNotesEn: 'Tension lines (Langer cleavage lines) guide surgical incisions to minimize hypertrophic scarring along cutaneous planes.',
      clinicalNotesAr: 'توجّه خطوط لانغر الشقوق الجراحية الجلدية لتقليل الندبات وتحسين الالتئام.',
    }),
  },
];

function resolveRegionalClinicalGuidance(
  part: AnatomicalPartInfo
): RegionalClinicalGuidance {
  const haystack = `${part.cleanName} ${part.latinName} ${part.rawName}`.replace(
    /_/g,
    ' '
  );
  for (const rule of REGIONAL_CLINICAL_GUIDANCE_RULES) {
    if (rule.systems && !rule.systems.includes(part.system)) {
      continue;
    }
    if (rule.pattern.test(haystack)) {
      return rule.guidance(part.cleanName);
    }
  }
  const systemMatch = REGIONAL_CLINICAL_GUIDANCE_RULES.find(
    (r) => !r.systems || r.systems.includes(part.system)
  );
  return (systemMatch || REGIONAL_CLINICAL_GUIDANCE_RULES[0]).guidance(
    part.cleanName
  );
}

function stripLateralityWords(cleanName: string): string {
  return cleanName
    .replace(/\b(left|right|sinister|sinistra|dexter|dextra)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatEnglishNameWithLaterality(
  baseName: string,
  laterality: AnatomicalLaterality
): string {
  if (laterality === 'Median / Unpaired') return baseName;
  if (
    baseName.toLowerCase().includes('left') ||
    baseName.toLowerCase().includes('right')
  ) {
    return baseName;
  }
  return `${laterality} ${baseName}`;
}

function formatArabicNameWithLaterality(
  baseAr: string,
  laterality: AnatomicalLaterality
): string {
  if (/أيمن|أيسر|اليمنى|اليسرى/.test(baseAr)) return baseAr;
  if (laterality === 'Left') return `${baseAr} (أيسر)`;
  if (laterality === 'Right') return `${baseAr} (أيمن)`;
  return baseAr;
}

const ARABIC_MODIFIER_MAP: Record<string, string> = {
  anterior: 'الأمامي',
  posterior: 'الخلفي',
  superior: 'العلوي',
  inferior: 'السفلي',
  medial: 'الإنسي',
  lateral: 'الوحشي',
  central: 'المركزي',
  peripheral: 'الطرفي',
  ascending: 'الصاعد',
  descending: 'النازل',
  transverse: 'المستعرض',
  oblique: 'المائل',
  external: 'الظاهر',
  internal: 'الباطن',
  superficial: 'السطحي',
  deep: 'العميق',
  common: 'المشترك',
  proper: 'الخاص',
  major: 'الكبير',
  minor: 'الصغير',
  greater: 'الأكبر',
  lesser: 'الأصغر',
  upper: 'العلوي',
  lower: 'السفلي',
  middle: 'الأوسط',
  proximal: 'القريب',
  distal: 'القاصي',
  dorsal: 'الظهري',
  ventral: 'البطني',
  cranial: 'القحفي',
  maxillary: 'الفكي العلوي',
  mandibular: 'الفكي السفلي',
  palmar: 'الراحي',
  plantar: 'الأخمصي',
  longus: 'الطويل',
  brevis: 'القصير',
  magnus: 'الكبير',
  minimus: 'الأصغر',
  interosseous: 'بين العظام',
  collateral: 'الجانبي',
  cruciate: 'الصليبي',
  annular: 'الحلقي',
  articulation: 'المفصلي',
  articular: 'المفصلي',
  temporomandibular: 'الفكي الصدغي',
  sacroiliac: 'العجزي الحرقفي',
  glenohumeral: 'الحقاني العضدي',
  sternoclavicular: 'القصي الترقوي',
  acromioclavicular: 'الأخرمي الترقوي',
  intervertebral: 'بين الفقرات',
  costal: 'الضلعي',
  subclavius: 'تحت الترقوة',
  supraspinatus: 'فوق الشوكة',
  infraspinatus: 'تحت الشوكة',
  subscapularis: 'تحت الكتف',
  teres: 'المدورة',
  serratus: 'المنشارية',
  pectoralis: 'الصدرية',
  rhomboid: 'المعينية',
  biceps: 'ذات الرأسين',
  triceps: 'ثلاثية الرؤوس',
  quadriceps: 'رباعية الرؤوس',
  vastus: 'المتسعة',
  rectus: 'المستقيمة',
  flexor: 'القابضة',
  extensor: 'الباسطة',
  abductor: 'المبعدة',
  adductor: 'المقربة',
  pronator: 'الكابة',
  supinator: 'الباصطة',
  rotator: 'المدورة',
  levator: 'الرافعة',
  depressor: 'الخافضة',
  sphincter: 'العاصرة',
  tensor: 'الموترة',
  lumbrical: 'الدودية',
  sartorius: 'الخياطية',
  soleus: 'النعلية',
  gracilis: 'الرشيقة',
  pectineus: 'المشطية',
  piriformis: 'الكمثرية',
  popliteus: 'المأبضية',
  brachialis: 'العضدية',
  brachioradialis: 'العضدية الكعبرية',
  coracobrachialis: 'الغرابية العضدية',
  buccinator: 'المبوقة',
  platysma: 'المبطحة',
  orbicularis: 'الدويرية',
  zygomaticus: 'الوجنية',
  iliopsoas: 'الحرقفية القطنية',
  iliacus: 'الحرقفية',
  psoas: 'القطنية',
  gastrocnemius: 'الساقية',
  gluteus: 'الألوية',
  peroneal: 'الشظوي',
  median: 'الناصف',
  sural: 'الربلي',
  saphenous: 'الصافن',
  phrenic: 'الحجابي',
  obturator: 'السدادي',
  pudendal: 'الفرجي',
  azygos: 'الفرد',
  hemiazygos: 'نصف الفرد',
  portal: 'البابي',
  sagittal: 'السهمي',
  cavernous: 'الكهفي',
  sigmoid: 'السيني',
  caudal: 'الذيلي',
  frontal: 'الجبهي',
  parietal: 'الجداري',
  temporal: 'الصدغي',
  occipital: 'القذالي',
  prefrontal: 'أمام الجبهي',
  cerebral: 'المخي',
  cerebellar: 'المخيخي',
  pontine: 'الجسري',
  medullary: 'البصلي',
  spinal: 'الشوكي',
  cervical: 'العنقي',
  thoracic: 'الصدرية',
  lumbar: 'القطنية',
  sacral: 'العجزية',
  coccygeal: 'العصعصية',
  pelvic: 'الحوضي',
  abdominal: 'البطني',
  pectoral: 'الصدري',
  brachial: 'العضدي',
  radial: 'الكعبري',
  ulnar: 'الزندي',
  femoral: 'الفخذي',
  tibial: 'الظنبوبي',
  fibular: 'الشظوي',
  popliteal: 'المأبضي',
  carotid: 'السباتي',
  jugular: 'الوداجي',
  subclavian: 'تحت الترقوة',
  iliac: 'الحرقفي',
  renal: 'الكلوي',
  hepatic: 'الكبدي',
  gastric: 'المعدي',
  splenic: 'الطحالي',
  pancreatic: 'البنكرياسي',
  pulmonary: 'الرئوي',
  cardiac: 'القلبي',
  coronary: 'التاجي',
  mesenteric: 'المساريقي',
  basilar: 'القاعدي',
  basal: 'القاعدي',
  apical: 'القِمّي',
  orbital: 'الحجاجي',
  optic: 'البصري',
  olfactory: 'الشمي',
  auditory: 'السمعي',
  vestibular: 'الدهليزي',
  trigeminal: 'ثلاثي التوائم',
  facial: 'الوجهي',
  vagal: 'المبهمي',
  lingual: 'اللساني',
  pharyngeal: 'البلعومي',
  laryngeal: 'الحنجري',
  esophageal: 'المريئي',
  tracheal: 'الرغامي',
  bronchial: 'القصبي',
  aortic: 'الأبهري',
  palatine: 'الحنكي',
  nasal: 'الأنفي',
  oral: 'الفموي',
  subcortical: 'تحت القشري',
  cortical: 'القشري',
  limbic: 'الحوفي',
  white: 'الأبيض',
  gray: 'الرمادي',
  grey: 'الرمادي',
  main: 'الرئيسي',
  primary: 'الأولي',
  secondary: 'الثانوي',
  long: 'الطويل',
  short: 'القصير',
  first: 'الأول',
  second: 'الثاني',
  third: 'الثالث',
  fourth: 'الرابع',
};

const ARABIC_NOUN_MAP: Record<string, string> = {
  part: 'الجزء',
  portion: 'القسم',
  region: 'المنطقة',
  segment: 'القطعة',
  lobe: 'الفص',
  lobule: 'الفصيص',
  nucleus: 'النواة',
  nuclei: 'النوى',
  cortex: 'القشرة',
  gyrus: 'التلفيف',
  sulcus: 'الثلم',
  fissure: 'الشق',
  ventricle: 'البطين',
  atrium: 'الأذين',
  valve: 'الصمام',
  septum: 'الحاجز',
  horn: 'القرن',
  body: 'الجسم',
  head: 'الرأس',
  neck: 'العنق',
  base: 'القاعدة',
  apex: 'القمة',
  root: 'الجذر',
  arch: 'القوس',
  trunk: 'الجذع',
  branch: 'الفرع',
  wall: 'الجدار',
  pole: 'القطب',
  tract: 'السبيل',
  peduncle: 'السويقة',
  capsule: 'المحفظة',
  fasciculus: 'الحزمة',
  commissure: 'الصوار',
  ganglion: 'العقدة العصبية',
  plexus: 'الضفيرة',
  nerve: 'العصب',
  nerves: 'الأعصاب',
  artery: 'الشريان',
  arteries: 'الشرايين',
  vein: 'الوريد',
  veins: 'الأوردة',
  vessel: 'الوعاء الدموي',
  vessels: 'الأوعية الدموية',
  sinus: 'الجيب',
  aorta: 'الأبهر',
  vena: 'الوريد',
  cava: 'الأجوف',
  pons: 'الجسر',
  medulla: 'النخاع المستطيل',
  oblongata: 'المستطيل',
  midbrain: 'الدماغ المتوسط',
  mesencephalon: 'الدماغ المتوسط',
  thalamus: 'المهاد',
  hypothalamus: 'الوطاء (تحت المهاد)',
  hippocampus: 'الحُصَين',
  amygdala: 'اللوزة الدماغية',
  callosum: 'الثفني',
  cerebellum: 'المخيخ',
  brain: 'الدماغ',
  brainstem: 'جذع الدماغ',
  cord: 'الحبل',
  striatum: 'الجسم المخطط',
  putamen: 'البطامة',
  pallidus: 'الشاحبة',
  caudate: 'المذنبة',
  insula: 'الجزيرة',
  fornix: 'القبو',
  chiasm: 'التصالب',
  pituitary: 'الغدة النخامية',
  pineal: 'الغدة الصنوبرية',
  heart: 'القلب',
  lung: 'الرئة',
  lungs: 'الرئتان',
  trachea: 'القصبة الهوائية',
  bronchus: 'القصبة الهوائية',
  larynx: 'الحنجرة',
  pharynx: 'البلعوم',
  esophagus: 'المريء',
  oesophagus: 'المريء',
  pleura: 'الجنبة',
  nasopharynx: 'البلعوم الأنفي',
  oropharynx: 'البلعوم الفموي',
  laryngopharynx: 'البلعوم الحنجري',
  taenia: 'الشريطية القولونية',
  omental: 'الثربية',
  mesocolic: 'المساريقية القولونية',
  mesocolon: 'مساريقا القولون',
  mesentery: 'المساريقا',
  free: 'الحرة',
  stomach: 'المعدة',
  duodenum: 'الاثنا عشر',
  jejunum: 'الصائم',
  ileum: 'اللفائفي',
  intestine: 'الأمعاء',
  colon: 'القولون',
  cecum: 'الأعور',
  rectum: 'المستقيم',
  liver: 'الكبد',
  gallbladder: 'المرارة',
  pancreas: 'البنكرياس',
  spleen: 'الطحال',
  kidney: 'الكلية',
  kidneys: 'الكليتان',
  ureter: 'الحالب',
  bladder: 'المثانة',
  urethra: 'الإحليل',
  prostate: 'البروستاتا',
  testis: 'الخصية',
  testes: 'الخصيتان',
  ovary: 'المبيض',
  uterus: 'الرحم',
  thymus: 'الغدة الزعترية',
  thyroid: 'الغدة الدرقية',
  tonsil: 'اللوزة',
  lymph: 'اللمف',
  node: 'العقدة',
  nodes: 'العقد',
  gland: 'الغدة',
  diaphragm: 'الحجاب الحاجز',
  skin: 'الجلد',
  bone: 'العظم',
  cranium: 'الجمجمة',
  skull: 'الجمجمة',
  mandible: 'الفك السفلي',
  maxilla: 'الفك العلوي',
  rib: 'الضلع',
  ribs: 'الأضلاع',
  sternum: 'عظم القص',
  vertebra: 'الفقرة',
  vertebrae: 'الفقرات',
  sacrum: 'العجز',
  coccyx: 'العصعص',
  pelvis: 'الحوض',
  clavicle: 'الترقوة',
  scapula: 'لوح الكتف',
  humerus: 'العضد',
  radius: 'الكعبرة',
  ulna: 'الزند',
  femur: 'الفخذ',
  patella: 'الرضفة',
  tibia: 'الظنبوب',
  fibula: 'الشظية',
  carpals: 'عظام الرسغ',
  metacarpals: 'عظام المشط',
  tarsals: 'عظام الرصغ',
  metatarsals: 'أمشاط القدم',
  phalanges: 'السلاميات',
  muscle: 'العضلة',
  muscles: 'العضلات',
  tendon: 'الوتر',
  ligament: 'الرباط',
  cartilage: 'الغضروف',
  fascia: 'اللفافة',
  matter: 'المادة',
  nucleus_of: 'نواة',
  pelvis_renal: 'حويضة الكلية',
  cyst: 'الكيس',
  duct: 'القناة',
  canal: 'القناة',
  foramen: 'الثقبة',
  fossa: 'الحفرة',
  ridge: 'الحرف',
  plate: 'الصفيحة',
  process: 'الناتئ',
  spine: 'الشوكة',
  crest: 'العرف',
  tubercle: 'الحديبة',
  condyle: 'اللقمة',
  joint: 'المفصل',
  membrane: 'الغشاء',
  sheath: 'الغمد',
  layer: 'الطبقة',
  cavity: 'التجويف',
  aponeurosis: 'الصفاق',
  retinaculum: 'القيد',
  bursa: 'الجراب',
  meniscus: 'الغضروف الهلالي',
  disc: 'القرص',
  tooth: 'السن',
  teeth: 'الأسنان',
  incisor: 'القاطعة',
  canine: 'الناب',
  premolar: 'الضاحك',
  molar: 'الرحى',
  gingiva: 'اللثة',
  enamel: 'مينا السن',
  phalanx: 'السلامية',
  metacarpal: 'مشط اليد',
  carpal: 'عظم الرسغ',
  metatarsal: 'مشط القدم',
  tarsal: 'عظم الرصغ',
  calcaneus: 'عظم العقب',
  talus: 'عظم القعب',
  navicular: 'العظم الزورقي',
  cuboid: 'العظم النردي',
  cuneiform: 'العظم الإسفيني',
  scaphoid: 'العظم القاربي',
  lunate: 'العظم الهلالي',
  capitate: 'العظم الكبير',
  hamate: 'العظم الكلابي',
  trapezium: 'العظم المربعي',
  trapezoid: 'العظم المنحرف',
  pisiform: 'العظم الحمصي',
  triquetrum: 'العظم المثلثي',
  ilium: 'الحرقفة',
  ischium: 'الورك',
  pubis: 'العانة',
  acetabulum: 'الحُق',
  sacral: 'العجزي',
  eyelashes: 'الرموش',
  eyelash: 'الرموش',
  eyebrow: 'الحاجب',
  eyebrows: 'الحاجبان',
  cornea: 'القرنية',
  sclera: 'الصلبة',
  retina: 'الشبكية',
  lens: 'العدسة',
  iris: 'القزحية',
  palpebra: 'الجفن',
  epiglottis: 'لسان المزمار',
  uvula: 'اللهاة',
  tongue: 'اللسان',
  palate: 'الحنك',
  parotid: 'الغدة النكفية',
  submandibular: 'تحت الفك السفلي',
  sublingual: 'تحت اللسان',
  adrenal: 'الغدة الكظرية',
  suprarenal: 'فوق الكلية',
  appendix: 'الزائدة الدودية',
  fallopian: 'قناة فالوب',
  vagina: 'المهبل',
  penis: 'القضيب',
  scrotum: 'الصفن',
  epididymis: 'البربخ',
  vas: 'الأسهر',
  gemellus: 'العضلة التوأمية',
  quadratus: 'العضلة المربعة',
  tensor: 'العضلة الموترة',
  obturator: 'السدادية',
  deltoid: 'العضلة الدالية',
  trapezius: 'العضلة شبه المنحرفة',
  latissimus: 'العضلة العريضة الظهرية',
  masseter: 'العضلة الماضغة',
  temporalis: 'العضلة الصدغية',
  sternocleidomastoid: 'العضلة القصية الترقوية الخشائية',
};

const PREPOSITIONAL_HEADWORD_REGEX =
  /\b(?:part|portion|region|segment|lobe|lobule|nucleus|cortex|gyrus|sulcus|ventricle|valve|branch|trunk|apex|base|body|head|neck|root|arch|wall|horn|pole|surface|layer|floor|roof|tendon|sheath|fascia|bursa|capsule|ligament|muscle)\s+of(?:\s+the)?\s+(.+)$/i;

// Compound anatomical names where Left/Right is an intrinsic anatomical identity (chambers,
// lobes, valves, asymmetric vessels/ducts) rather than simple paired laterality.
const PRESERVE_COMPOUND_QUALIFIER_REGEX =
  /\b(?:left|right)\s+(?:ventricle|atrium|auricle|coronary|subclavian|brachiocephalic|recurrent\s+laryngeal|gastric|gastroepiploic|colic|lymphatic\s+duct|cerebral|hemisphere|bundle\s+branch|(?:upper|middle|lower|superior|inferior)\s+lobe)\b|(?:ventricle|atrium|auricle)\s+of\s+(?:the\s+)?heart\b/i;

export interface CanonicalMedicalTermInfo {
  canonicalName: string;
  headword: string | null;
  searchCandidates: string[];
}

/**
 * Extracts a clean canonical Wikipedia/medical query term plus its structural parent headword
 * while strictly preserving intrinsic qualifiers on cardiac chambers, lobes, valves, and ducts.
 */
export function extractCanonicalMedicalTerm(
  rawOrCleanName: string
): CanonicalMedicalTermInfo {
  const compoundCleaned = rawOrCleanName
    .replace(
      /^(?:allen[_\s]+brain|allen|vh[_\s]+[mf]|vh|sbu[_\s]+[mf]|sbu|yao|nih)[_\s-]+/i,
      ''
    )
    .replace(/[_\-.]+/g, ' ')
    .replace(/\((?:[^)]*)\)/g, ' ')
    .replace(/\b\d+\s*(?:[-–]\s*\d+|\d+)?\b/g, ' ')
    .replace(/\s+[a-km-qs-z]$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const shouldPreserveCompound =
    PRESERVE_COMPOUND_QUALIFIER_REGEX.test(compoundCleaned) ||
    Boolean(BASELINE_DICTIONARY[compoundCleaned.toLowerCase()]) ||
    Boolean(ENTRY_ALIASES[compoundCleaned.toLowerCase()]);

  let cleaned = shouldPreserveCompound
    ? compoundCleaned
    : compoundCleaned
        .replace(/\b(?:left|right|bilateral)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

  if (!cleaned) {
    cleaned = compoundCleaned || rawOrCleanName.trim();
  }

  let headword: string | null = null;
  const prepMatch = PREPOSITIONAL_HEADWORD_REGEX.exec(cleaned);
  if (prepMatch?.[1]) {
    headword = prepMatch[1].trim();
  } else if (/\bof(?:\s+the)?\s+/i.test(cleaned)) {
    const parts = cleaned.split(/\bof(?:\s+the)?\s+/i);
    const tail = parts[parts.length - 1]?.trim();
    if (tail && tail.toLowerCase() !== cleaned.toLowerCase()) {
      headword = tail;
    }
  }

  if (!headword) {
    const lower = cleaned.toLowerCase();
    const keys = Object.keys(BASELINE_DICTIONARY).sort(
      (a, b) => b.length - a.length
    );
    for (const k of keys) {
      if (lower !== k && lower.includes(k)) {
        headword = BASELINE_DICTIONARY[k].wikiSearchTitleEn;
        break;
      }
    }
  }

  const candidates: string[] = [];
  const pushUnique = (val: string | null | undefined) => {
    const trimmed = val?.trim();
    if (
      trimmed &&
      !candidates.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      candidates.push(trimmed);
    }
  };

  pushUnique(cleaned);
  if (headword) {
    pushUnique(headword);
    if (headword.includes(' ')) {
      const lastWord = headword.split(/\s+/).pop();
      if (lastWord && lastWord.length >= 4) {
        pushUnique(lastWord);
      }
    }
  }

  return {
    canonicalName: cleaned,
    headword,
    searchCandidates: candidates,
  };
}

/**
 * Translates compound anatomical terms (including granular sub-meshes like
 * "Basilar Part of Pons Left") into natural Arabic medical phrasing without
 * leaving bare English fallback headers.
 */
export function translateAnatomicalTermToArabic(
  cleanNameEn: string,
  laterality: AnatomicalLaterality,
  system: AnatomicalSystem,
  baselineAr?: string
): string {
  const { canonicalName } = extractCanonicalMedicalTerm(cleanNameEn);
  const normalizedKey = canonicalName.toLowerCase();

  const exactAliasKey = ENTRY_ALIASES[normalizedKey] ?? normalizedKey;
  const exactDict = BASELINE_DICTIONARY[exactAliasKey];
  if (exactDict) {
    return formatArabicNameWithLaterality(exactDict.cleanNameAr, laterality);
  }

  // Handle "X of Y" Arabic genitive ("الـX لـY" / "الـX من Y")
  const ofSplit = canonicalName.split(/\s+of(?:\s+the)?\s+/i);
  const translateChunk = (
    chunk: string
  ): { text: string; translatedCount: number; totalCount: number } => {
    const words = chunk
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && w !== 'the' && w !== 'and' && w !== 'or');

    const nouns: string[] = [];
    const mods: string[] = [];
    let translatedCount = 0;

    for (const w of words) {
      if (ARABIC_NOUN_MAP[w]) {
        nouns.push(ARABIC_NOUN_MAP[w]);
        translatedCount++;
      } else if (ARABIC_MODIFIER_MAP[w]) {
        mods.push(ARABIC_MODIFIER_MAP[w]);
        translatedCount++;
      }
    }

    if (translatedCount === 0) {
      return { text: '', translatedCount: 0, totalCount: words.length };
    }
    const ordered = [...nouns, ...mods].join(' ');
    return {
      text: ordered,
      translatedCount,
      totalCount: words.length,
    };
  };

  if (ofSplit.length >= 2) {
    const prefixChunk = translateChunk(ofSplit[0]);
    const targetChunk = translateChunk(ofSplit.slice(1).join(' '));
    if (prefixChunk.translatedCount > 0 && targetChunk.translatedCount > 0) {
      const combined = `${prefixChunk.text} من ${targetChunk.text}`;
      return formatArabicNameWithLaterality(combined, laterality);
    }
    if (targetChunk.translatedCount > 0) {
      return formatArabicNameWithLaterality(
        `${targetChunk.text} (${SYSTEM_ARABIC_NAMES[system]})`,
        laterality
      );
    }
  }

  const singleChunk = translateChunk(canonicalName);
  if (singleChunk.translatedCount > 0) {
    return formatArabicNameWithLaterality(singleChunk.text, laterality);
  }

  if (baselineAr) {
    return formatArabicNameWithLaterality(baselineAr, laterality);
  }

  return `${SYSTEM_ARABIC_NAMES[system]} (${canonicalName})`;
}

export interface ResolvedBaseline {
  profile: AnatomicalClinicalProfile;
  wikiSearchTerm: string;
  searchCandidates: string[];
  fallbackArTitle?: string;
}

/**
 * Resolves a normalized AnatomicalPartInfo into a structured bilingual clinical profile
 * using verified baseline entries, canonical headword matching, or intelligent compound
 * Arabic translation for granular Allen/NIH sub-meshes.
 */
function inferRegionalTa98Fallback(part: AnatomicalPartInfo): string {
  const txt = `${part.cleanName} ${part.latinName}`.toLowerCase();
  if (/\b(incisor|canine|premolar|molar|tooth|teeth|gingiva)\b/.test(txt)) {
    return 'A05.1.03.001';
  }
  if (/\b(eyelash|eyebrow|palpebr|cornea|lacrimal|sclera)\b/.test(txt)) {
    return 'A15.2.07.001';
  }
  if (/\b(vertebra|cervical|thoracic|lumbar|atlas|axis|sacr|coccy|intervertebral)\b/.test(txt)) {
    return 'A02.2.01.001';
  }
  if (/\b(rib|costal|stern|manubrium|xiphoid)\b/.test(txt)) {
    return 'A02.3.01.001';
  }
  if (/\b(carpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarp|finger|thumb)\b/.test(txt)) {
    return 'A02.4.08.001';
  }
  if (/\b(tarsal|calcane|talus|navicular|cuboid|cuneiform|metatars|toe|halluc)\b/.test(txt)) {
    return 'A02.5.08.001';
  }
  const bySystem: Record<AnatomicalSystem, string> = {
    integumentary: 'A16.0.00.001',
    skeletal: 'A02.1.00.001',
    muscular: 'A04.1.00.001',
    visceral: 'A05.4.01.001',
    cardiovascular: 'A12.2.00.001',
    nervous: 'A14.2.00.001',
  };
  return bySystem[part.system];
}

export function resolveClinicalBaseline(
  part: AnatomicalPartInfo
): ResolvedBaseline {
  const { canonicalName, headword, searchCandidates } =
    extractCanonicalMedicalTerm(part.cleanName);

  const compoundExactKey = part.cleanName
    .replace(/[_\-.]+/g, ' ')
    .replace(/\((?:[^)]*)\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const rawBaseKey = (
    stripLateralityWords(part.cleanName) || canonicalName
  ).toLowerCase();
  const baseKey =
    ENTRY_ALIASES[compoundExactKey] ??
    (BASELINE_DICTIONARY[compoundExactKey] ? compoundExactKey : undefined) ??
    ENTRY_ALIASES[rawBaseKey] ??
    rawBaseKey;
  const singularKey = baseKey.replace(/s$/, '');
  const resolvedSingularKey = ENTRY_ALIASES[singularKey] ?? singularKey;

  const textbookHit = resolveTextbookEntry(
    part.cleanName,
    part.latinName,
    part.system
  );
  const tb = textbookHit?.entry;

  const entry =
    BASELINE_DICTIONARY[baseKey] ??
    BASELINE_DICTIONARY[resolvedSingularKey];

  if (entry) {
    const baseCleanAr = formatArabicNameWithLaterality(
      entry.cleanNameAr,
      part.laterality
    );
    const primarySummaryEn = textbookHit?.hasSubstantiveTextbookContent
      ? pickCleanTextbookField(tb?.summaryEn, entry.summaryEn)
      : entry.summaryEn;
    const primaryNotesEn =
      tb?.clinicalNotesEn && tb.clinicalNotesEn.length > 40
        ? pickCleanTextbookField(tb.clinicalNotesEn, entry.clinicalNotesEn)
        : entry.clinicalNotesEn;
    const cleanOrigin = pickCleanTextbookField(tb?.origin, entry.origin);
    const cleanInsertion = pickCleanTextbookField(tb?.insertion, entry.insertion);
    const cleanAction = pickCleanTextbookField(tb?.action, entry.action);

    return {
      wikiSearchTerm: entry.wikiSearchTitleEn,
      searchCandidates: Array.from(
        new Set([entry.wikiSearchTitleEn, ...searchCandidates])
      ),
      fallbackArTitle: entry.wikiSearchTitleAr,
      profile: {
        id: part.rawName || part.meshUuid,
        cleanNameEn: formatEnglishNameWithLaterality(
          entry.cleanNameEn,
          part.laterality
        ),
        cleanNameAr: baseCleanAr,
        latinName: part.latinName || entry.latinName,
        ta98Code: entry.ta98Code,
        fmaId: entry.fmaId,
        system: part.system,
        laterality: part.laterality,
        region: pickCleanTextbookField(tb?.region, entry.region),
        muscleGroup: tb?.muscleGroup,
        summaryEn: primarySummaryEn,
        summaryAr: entry.summaryAr,
        primaryFunctionEn: pickCleanTextbookField(
          tb?.primaryFunctionEn || cleanAction,
          entry.primaryFunctionEn
        ),
        primaryFunctionAr: entry.primaryFunctionAr,
        origin: cleanOrigin,
        insertion: cleanInsertion,
        action: cleanAction,
        relationsEn: pickCleanTextbookField(tb?.relationsEn, entry.relationsEn),
        arterialSupply: pickCleanTextbookField(
          tb?.arterialSupply,
          entry.arterialSupply
        ),
        venousDrainage: pickCleanTextbookField(
          tb?.venousDrainage,
          entry.venousDrainage
        ),
        innervation: pickCleanTextbookField(tb?.innervation, entry.innervation),
        clinicalNotesEn: primaryNotesEn,
        clinicalNotesAr: entry.clinicalNotesAr,
        bookSourceLabel:
          textbookHit?.bookSourceLabel || "Gray's 4e & Netter 7e Baseline",
        textbookRefCitation: textbookHit?.citationLabel,
        netterPlates: tb?.netterPlates,
        wikipediaUrlEn: `https://en.wikipedia.org/wiki/${encodeURIComponent(
          entry.wikiSearchTitleEn.replace(/\s+/g, '_')
        )}`,
        wikipediaUrlAr: `https://ar.wikipedia.org/wiki/${encodeURIComponent(
          entry.wikiSearchTitleAr.replace(/\s+/g, '_')
        )}`,
        source: textbookHit ? 'textbook-primary' : 'clinical-baseline',
      },
    };
  }

  // Try matching extracted parent headword / word-boundary alias against BASELINE_DICTIONARY
  const lookupKeys: string[] = [];
  if (headword) {
    const hwLower = headword.toLowerCase();
    lookupKeys.push(ENTRY_ALIASES[hwLower] ?? hwLower);
    lookupKeys.push((ENTRY_ALIASES[hwLower] ?? hwLower).replace(/s$/, ''));
  }
  const canonicalLower = canonicalName.toLowerCase();
  const paddedCanonical = ` ${canonicalLower} `;
  const dictKeysSorted = Object.keys(BASELINE_DICTIONARY).sort(
    (a, b) => b.length - a.length
  );
  for (const k of dictKeysSorted) {
    if (paddedCanonical.includes(` ${k} `)) {
      lookupKeys.push(k);
    }
  }
  const aliasKeysSorted = Object.keys(ENTRY_ALIASES).sort(
    (a, b) => b.length - a.length
  );
  for (const aKey of aliasKeysSorted) {
    if (paddedCanonical.includes(` ${aKey} `)) {
      lookupKeys.push(ENTRY_ALIASES[aKey]);
    }
  }

  const headEntry = lookupKeys
    .map((k) => BASELINE_DICTIONARY[k])
    .find(Boolean);

  const translatedArName =
    part.cleanNameAr && !/الجزء|\bpart\b/i.test(part.cleanNameAr)
      ? part.cleanNameAr
      : translateAnatomicalTermToArabic(
          part.cleanName,
          part.laterality,
          part.system,
          headEntry?.cleanNameAr
        );

  const safeArName =
    translatedArName && !/^\s*الجزء(?:\s*\d+)?\s*$/i.test(translatedArName)
      ? translatedArName
      : SYSTEM_ARABIC_NAMES[part.system] || 'بنية تشريحية';

  if (headEntry) {
    const arWikiUrl = `https://ar.wikipedia.org/wiki/${encodeURIComponent(
      headEntry.wikiSearchTitleAr.replace(/\s+/g, '_')
    )}`;
    const primarySummaryEn = textbookHit?.hasSubstantiveTextbookContent
      ? pickCleanTextbookField(
          tb?.summaryEn,
          `${part.cleanName} is a specialized anatomical subdivision of the ${headEntry.cleanNameEn}. ${headEntry.summaryEn}`
        )
      : `${part.cleanName} is a specialized anatomical subdivision of the ${headEntry.cleanNameEn}. ${headEntry.summaryEn}`;
    const cleanOrigin = pickCleanTextbookField(tb?.origin, headEntry.origin);
    const cleanInsertion = pickCleanTextbookField(
      tb?.insertion,
      headEntry.insertion
    );
    const cleanAction = pickCleanTextbookField(tb?.action, headEntry.action);

    return {
      wikiSearchTerm: headEntry.wikiSearchTitleEn || searchCandidates[0],
      searchCandidates: Array.from(
        new Set([headEntry.wikiSearchTitleEn, ...searchCandidates])
      ),
      fallbackArTitle: headEntry.wikiSearchTitleAr,
      profile: {
        id: part.rawName || part.meshUuid,
        cleanNameEn: part.cleanName,
        cleanNameAr: safeArName,
        latinName: part.latinName || headEntry.latinName,
        ta98Code: pickResolvedTa98Code(part.ta98Code, headEntry.ta98Code),
        fmaId: headEntry.fmaId,
        system: part.system,
        laterality: part.laterality,
        region: pickCleanTextbookField(tb?.region, headEntry.region),
        muscleGroup: tb?.muscleGroup,
        summaryEn: primarySummaryEn,
        summaryAr: `${safeArName} هي بنية تشريحية متخصصة تندرج ضمن ${headEntry.cleanNameAr}. ${headEntry.summaryAr}`,
        primaryFunctionEn: pickCleanTextbookField(
          tb?.primaryFunctionEn || cleanAction,
          headEntry.primaryFunctionEn
        ),
        primaryFunctionAr: headEntry.primaryFunctionAr,
        origin: cleanOrigin,
        insertion: cleanInsertion,
        action: cleanAction,
        relationsEn: pickCleanTextbookField(
          tb?.relationsEn,
          headEntry.relationsEn
        ),
        arterialSupply: pickCleanTextbookField(
          tb?.arterialSupply,
          headEntry.arterialSupply
        ),
        venousDrainage: pickCleanTextbookField(
          tb?.venousDrainage,
          headEntry.venousDrainage
        ),
        innervation: pickCleanTextbookField(
          tb?.innervation,
          headEntry.innervation
        ),
        clinicalNotesEn:
          tb?.clinicalNotesEn && tb.clinicalNotesEn.length > 40
            ? pickCleanTextbookField(tb.clinicalNotesEn, headEntry.clinicalNotesEn)
            : headEntry.clinicalNotesEn,
        clinicalNotesAr: headEntry.clinicalNotesAr,
        bookSourceLabel:
          textbookHit?.bookSourceLabel || "Gray's 4e & Netter 7e Baseline",
        textbookRefCitation: textbookHit?.citationLabel,
        netterPlates: tb?.netterPlates,
        wikipediaUrlEn: `https://en.wikipedia.org/wiki/${encodeURIComponent(
          (headEntry.wikiSearchTitleEn || searchCandidates[0]).replace(/\s+/g, '_')
        )}`,
        wikipediaUrlAr: arWikiUrl,
        source: textbookHit ? 'textbook-primary' : 'clinical-baseline',
      },
    };
  }

  const baseEn =
    canonicalName || stripLateralityWords(part.cleanName) || part.cleanName;
  const regional = resolveRegionalClinicalGuidance(part);
  const hasRichTb = Boolean(tb && textbookHit);
  const regionalTa98 = pickResolvedTa98Code(
    part.ta98Code,
    inferRegionalTa98Fallback(part)
  );
  const cleanSummaryEn = pickCleanTextbookField(
    tb?.summaryEn,
    `${part.cleanName} (${part.latinName}) is an anatomical structure localized to the ${regional.regionEn} within the ${part.system} system.`
  );
  const cleanAction = pickCleanTextbookField(tb?.action);
  const cleanNotesEn = pickCleanTextbookField(
    tb?.clinicalNotesEn,
    regional.clinicalNotesEn
  );

  return {
    wikiSearchTerm: tb?.canonicalNameEn || baseEn,
    searchCandidates: tb?.canonicalNameEn
      ? Array.from(new Set([...searchCandidates, tb.canonicalNameEn]))
      : searchCandidates,
    profile: {
      id: part.rawName || part.meshUuid,
      cleanNameEn: part.cleanName,
      cleanNameAr: safeArName,
      latinName: part.latinName,
      ta98Code: regionalTa98,
      system: part.system,
      laterality: part.laterality,
      region: pickCleanTextbookField(tb?.region, regional.regionEn),
      muscleGroup: tb?.muscleGroup,
      summaryEn: cleanSummaryEn,
      summaryAr: hasRichTb && !isTruncatedTextbookFragment(tb?.region)
        ? `${safeArName} (${part.cleanName}) — بنية تشريحية ضمن منطقة ${tb!.region} (${SYSTEM_ARABIC_NAMES[part.system]}).`
        : `${safeArName} (${part.cleanName}) — بنية تشريحية متموضعة ضمن ${regional.regionAr} (${SYSTEM_ARABIC_NAMES[part.system]}).`,
      primaryFunctionEn: pickCleanTextbookField(
        tb?.primaryFunctionEn || cleanAction,
        regional.functionEn
      ),
      primaryFunctionAr: cleanAction
        ? `الوظيفة الحركية والتشريحية: ${cleanAction}`
        : regional.functionAr,
      origin: pickCleanTextbookField(tb?.origin),
      insertion: pickCleanTextbookField(tb?.insertion),
      action: cleanAction,
      relationsEn: pickCleanTextbookField(tb?.relationsEn),
      arterialSupply: pickCleanTextbookField(
        tb?.arterialSupply,
        regional.arterial
      ),
      venousDrainage: pickCleanTextbookField(tb?.venousDrainage, regional.venous),
      innervation: pickCleanTextbookField(tb?.innervation, regional.innervation),
      clinicalNotesEn: cleanNotesEn,
      clinicalNotesAr: cleanNotesEn !== regional.clinicalNotesEn
        ? `ملاحظة سريرية (المرجع التشريحي): ${cleanNotesEn}`
        : regional.clinicalNotesAr,
      bookSourceLabel: textbookHit?.bookSourceLabel,
      textbookRefCitation: textbookHit?.citationLabel,
      netterPlates: tb?.netterPlates,
      wikipediaUrlEn: `https://en.wikipedia.org/wiki/${encodeURIComponent(
        baseEn.replace(/\s+/g, '_')
      )}`,
      wikipediaUrlAr: `https://ar.wikipedia.org/w/index.php?search=${encodeURIComponent(
        baseEn
      )}`,
      source: textbookHit ? 'textbook-primary' : 'clinical-baseline',
    },
  };
}
