import * as THREE from 'three';
import { CALIBRATION_RIG_STRUCTURES } from '../config/anatomicalSystems';
import type { AnatomicalSystem } from '../store/useAnatomyStore';
import {
  isGenericOrPartFallbackName,
  resolveSpatialStructure,
} from './spatialAnatomyResolver';

export type AnatomicalLaterality = 'Left' | 'Right' | 'Median / Unpaired';

export interface AnatomicalPartInfo {
  meshUuid: string;
  rawName: string;
  cleanName: string;
  cleanNameAr?: string;
  latinName: string;
  laterality: AnatomicalLaterality;
  system: AnatomicalSystem;
  ta98Code: string;
  organGroupId?: string;
  worldCenter: [number, number, number];
  boundingRadius: number;
}

interface TerminologyEntry {
  latinName: string;
  ta98Code: string;
  system?: AnatomicalSystem;
}

const TERMINOLOGY_MAP: Record<string, TerminologyEntry> = {
  skin: { latinName: 'Cutis (Integumentum commune)', ta98Code: 'A16.0.00.001', system: 'integumentary' },
  'skin epidermis': { latinName: 'Cutis (Epidermis et dermis)', ta98Code: 'A16.0.00.001', system: 'integumentary' },
  cranium: { latinName: 'Cranium', ta98Code: 'A02.1.00.001', system: 'skeletal' },
  skull: { latinName: 'Cranium', ta98Code: 'A02.1.00.001', system: 'skeletal' },
  mandible: { latinName: 'Mandibula', ta98Code: 'A02.1.15.001', system: 'skeletal' },
  scapula: { latinName: 'Scapula', ta98Code: 'A02.4.01.001', system: 'skeletal' },
  clavicle: { latinName: 'Clavicula', ta98Code: 'A02.4.02.001', system: 'skeletal' },
  sternum: { latinName: 'Sternum', ta98Code: 'A02.3.03.001', system: 'skeletal' },
  'cervical vertebrae': {
    latinName: 'Vertebrae cervicales',
    ta98Code: 'A02.2.02.001',
    system: 'skeletal',
  },
  'thoracic vertebrae': {
    latinName: 'Vertebrae thoracicae',
    ta98Code: 'A02.2.03.001',
    system: 'skeletal',
  },
  'thoracic cage': {
    latinName: 'Cavea thoracis',
    ta98Code: 'A02.3.04.001',
    system: 'skeletal',
  },
  'rib cage': {
    latinName: 'Cavea thoracis',
    ta98Code: 'A02.3.04.001',
    system: 'skeletal',
  },
  'lumbar vertebrae': {
    latinName: 'Vertebrae lumbales',
    ta98Code: 'A02.2.04.001',
    system: 'skeletal',
  },
  sacrum: { latinName: 'Os sacrum', ta98Code: 'A02.2.05.001', system: 'skeletal' },
  pelvis: { latinName: 'Pelvis', ta98Code: 'A02.5.02.001', system: 'skeletal' },
  humerus: { latinName: 'Humerus', ta98Code: 'A02.4.04.001', system: 'skeletal' },
  'radius ulna': { latinName: 'Radius et ulna', ta98Code: 'A02.4.05.001', system: 'skeletal' },
  femur: { latinName: 'Femur', ta98Code: 'A02.5.04.001', system: 'skeletal' },
  'tibia fibula': { latinName: 'Tibia et fibula', ta98Code: 'A02.5.06.001', system: 'skeletal' },
  tibia: { latinName: 'Tibia', ta98Code: 'A02.5.06.001', system: 'skeletal' },

  brain: { latinName: 'Encephalon', ta98Code: 'A14.1.03.001', system: 'visceral' },
  encephalon: { latinName: 'Encephalon', ta98Code: 'A14.1.03.001', system: 'visceral' },
  cerebellum: { latinName: 'Cerebellum', ta98Code: 'A14.1.07.001', system: 'visceral' },
  'thyroid gland': { latinName: 'Glandula thyroidea', ta98Code: 'A11.3.00.001', system: 'visceral' },
  trachea: { latinName: 'Trachea', ta98Code: 'A06.3.01.001', system: 'visceral' },
  lungs: { latinName: 'Pulmo', ta98Code: 'A06.5.01.001', system: 'visceral' },
  lung: { latinName: 'Pulmo', ta98Code: 'A06.5.01.001', system: 'visceral' },
  diaphragm: { latinName: 'Diaphragma', ta98Code: 'A04.4.02.001', system: 'visceral' },
  liver: { latinName: 'Hepar', ta98Code: 'A05.8.01.001', system: 'visceral' },
  hepar: { latinName: 'Hepar', ta98Code: 'A05.8.01.001', system: 'visceral' },
  gallbladder: { latinName: 'Vesica biliaris', ta98Code: 'A05.8.02.001', system: 'visceral' },
  stomach: { latinName: 'Ventriculus', ta98Code: 'A05.5.01.001', system: 'visceral' },
  gaster: { latinName: 'Ventriculus', ta98Code: 'A05.5.01.001', system: 'visceral' },
  pancreas: { latinName: 'Pancreas', ta98Code: 'A05.9.01.001', system: 'visceral' },
  spleen: { latinName: 'Splen (Lien)', ta98Code: 'A13.2.01.001', system: 'visceral' },
  'small intestine': { latinName: 'Intestinum tenue', ta98Code: 'A05.6.01.001', system: 'visceral' },
  'large intestine colon': { latinName: 'Intestinum crassum (Colon)', ta98Code: 'A05.7.01.001', system: 'visceral' },
  'large intestine': { latinName: 'Intestinum crassum', ta98Code: 'A05.7.01.001', system: 'visceral' },
  kidneys: { latinName: 'Ren', ta98Code: 'A08.1.01.001', system: 'visceral' },
  kidney: { latinName: 'Ren', ta98Code: 'A08.1.01.001', system: 'visceral' },
  'urinary bladder': { latinName: 'Vesica urinaria', ta98Code: 'A08.3.01.001', system: 'visceral' },
  'prostate gland': { latinName: 'Prostata', ta98Code: 'A09.3.08.001', system: 'visceral' },
  prostate: { latinName: 'Prostata', ta98Code: 'A09.3.08.001', system: 'visceral' },
  testes: { latinName: 'Testis', ta98Code: 'A09.3.01.001', system: 'visceral' },
  testis: { latinName: 'Testis', ta98Code: 'A09.3.01.001', system: 'visceral' },
  uterus: { latinName: 'Uterus', ta98Code: 'A09.1.03.001', system: 'visceral' },
  ovary: { latinName: 'Ovarium', ta98Code: 'A09.1.01.001', system: 'visceral' },
  'fallopian tubes': { latinName: 'Tuba uterina', ta98Code: 'A09.1.02.001', system: 'visceral' },
  'mammary glands': { latinName: 'Glandula mammaria', ta98Code: 'A16.0.02.001', system: 'visceral' },

  heart: { latinName: 'Cor', ta98Code: 'A12.1.00.001', system: 'cardiovascular' },
  cor: { latinName: 'Cor', ta98Code: 'A12.1.00.001', system: 'cardiovascular' },
  'aorta arch': {
    latinName: 'Arcus aortae',
    ta98Code: 'A12.2.04.001',
    system: 'cardiovascular',
  },
  'thoracic aorta': { latinName: 'Aorta thoracica', ta98Code: 'A12.2.11.001', system: 'cardiovascular' },
  'abdominal aorta': { latinName: 'Aorta abdominalis', ta98Code: 'A12.2.12.001', system: 'cardiovascular' },
  aorta: { latinName: 'Aorta', ta98Code: 'A12.2.02.001', system: 'cardiovascular' },
  'superior vena cava': {
    latinName: 'Vena cava superior',
    ta98Code: 'A12.3.03.001',
    system: 'cardiovascular',
  },
  'inferior vena cava': {
    latinName: 'Vena cava inferior',
    ta98Code: 'A12.3.09.001',
    system: 'cardiovascular',
  },
  'carotid arteries': {
    latinName: 'Arteria carotis communis',
    ta98Code: 'A12.2.04.006',
    system: 'cardiovascular',
  },
  'jugular veins': {
    latinName: 'Vena jugularis interna',
    ta98Code: 'A12.3.05.001',
    system: 'cardiovascular',
  },
  'iliac vessels': {
    latinName: 'Vasa iliaca communia',
    ta98Code: 'A12.2.14.001',
    system: 'cardiovascular',
  },
  'femoral arteries': {
    latinName: 'Arteria femoralis',
    ta98Code: 'A12.2.16.010',
    system: 'cardiovascular',
  },

  'cerebral cortex nerves': {
    latinName: 'Nervi cerebrales',
    ta98Code: 'A14.1.09.001',
    system: 'nervous',
  },
  'spinal cord': {
    latinName: 'Medulla spinalis',
    ta98Code: 'A14.1.02.001',
    system: 'nervous',
  },
  'cervical plexus': {
    latinName: 'Plexus cervicalis',
    ta98Code: 'A14.2.02.012',
    system: 'nervous',
  },
  'brachial plexus': {
    latinName: 'Plexus brachialis',
    ta98Code: 'A14.2.03.001',
    system: 'nervous',
  },
  'vagus nerve': {
    latinName: 'Nervus vagus (CN X)',
    ta98Code: 'A14.2.01.153',
    system: 'nervous',
  },
  'lumbar plexus': {
    latinName: 'Plexus lumbalis',
    ta98Code: 'A14.2.07.002',
    system: 'nervous',
  },
  'sciatic nerve': {
    latinName: 'Nervus ischiadicus',
    ta98Code: 'A14.2.07.046',
    system: 'nervous',
  },

  temporalis: { latinName: 'Musculus temporalis', ta98Code: 'A04.1.04.005', system: 'muscular' },
  sternocleidomastoid: {
    latinName: 'Musculus sternocleidomastoideus',
    ta98Code: 'A04.2.01.008',
    system: 'muscular',
  },
  'pectoralis major': {
    latinName: 'Musculus pectoralis major',
    ta98Code: 'A04.4.01.002',
    system: 'muscular',
  },
  deltoid: {
    latinName: 'Musculus deltoideus',
    ta98Code: 'A04.6.02.002',
    system: 'muscular',
  },
  'biceps brachii': {
    latinName: 'Musculus biceps brachii',
    ta98Code: 'A04.6.02.013',
    system: 'muscular',
  },
  'rectus abdominis': {
    latinName: 'Musculus rectus abdominis',
    ta98Code: 'A04.5.01.001',
    system: 'muscular',
  },
  'external oblique': {
    latinName: 'Musculus obliquus externus abdominis',
    ta98Code: 'A04.5.01.008',
    system: 'muscular',
  },
  'gluteus maximus': {
    latinName: 'Musculus gluteus maximus',
    ta98Code: 'A04.7.02.006',
    system: 'muscular',
  },
  'rectus femoris': {
    latinName: 'Musculus rectus femoris',
    ta98Code: 'A04.7.02.018',
    system: 'muscular',
  },
  gastrocnemius: {
    latinName: 'Musculus gastrocnemius',
    ta98Code: 'A04.7.02.044',
    system: 'muscular',
  },
  'facial skeleton': {
    latinName: 'Ossa faciei (Viscerocranium)',
    ta98Code: 'A02.1.00.004',
    system: 'skeletal',
  },
  'sacrum coccyx': {
    latinName: 'Os sacrum et coccyx',
    ta98Code: 'A02.2.05.001',
    system: 'skeletal',
  },
  ribs: {
    latinName: 'Costae (I–XII)',
    ta98Code: 'A02.3.01.001',
    system: 'skeletal',
  },
  'ribs 1 12': {
    latinName: 'Costae (I–XII)',
    ta98Code: 'A02.3.01.001',
    system: 'skeletal',
  },
  radius: {
    latinName: 'Radius',
    ta98Code: 'A02.4.05.001',
    system: 'skeletal',
  },
  ulna: {
    latinName: 'Ulna',
    ta98Code: 'A02.4.06.001',
    system: 'skeletal',
  },
  'carpals metacarpals phalanges': {
    latinName: 'Ossa manus (Carpi, metacarpi et phalanges)',
    ta98Code: 'A02.4.08.001',
    system: 'skeletal',
  },
  patella: {
    latinName: 'Patella',
    ta98Code: 'A02.5.05.001',
    system: 'skeletal',
  },
  fibula: {
    latinName: 'Fibula',
    ta98Code: 'A02.5.07.001',
    system: 'skeletal',
  },
  'tarsals metatarsals phalanges': {
    latinName: 'Ossa pedis (Tarsi, metatarsi et phalanges)',
    ta98Code: 'A02.5.08.001',
    system: 'skeletal',
  },
  masseter: {
    latinName: 'Musculus masseter',
    ta98Code: 'A04.1.04.002',
    system: 'muscular',
  },
  trapezius: {
    latinName: 'Musculus trapezius',
    ta98Code: 'A04.3.01.001',
    system: 'muscular',
  },
  'latissimus dorsi': {
    latinName: 'Musculus latissimus dorsi',
    ta98Code: 'A04.3.01.006',
    system: 'muscular',
  },
  'serratus anterior': {
    latinName: 'Musculus serratus anterior',
    ta98Code: 'A04.4.01.008',
    system: 'muscular',
  },
  'triceps brachii': {
    latinName: 'Musculus triceps brachii',
    ta98Code: 'A04.6.02.019',
    system: 'muscular',
  },
  'brachioradialis forearm flexors': {
    latinName: 'Musculi antebrachii (Brachioradialis et flexores)',
    ta98Code: 'A04.6.02.025',
    system: 'muscular',
  },
  'quadriceps rectus femoris': {
    latinName: 'Musculus quadriceps femoris',
    ta98Code: 'A04.7.02.017',
    system: 'muscular',
  },
  'vastus lateralis medialis': {
    latinName: 'Musculus vastus lateralis et medialis',
    ta98Code: 'A04.7.02.019',
    system: 'muscular',
  },
  'biceps femoris hamstrings': {
    latinName: 'Musculus biceps femoris et ischiocrurales',
    ta98Code: 'A04.7.02.032',
    system: 'muscular',
  },
  'gastrocnemius soleus': {
    latinName: 'Musculus triceps surae (Gastrocnemius et soleus)',
    ta98Code: 'A04.7.02.043',
    system: 'muscular',
  },
  'tibialis anterior': {
    latinName: 'Musculus tibialis anterior',
    ta98Code: 'A04.7.02.037',
    system: 'muscular',
  },
  'vagus nerve cn x': {
    latinName: 'Nervus vagus (CN X)',
    ta98Code: 'A14.2.01.153',
    system: 'nervous',
  },
  'intercostal nerves': {
    latinName: 'Nervi intercostales (T1–T11)',
    ta98Code: 'A14.2.04.001',
    system: 'nervous',
  },
  'median ulnar radial nerves': {
    latinName: 'Nervi medianus, ulnaris et radialis',
    ta98Code: 'A14.2.03.031',
    system: 'nervous',
  },
  'lumbar sacral plexus': {
    latinName: 'Plexus lumbosacralis',
    ta98Code: 'A14.2.07.001',
    system: 'nervous',
  },
  'tibial fibular nerves': {
    latinName: 'Nervi tibialis et fibularis communis',
    ta98Code: 'A14.2.07.058',
    system: 'nervous',
  },
  pons: {
    latinName: 'Pons',
    ta98Code: 'A14.1.05.001',
    system: 'nervous',
  },
  'medulla oblongata': {
    latinName: 'Medulla oblongata',
    ta98Code: 'A14.1.04.001',
    system: 'nervous',
  },
  midbrain: {
    latinName: 'Mesencephalon',
    ta98Code: 'A14.1.06.001',
    system: 'nervous',
  },
  thalamus: {
    latinName: 'Thalamus',
    ta98Code: 'A14.1.08.101',
    system: 'nervous',
  },
  hippocampus: {
    latinName: 'Hippocampus',
    ta98Code: 'A14.1.09.321',
    system: 'nervous',
  },
  amygdala: {
    latinName: 'Corpus amygdaloideum',
    ta98Code: 'A14.1.09.402',
    system: 'nervous',
  },
  'corpus callosum': {
    latinName: 'Corpus callosum',
    ta98Code: 'A14.1.09.241',
    system: 'nervous',
  },
  'subclavian vessels': {
    latinName: 'Arteria et vena subclavia',
    ta98Code: 'A12.2.08.001',
    system: 'cardiovascular',
  },
  'brachial vessels': {
    latinName: 'Arteria et vena brachialis',
    ta98Code: 'A12.2.09.018',
    system: 'cardiovascular',
  },
  'radial ulnar vessels': {
    latinName: 'Arteriae et venae radialis et ulnaris',
    ta98Code: 'A12.2.09.027',
    system: 'cardiovascular',
  },
  'common iliac vessels': {
    latinName: 'Arteria et vena iliaca communis',
    ta98Code: 'A12.2.14.001',
    system: 'cardiovascular',
  },
  'femoral vessels': {
    latinName: 'Arteria et vena femoralis',
    ta98Code: 'A12.2.16.010',
    system: 'cardiovascular',
  },
  'popliteal tibial vessels': {
    latinName: 'Arteria et vena poplitea et tibialis',
    ta98Code: 'A12.2.16.033',
    system: 'cardiovascular',
  },
  'pulmonary trunk': {
    latinName: 'Truncus pulmonalis',
    ta98Code: 'A12.2.01.001',
    system: 'cardiovascular',
  },
  'portal vein': {
    latinName: 'Vena portae hepatis',
    ta98Code: 'A12.3.12.001',
    system: 'cardiovascular',
  },
  talus: {
    latinName: 'Talus',
    ta98Code: 'A02.5.10.001',
    system: 'skeletal',
  },
  calcaneus: {
    latinName: 'Calcaneus',
    ta98Code: 'A02.5.11.001',
    system: 'skeletal',
  },
  sartorius: {
    latinName: 'Musculus sartorius',
    ta98Code: 'A04.7.02.015',
    system: 'muscular',
  },
  soleus: {
    latinName: 'Musculus soleus',
    ta98Code: 'A04.7.02.047',
    system: 'muscular',
  },
  'vastus lateralis': {
    latinName: 'Musculus vastus lateralis',
    ta98Code: 'A04.7.02.019',
    system: 'muscular',
  },
  'vastus intermedius': {
    latinName: 'Musculus vastus intermedius',
    ta98Code: 'A04.7.02.020',
    system: 'muscular',
  },
  'vastus medialis': {
    latinName: 'Musculus vastus medialis',
    ta98Code: 'A04.7.02.021',
    system: 'muscular',
  },
  iliopsoas: {
    latinName: 'Musculus iliopsoas',
    ta98Code: 'A04.7.02.001',
    system: 'muscular',
  },
  iliacus: {
    latinName: 'Musculus iliacus',
    ta98Code: 'A04.7.02.003',
    system: 'muscular',
  },
  'psoas major': {
    latinName: 'Musculus psoas major',
    ta98Code: 'A04.7.02.004',
    system: 'muscular',
  },
  pectineus: {
    latinName: 'Musculus pectineus',
    ta98Code: 'A04.7.02.025',
    system: 'muscular',
  },
  'adductor longus': {
    latinName: 'Musculus adductor longus',
    ta98Code: 'A04.7.02.026',
    system: 'muscular',
  },
  'adductor brevis': {
    latinName: 'Musculus adductor brevis',
    ta98Code: 'A04.7.02.027',
    system: 'muscular',
  },
  'adductor magnus': {
    latinName: 'Musculus adductor magnus',
    ta98Code: 'A04.7.02.028',
    system: 'muscular',
  },
  gracilis: {
    latinName: 'Musculus gracilis',
    ta98Code: 'A04.7.02.031',
    system: 'muscular',
  },
  'biceps femoris': {
    latinName: 'Musculus biceps femoris',
    ta98Code: 'A04.7.02.032',
    system: 'muscular',
  },
  semitendinosus: {
    latinName: 'Musculus semitendinosus',
    ta98Code: 'A04.7.02.035',
    system: 'muscular',
  },
  semimembranosus: {
    latinName: 'Musculus semimembranosus',
    ta98Code: 'A04.7.02.036',
    system: 'muscular',
  },
  'gluteus medius': {
    latinName: 'Musculus gluteus medius',
    ta98Code: 'A04.7.02.007',
    system: 'muscular',
  },
  'gluteus minimus': {
    latinName: 'Musculus gluteus minimus',
    ta98Code: 'A04.7.02.008',
    system: 'muscular',
  },
  'tensor fasciae latae': {
    latinName: 'Musculus tensor fasciae latae',
    ta98Code: 'A04.7.02.010',
    system: 'muscular',
  },
  piriformis: {
    latinName: 'Musculus piriformis',
    ta98Code: 'A04.7.02.011',
    system: 'muscular',
  },
  'fibularis longus': {
    latinName: 'Musculus fibularis longus',
    ta98Code: 'A04.7.02.041',
    system: 'muscular',
  },
  popliteus: {
    latinName: 'Musculus popliteus',
    ta98Code: 'A04.7.02.050',
    system: 'muscular',
  },
  'pectoralis minor': {
    latinName: 'Musculus pectoralis minor',
    ta98Code: 'A04.4.01.006',
    system: 'muscular',
  },
  supraspinatus: {
    latinName: 'Musculus supraspinatus',
    ta98Code: 'A04.6.02.006',
    system: 'muscular',
  },
  infraspinatus: {
    latinName: 'Musculus infraspinatus',
    ta98Code: 'A04.6.02.008',
    system: 'muscular',
  },
  'teres minor': {
    latinName: 'Musculus teres minor',
    ta98Code: 'A04.6.02.010',
    system: 'muscular',
  },
  'teres major': {
    latinName: 'Musculus teres major',
    ta98Code: 'A04.6.02.011',
    system: 'muscular',
  },
  subscapularis: {
    latinName: 'Musculus subscapularis',
    ta98Code: 'A04.6.02.012',
    system: 'muscular',
  },
  coracobrachialis: {
    latinName: 'Musculus coracobrachialis',
    ta98Code: 'A04.6.02.017',
    system: 'muscular',
  },
  brachialis: {
    latinName: 'Musculus brachialis',
    ta98Code: 'A04.6.02.018',
    system: 'muscular',
  },
  'pronator teres': {
    latinName: 'Musculus pronator teres',
    ta98Code: 'A04.6.02.025',
    system: 'muscular',
  },
  brachioradialis: {
    latinName: 'Musculus brachioradialis',
    ta98Code: 'A04.6.02.040',
    system: 'muscular',
  },
  'levator scapulae': {
    latinName: 'Musculus levator scapulae',
    ta98Code: 'A04.3.01.007',
    system: 'muscular',
  },
  'rhomboid major': {
    latinName: 'Musculus rhomboideus major',
    ta98Code: 'A04.3.01.008',
    system: 'muscular',
  },
  'rhomboid minor': {
    latinName: 'Musculus rhomboideus minor',
    ta98Code: 'A04.3.01.009',
    system: 'muscular',
  },
  'erector spinae': {
    latinName: 'Musculus erector spinae',
    ta98Code: 'A04.3.02.002',
    system: 'muscular',
  },
  'internal oblique': {
    latinName: 'Musculus obliquus internus abdominis',
    ta98Code: 'A04.5.01.017',
    system: 'muscular',
  },
  'transversus abdominis': {
    latinName: 'Musculus transversus abdominis',
    ta98Code: 'A04.5.01.019',
    system: 'muscular',
  },
  platysma: {
    latinName: 'Platysma',
    ta98Code: 'A04.2.01.001',
    system: 'muscular',
  },
  'orbicularis oculi': {
    latinName: 'Musculus orbicularis oculi',
    ta98Code: 'A04.1.03.013',
    system: 'muscular',
  },
  'orbicularis oris': {
    latinName: 'Musculus orbicularis oris',
    ta98Code: 'A04.1.03.023',
    system: 'muscular',
  },
  buccinator: {
    latinName: 'Musculus buccinator',
    ta98Code: 'A04.1.03.036',
    system: 'muscular',
  },
  'phrenic nerve': {
    latinName: 'Nervus phrenicus',
    ta98Code: 'A14.2.02.029',
    system: 'nervous',
  },
  'median nerve': {
    latinName: 'Nervus medianus',
    ta98Code: 'A14.2.03.031',
    system: 'nervous',
  },
  'ulnar nerve': {
    latinName: 'Nervus ulnaris',
    ta98Code: 'A14.2.03.039',
    system: 'nervous',
  },
  'radial nerve': {
    latinName: 'Nervus radialis',
    ta98Code: 'A14.2.03.049',
    system: 'nervous',
  },
  'femoral nerve': {
    latinName: 'Nervus femoralis',
    ta98Code: 'A14.2.07.020',
    system: 'nervous',
  },
  'obturator nerve': {
    latinName: 'Nervus obturatorius',
    ta98Code: 'A14.2.07.012',
    system: 'nervous',
  },
  'tibial nerve': {
    latinName: 'Nervus tibialis',
    ta98Code: 'A14.2.07.047',
    system: 'nervous',
  },
  'common fibular nerve': {
    latinName: 'Nervus fibularis communis',
    ta98Code: 'A14.2.07.058',
    system: 'nervous',
  },
  'trigeminal nerve': {
    latinName: 'Nervus trigeminus (CN V)',
    ta98Code: 'A14.2.01.012',
    system: 'nervous',
  },
  'facial nerve': {
    latinName: 'Nervus facialis (CN VII)',
    ta98Code: 'A14.2.01.099',
    system: 'nervous',
  },
};

const MINOR_LOWERCASE_WORDS = new Set(['of', 'and', 'the', 'in', 'et', 'or']);

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && MINOR_LOWERCASE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function stripBlenderAndMeshSuffixes(rawName: string): string {
  let result = rawName.trim();
  for (let i = 0; i < 3; i++) {
    result = result
      .replace(/\.\d{3,}$/i, '') // Blender duplicate suffix e.g. .001
      .replace(/(?:[_\-.\s—]+(?:primitive|submesh|prim)(?:[_\-.\s]*\d+)?)$/i, '') // GLTF multi-primitive suffix
      .replace(/(?:[_\-.\s—]+(?:part|piece|chunk)[_\-.\s]*\d+)$/i, '') // Export chunk/part index
      .replace(/(?:[_\-.]mesh(?:[_\-.]?\d+)?)$/i, '') // _mesh or _mesh_2
      .replace(/(?:[_\-.]geo(?:metry)?(?:[_\-.]?\d+)?)$/i, '')
      .replace(/(?:[_\-.]\d{3,})$/i, '') // Export copy suffix e.g. _001
      .replace(/_(?!(?:l|r)$)[a-km-qs-z]$/, ''); // Sub-mesh dataset slice tags e.g. _a, _b
  }
  return result.trim();
}

const INTRINSIC_CARDIAC_STRUCTURE_RE =
  /\b(?:coronary|myocard|endocard|pericard|tricuspid|mitral|chordae[\s_-]*tendineae|trabeculae[\s_-]*carneae|papillary[\s_-]*muscle|pectinate[\s_-]*muscle|auricle[\s_-]*of[\s_-]*(?:left|right)[\s_-]*atrium|conus[\s_-]*arteriosus|crista[\s_-]*terminalis|interventricular[\s_-]*septum|interatrial[\s_-]*septum|sinuatrial|atrioventricular|inferolateral[\s_-]*branch[\s_-]*of[\s_-]*right[\s_-]*coronary)\b|\bof[\s_-]+(?:left|right)[\s_-]+(?:ventricle|atrium)\b|^(?:left|right)[\s_-]+(?:ventricle|atrium)\b/i;

function isIntrinsicCardiacStructure(text: string): boolean {
  const normalized = text.replace(/_/g, ' ').trim();
  if (
    /\b(?:brain|cerebr|lateral ventricle|third ventricle|fourth ventricle|choroid)\b/i.test(
      normalized
    )
  ) {
    return false;
  }
  return INTRINSIC_CARDIAC_STRUCTURE_RE.test(normalized);
}

function detectLaterality(
  rawName: string,
  userDataLabel?: string
): AnatomicalLaterality {
  const cleanedRaw = stripBlenderAndMeshSuffixes(rawName);
  const candidates = [cleanedRaw, userDataLabel ?? ''];

  for (const text of candidates) {
    if (!text) continue;
    if (isIntrinsicCardiacStructure(text)) {
      return 'Median / Unpaired';
    }
    const strippedCardiacRef = text.replace(
      /[_\s-]+of[_\s-]+(?:left|right)[_\s-]+(?:ventricle|atrium)\b/gi,
      ''
    );
    if (
      /(?:^|[_\s.\-])(left|sinister|sinistra|l)(?:$|[_\s.\-])/i.test(
        strippedCardiacRef
      )
    ) {
      return 'Left';
    }
    if (
      /(?:^|[_\s.\-])(right|dexter|dextra|r)(?:$|[_\s.\-])/i.test(
        strippedCardiacRef
      )
    ) {
      return 'Right';
    }
  }

  return 'Median / Unpaired';
}

function stripLateralityTokens(name: string): string {
  return name
    .replace(/(?:^|[_\s.\-])(left|right|l|r)(?:$|[_\s.\-])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_MESH_NAME_RE =
  /^(?:(?:object|mesh|node|primitive|sub[_\-\s]*mesh|shape|geom|geometry|part|defaultmaterial|material|mat|model|group|root|scene|unnamed|anatomical[_\s-]*part|anatomical[_\s-]*structure|cube|sphere|cylinder|polySurface|lambert|phong|blinn|standard)[_\-\s.\d]*)$/i;

export function isGenericNodeName(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length <= 1) return true;
  return (
    GENERIC_MESH_NAME_RE.test(trimmed) || isGenericOrPartFallbackName(trimmed)
  );
}

function inferSystemFromName(
  rawName: string,
  normalizedBase: string,
  contextHint?: string
): AnatomicalSystem {
  const combinedText = `${isGenericNodeName(rawName) ? '' : rawName} ${normalizedBase} ${contextHint ?? ''}`
    .replace(/[_.:-]+/g, ' ')
    .toLowerCase();
  const lowerRaw = rawName.toLowerCase();

  if (
    /\b(skin|cutis|epiderm|dermis|subcutan|integument|region|regions|triangle|fold|cleft|groove|nail|hair|breast|mammar|nipple|areola|umbilic)/.test(
      combinedText
    )
  ) {
    return 'integumentary';
  }
  if (
    /\b(skull|cranium|cranio|mandib|maxilla|zygoma|frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|vomer|palatine|lacrimal|nasal bone|concha|malleus|incus|stapes|hyoid|vertebra|atlas|axis|sacrum|coccyx|costa|costal|rib|ribs|sternum|clavic|scapula|humerus|radius|ulna|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarp|phalanx|phalanges|pelvis|ilium|ischium|pubis|coxae|femur|patella|tibia|fibula|tarsal|talus|calcaneus|navicular|cuboid|cuneiform|metatars|skeleton|skeletal|joint|articulat|ligament|cartilag|meniscus|suture|gomphosis|syndesmosis|symphysis|tooth|teeth|incisor|canine|premolar|molar|dentin|enamel|periosteum|bone|os\b)/.test(
      combinedText
    )
  ) {
    return 'skeletal';
  }
  if (
    (/^m_[a-z]/i.test(lowerRaw) && !/^(?:mesh|material|model|mat)[_\d]/i.test(lowerRaw)) ||
    /\b(muscul|muscle|fascia|tendon|aponeurosis|retinaculum|bursa|deltoid|pectoral|biceps|triceps|brachialis|brachioradialis|pronator|supinator|flexor|extensor|abductor|adductor|opponens|lumbrical|interosse|gluteus|gluteal|piriformis|obturator|gemellus|quadratus|psoas|iliacus|sartorius|quadriceps|rectus|vastus|gracilis|pectineus|semitendinosus|semimembranosus|gastrocnemius|soleus|plantaris|popliteus|tibialis|peroneus|fibularis|trapezius|latissimus|rhomboid|levator|serratus|splenius|erector|iliocostalis|longissimus|spinalis|multifidus|rotatores|sternocleidomastoid|scalen|platysma|masseter|temporalis|pterygoid|digastric|mylohyoid|stylohyoid|geniohyoid|omohyoid|sternohyoid|sternothyroid|thyrohyoid|orbicularis|zygomaticus|risorius|buccinator|mentalis|depressor|corrugator|procerus|nasalis|diaphragm|intercostal|subcostal|transversus|oblique|obliquus|pyramidalis|cremaster|sphincter|arytenoid)/.test(
      combinedText
    )
  ) {
    return 'muscular';
  }
  if (
    /^n_[a-z]/i.test(lowerRaw) ||
    /\b(nerve|nervus|nerf|brain|encephal|cerebr|cerebell|brainstem|midbrain|mesencephal|pons|medulla|spinal cord|plexus|gangli|cortex|gyrus|gyri|sulcus|sulci|thalamus|hypothalamus|epithalamus|subthalamus|pineal|pituitary|hypophysis|hippocampus|amygdala|caudate|putamen|globus pallidus|lentiform|striatum|claustrum|fornix|commissure|callosum|corona radiata|lemniscus|peduncle|colliculus|geniculate|olivary|choroid plexus|meninges|dura mater|arachnoid|pia mater|tentorium|falx|chiasm|optic tract|olfactory|oculomotor|trochlear|trigeminal|abducens|facial nerve|vestibulocochlear|glossopharyngeal|vagus|accessory nerve|hypoglossal|sciatic|phrenic|sympathetic|parasympathetic|splanchnic|ramus|rami|cauda equina|filum terminale|cornea|sclera|retina|iris|cochlea|semicircular|vestibule|tympanic)/.test(
      combinedText
    )
  ) {
    return 'nervous';
  }
  if (
    (/^[av]_[a-z]/i.test(lowerRaw) && !/^(?:anat|avatar)/i.test(lowerRaw)) ||
    /\b(heart|cor\b|cardiac|cardiovascular|myocard|endocard|pericard|atrium|atrial|mitral|tricuspid|aort|artery|arteria|arteri|vein|vena|venous|venule|capillary|sinus|cava|jugular|carotid|subclavian|axillary|brachial|iliac|femoral artery|femoral vein|popliteal|saphenous|azygos|hemiazygos|portal|celiac|mesenteric|renal artery|renal vein|coronary|basilar|vertebral artery|willis|anastomosis|trunk|pulmonary artery|pulmonary vein|ventricle of heart)/.test(
      combinedText
    )
  ) {
    return 'cardiovascular';
  }
  return 'visceral';
}

function buildFallbackTa98(system: AnatomicalSystem, cleanName: string): string {
  const prefixMap: Record<AnatomicalSystem, string> = {
    integumentary: 'A16',
    skeletal: 'A02',
    muscular: 'A04',
    visceral: 'A05',
    cardiovascular: 'A12',
    nervous: 'A14',
  };
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash * 31 + cleanName.charCodeAt(i)) % 999;
  }
  const padded = String(hash).padStart(3, '0');
  return `${prefixMap[system]}.0.00.${padded}`;
}

function resolveAnatomicalMeshObject(mesh: THREE.Mesh): THREE.Mesh {
  let current: THREE.Object3D | null = mesh;
  while (current) {
    if (
      (current as THREE.Mesh).isMesh &&
      (current.name || current.userData?.anatomicalName || current.userData?.system)
    ) {
      return current as THREE.Mesh;
    }
    current = current.parent;
  }
  return mesh;
}

const SCENE_WRAPPER_NAME_REGEX =
  /^(?:scene|rootnode|root|gltf|sketchfab(?:_system|_model)?|human_body_assembly|nih_visible_human|anatomical_atlas_root|zanatomy-.*)/i;

function isNonGenericAnatomicalCandidate(candidate?: string | null): candidate is string {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (!trimmed || SCENE_WRAPPER_NAME_REGEX.test(trimmed)) return false;
  return !isGenericNodeName(trimmed);
}

function resolveBestHierarchyName(mesh: THREE.Mesh): string | undefined {
  const ownAnat =
    typeof mesh.userData?.anatomicalName === 'string'
      ? mesh.userData.anatomicalName
      : undefined;
  if (isNonGenericAnatomicalCandidate(ownAnat)) return ownAnat.trim();

  const ownUserDataName =
    typeof mesh.userData?.name === 'string' ? mesh.userData.name : undefined;
  if (isNonGenericAnatomicalCandidate(ownUserDataName)) {
    return ownUserDataName.trim();
  }

  if (isNonGenericAnatomicalCandidate(mesh.name)) return mesh.name.trim();

  let ancestor: THREE.Object3D | null = mesh.parent;
  while (ancestor) {
    const ancAnat =
      typeof ancestor.userData?.anatomicalName === 'string'
        ? ancestor.userData.anatomicalName
        : undefined;
    if (isNonGenericAnatomicalCandidate(ancAnat)) return ancAnat.trim();

    const ancDataName =
      typeof ancestor.userData?.name === 'string'
        ? ancestor.userData.name
        : undefined;
    if (isNonGenericAnatomicalCandidate(ancDataName)) return ancDataName.trim();

    if (isNonGenericAnatomicalCandidate(ancestor.name)) {
      return ancestor.name.trim();
    }
    ancestor = ancestor.parent;
  }
  return undefined;
}

function isInStandingWorldScene(mesh: THREE.Object3D): boolean {
  if (
    mesh.userData?.__restCenter ||
    mesh.userData?.__spatialBounds ||
    typeof mesh.userData?.parentModelContext === 'string'
  ) {
    return true;
  }
  let cur: THREE.Object3D | null = mesh.parent;
  while (cur) {
    if (
      /^(?:Sketchfab_System_|Human_Body_Assembly_|NIH_Visible_Human_|Anatomical_Atlas_Root)/i.test(
        cur.name || ''
      )
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

interface AnatomicalBaseMetadata {
  rawName: string;
  cleanName: string;
  cleanNameAr?: string;
  latinName: string;
  laterality: AnatomicalLaterality;
  system: AnatomicalSystem;
  ta98Code: string;
}

function formatCleanDisplayName(rawName: string): {
  stripped: string;
  prefixless: string;
  cleanName: string;
  baseLookupKey: string;
} {
  const stripped = stripBlenderAndMeshSuffixes(rawName);

  // Strip known anatomical dataset prefixes without cutting words like mesh_0, material_0, model_0
  let prefixless = stripped.replace(
    /^(?:allen_brain|allen|vh_m|vh_f|vh|sbu_m|sbu_f|sbu|yao|nih|maleadult|femaleadult|human|(?!(?:mesh|material|mat|model|node|object)[_\s:-])[mavn])[_\s:-]+/i,
    ''
  );
  // Strip any leftover dataset sub-mesh tag before extracting laterality
  prefixless = prefixless.replace(/_(?!(?:l|r)$)[a-km-qs-z]$/, '');
  // Convert trailing _L / _R / .l / .r / , Left tokens into readable Left / Right words
  prefixless = prefixless
    .replace(/,\s*(left|right)\b/i, ' $1')
    .replace(/[_\-.]l$/i, ' Left')
    .replace(/[_\-.]r$/i, ' Right')
    .replace(/[_.:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanName = toTitleCase(prefixless || stripped || 'Anatomical Structure');
  const baseLookupKey = stripLateralityTokens(prefixless).toLowerCase();
  return { stripped, prefixless, cleanName, baseLookupKey };
}

function buildAnatomicalBaseMetadata(
  rawName: string,
  preferredLabel?: string,
  systemOverride?: AnatomicalSystem,
  parentContextHint?: string,
  meshIndex?: number,
  spatialCoords?: { x: number; y: number; z: number },
  materialHint?: string,
  spatialFrame: 'normalized' | 'standing' = 'normalized'
): AnatomicalBaseMetadata {
  const genericRaw =
    isGenericNodeName(rawName) || isGenericOrPartFallbackName(rawName);
  const genericPreferred =
    isGenericNodeName(preferredLabel) ||
    isGenericOrPartFallbackName(preferredLabel);

  // Resolve any generic GLB node (`Object_756`, `Mesh_012`, `Muscular — Part 756`) via 3D Spatial Resolver
  if (genericRaw && genericPreferred) {
    const inferredSys =
      systemOverride ??
      inferSystemFromName(rawName, preferredLabel || '', parentContextHint);
    const resolved = resolveSpatialStructure(
      {
        nx: spatialCoords?.x ?? 0,
        ny: spatialCoords?.y ?? 0,
        nz: spatialCoords?.z ?? 0,
        frame: spatialFrame,
      },
      inferredSys,
      materialHint || parentContextHint,
      meshIndex ?? 0
    );

    return {
      rawName,
      cleanName: resolved.cleanNameEn,
      cleanNameAr: resolved.cleanNameAr,
      latinName: resolved.latinName,
      laterality: resolved.laterality,
      system: resolved.system,
      ta98Code: resolved.ta98Code,
    };
  }

  let effectiveSource = (
    (!genericPreferred ? preferredLabel : undefined) ||
    (!genericRaw ? rawName : undefined) ||
    'Anatomical_Structure'
  ).trim();
  // Strip any accidental " — Part 123" / " — Primitive 0" trailing suffix even on labeled structures
  effectiveSource = effectiveSource
    .replace(/\s*(?:—|-|_|\.)\s*(?:Part|Primitive|Submesh|Mesh)\s*\d+\s*$/i, '')
    .trim();

  const { stripped, cleanName, baseLookupKey } = formatCleanDisplayName(effectiveSource);
  const laterality = detectLaterality(rawName, preferredLabel);

  const rigMeta =
    CALIBRATION_RIG_STRUCTURES[rawName] ?? CALIBRATION_RIG_STRUCTURES[stripped];
  const termEntry =
    TERMINOLOGY_MAP[baseLookupKey] ??
    TERMINOLOGY_MAP[cleanName.toLowerCase()];

  const system: AnatomicalSystem =
    systemOverride ??
    rigMeta?.system ??
    termEntry?.system ??
    inferSystemFromName(rawName, baseLookupKey, parentContextHint);

  let latinName = termEntry?.latinName ?? cleanName;
  if (termEntry?.latinName) {
    if (
      laterality === 'Left' &&
      !termEntry.latinName.toLowerCase().includes('sinist')
    ) {
      latinName =
        termEntry.latinName === 'Pulmo' ? 'Pulmo sinister' : termEntry.latinName;
    } else if (
      laterality === 'Right' &&
      !termEntry.latinName.toLowerCase().includes('dext')
    ) {
      latinName =
        termEntry.latinName === 'Pulmo' ? 'Pulmo dexter' : termEntry.latinName;
    }
  }

  const ta98Code =
    rigMeta?.ta98Code ||
    termEntry?.ta98Code ||
    buildFallbackTa98(system, cleanName);

  return {
    rawName,
    cleanName,
    latinName,
    laterality,
    system,
    ta98Code,
  };
}

/**
 * Normalizes a non-Three.js anatomical identifier (e.g. cloud viewer node ID & label)
 * into a structured AnatomicalPartInfo record compatible with the clinical inspector & search index.
 */
export function parseAnatomicalString(
  rawId: string,
  readableLabel?: string,
  systemOverride?: AnatomicalSystem
): AnatomicalPartInfo {
  const safeId = (rawId || readableLabel || 'Anatomical_Structure').trim();
  const base = buildAnatomicalBaseMetadata(
    safeId,
    readableLabel,
    systemOverride
  );
  return {
    meshUuid: safeId,
    rawName: base.rawName,
    cleanName: base.cleanName,
    cleanNameAr: base.cleanNameAr,
    latinName: base.latinName,
    laterality: base.laterality,
    system: base.system,
    ta98Code: base.ta98Code,
    worldCenter: [0, 1.0, 0],
    boundingRadius: 0.22,
  };
}

/**
 * Normalizes a Three.js anatomical mesh (external Z-Anatomy/NIH/Sketchfab GLB)
 * into structured Terminologia Anatomica metadata plus dynamic world-space bounds.
 */
export function parseAnatomicalMesh(
  inputMesh: THREE.Mesh,
  parentContextHint?: string,
  meshIndex?: number
): AnatomicalPartInfo {
  const mesh = resolveAnatomicalMeshObject(inputMesh);
  const hierarchyLabel = resolveBestHierarchyName(mesh);
  const ownAnatName =
    typeof mesh.userData?.anatomicalName === 'string' &&
    isNonGenericAnatomicalCandidate(mesh.userData.anatomicalName)
      ? mesh.userData.anatomicalName.trim()
      : undefined;
  const ownUserName =
    typeof mesh.userData?.name === 'string' &&
    isNonGenericAnatomicalCandidate(mesh.userData.name)
      ? mesh.userData.name.trim()
      : undefined;
  const ownMeshName =
    typeof mesh.name === 'string' && isNonGenericAnatomicalCandidate(mesh.name)
      ? mesh.name.trim()
      : undefined;
  const rawCandidate =
    ownAnatName ||
    ownUserName ||
    ownMeshName ||
    hierarchyLabel ||
    (typeof mesh.userData?.anatomicalName === 'string' &&
      mesh.userData.anatomicalName.trim()) ||
    (typeof mesh.userData?.name === 'string' && mesh.userData.name.trim()) ||
    (typeof mesh.name === 'string' && mesh.name.trim()) ||
    'Object_0';

  const userDataSystem = mesh.userData?.system as AnatomicalSystem | undefined;
  const resolvedContext =
    parentContextHint ||
    (typeof mesh.userData?.parentModelContext === 'string'
      ? mesh.userData.parentModelContext
      : undefined);
  const resolvedIndex =
    meshIndex ??
    (typeof mesh.userData?.partIndex === 'number'
      ? mesh.userData.partIndex
      : undefined);

  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  const sphere = new THREE.Sphere();
  const cachedBounds = mesh.userData?.__spatialBounds?.center as
    | THREE.Vector3
    | undefined;
  const cachedRest = mesh.userData?.__restCenter as THREE.Vector3 | undefined;
  const fallbackPos = new THREE.Vector3();

  let centerVec: { x: number; y: number; z: number };
  if (cachedBounds) {
    centerVec = { x: cachedBounds.x, y: cachedBounds.y, z: cachedBounds.z };
  } else if (cachedRest) {
    centerVec = { x: cachedRest.x, y: cachedRest.y, z: cachedRest.z };
  } else if (!box.isEmpty()) {
    box.getBoundingSphere(sphere);
    centerVec = { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z };
  } else {
    mesh.getWorldPosition(fallbackPos);
    centerVec = { x: fallbackPos.x, y: fallbackPos.y, z: fallbackPos.z };
  }

  const normalizedY =
    isInStandingWorldScene(mesh) || centerVec.y > 1.05 || centerVec.y < -1.05
      ? (centerVec.y - 0.9) / 0.9
      : centerVec.y;
  const normalizedCoords = {
    x: centerVec.x,
    y: Math.max(-1.0, Math.min(1.0, normalizedY)),
    z: centerVec.z,
  };

  const matNames = (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  )
    .map((m) => (typeof m?.name === 'string' ? m.name.trim() : ''))
    .filter(Boolean)
    .join(' ');
  const materialHint = matNames || undefined;

  const base = buildAnatomicalBaseMetadata(
    rawCandidate,
    hierarchyLabel,
    userDataSystem,
    resolvedContext,
    resolvedIndex,
    normalizedCoords,
    materialHint,
    'normalized'
  );

  let finalCleanName = base.cleanName;
  const finalCleanNameAr = base.cleanNameAr;
  let finalLatinName = base.latinName;
  let finalLaterality: AnatomicalLaterality = base.laterality;

  // Enforce Standard Anatomical Position laterality (+X = Subject's Left, -X = Subject's Right)
  // across standing full-body meshes so mislabeled bilateral craniofacial/limb parts (e.g. Eyelashes, TMJ ligament) never invert L/R.
  const inStandingAtlas =
    isInStandingWorldScene(mesh) ||
    /(?:zanatomy|nih_visible_human)/i.test(resolvedContext ?? '');
  const isAsymmetricOrCrossingStructure =
    isIntrinsicCardiacStructure(rawCandidate) ||
    /\b(?:brachiocephalic|gastric|gastro|hepatic|cystic|splenic|celiac|mesenteric|colic|azygos|hemiazygos|thoracic[\s_-]*duct|vagus|phrenic)\b/i.test(
      `${rawCandidate} ${finalCleanName}`
    );

  if (
    inStandingAtlas &&
    !isAsymmetricOrCrossingStructure &&
    Math.abs(centerVec.x) > 0.025 &&
    (finalLaterality === 'Left' || finalLaterality === 'Right')
  ) {
    const expectedSide: AnatomicalLaterality =
      centerVec.x > 0 ? 'Left' : 'Right';
    if (finalLaterality !== expectedSide) {
      finalLaterality = expectedSide;
      if (expectedSide === 'Left') {
        finalCleanName = /\bRight\b/i.test(finalCleanName)
          ? finalCleanName.replace(/\bRight\b/gi, 'Left')
          : `${finalCleanName} Left`;
        finalLatinName = finalLatinName.replace(/\bdext(er|ra)\b/gi, (_, suf) =>
          suf.toLowerCase() === 'ra' ? 'sinistra' : 'sinister'
        );
      } else {
        finalCleanName = /\bLeft\b/i.test(finalCleanName)
          ? finalCleanName.replace(/\bLeft\b/gi, 'Right')
          : `${finalCleanName} Right`;
        finalLatinName = finalLatinName.replace(/\bsinist(er|ra)\b/gi, (_, suf) =>
          suf.toLowerCase() === 'ra' ? 'dextra' : 'dexter'
        );
      }
    }
  }

  const ta98Code =
    (typeof mesh.userData?.ta98Code === 'string' && mesh.userData.ta98Code) ||
    base.ta98Code;
  const organGroupId =
    typeof mesh.userData?.organGroupId === 'string' &&
    mesh.userData.organGroupId.trim().length > 0
      ? mesh.userData.organGroupId.trim()
      : undefined;

  if (box.isEmpty()) {
    mesh.getWorldPosition(fallbackPos);
    return {
      meshUuid: mesh.uuid,
      rawName: base.rawName,
      cleanName: finalCleanName,
      cleanNameAr: finalCleanNameAr,
      latinName: finalLatinName,
      laterality: finalLaterality,
      system: base.system,
      ta98Code,
      organGroupId,
      worldCenter: [fallbackPos.x, fallbackPos.y, fallbackPos.z],
      boundingRadius: 0.2,
    };
  }

  box.getBoundingSphere(sphere);

  return {
    meshUuid: mesh.uuid,
    rawName: base.rawName,
    cleanName: finalCleanName,
    cleanNameAr: finalCleanNameAr,
    latinName: finalLatinName,
    laterality: finalLaterality,
    system: base.system,
    ta98Code,
    organGroupId,
    worldCenter: [sphere.center.x, sphere.center.y, sphere.center.z],
    boundingRadius: Math.max(sphere.radius, 0.05),
  };
}
