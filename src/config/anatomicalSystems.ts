import type { AnatomicalSystem } from '../store/useAnatomyStore';

export interface AnatomicalSystemConfig {
  id: AnatomicalSystem;
  label: string;
  shortLabel: string;
  accentColor: string;
  modelPath: string;
  externalModelAvailable: boolean;
}

export interface AnatomicalStructureMeta {
  meshId: string;
  anatomicalName: string;
  system: AnatomicalSystem;
  ta98Code: string;
}

export const ANATOMICAL_SYSTEMS: Record<
  AnatomicalSystem,
  AnatomicalSystemConfig
> = {
  integumentary: {
    id: 'integumentary',
    label: 'Integumentary (Skin)',
    shortLabel: 'SKIN',
    accentColor: '#d4a383',
    modelPath: '/models/integumentary.glb',
    externalModelAvailable: false,
  },
  skeletal: {
    id: 'skeletal',
    label: 'Skeletal',
    shortLabel: 'SKEL',
    accentColor: '#e8dfc8',
    modelPath: '/models/skeletal.glb',
    externalModelAvailable: false,
  },
  muscular: {
    id: 'muscular',
    label: 'Muscular',
    shortLabel: 'MUSC',
    accentColor: '#c94a4a',
    modelPath: '/models/muscular.glb',
    externalModelAvailable: false,
  },
  visceral: {
    id: 'visceral',
    label: 'Visceral',
    shortLabel: 'VISC',
    accentColor: '#d97b73',
    modelPath: '/models/visceral.glb',
    externalModelAvailable: false,
  },
  cardiovascular: {
    id: 'cardiovascular',
    label: 'Cardiovascular',
    shortLabel: 'CARD',
    accentColor: '#ef4444',
    modelPath: '/models/cardiovascular.glb',
    externalModelAvailable: false,
  },
  nervous: {
    id: 'nervous',
    label: 'Nervous',
    shortLabel: 'NERV',
    accentColor: '#eab308',
    modelPath: '/models/nervous.glb',
    externalModelAvailable: false,
  },
};

export const SYSTEM_DISPLAY_ORDER: AnatomicalSystem[] = [
  'integumentary',
  'skeletal',
  'muscular',
  'visceral',
  'cardiovascular',
  'nervous',
];

export const CALIBRATION_RIG_STRUCTURES: Record<
  string,
  AnatomicalStructureMeta
> = {
  // Integumentary System
  Skin_Epidermis: {
    meshId: 'Skin_Epidermis',
    anatomicalName: 'Skin (Cutis / Epidermis)',
    system: 'integumentary',
    ta98Code: 'A16.0.00.001',
  },

  // Skeletal System (21 Structures)
  Cranium: {
    meshId: 'Cranium',
    anatomicalName: 'Cranium (Skull)',
    system: 'skeletal',
    ta98Code: 'A02.1.00.001',
  },
  Mandible: {
    meshId: 'Mandible',
    anatomicalName: 'Mandible (Lower Jaw)',
    system: 'skeletal',
    ta98Code: 'A02.1.15.001',
  },
  Clavicle_Left: {
    meshId: 'Clavicle_Left',
    anatomicalName: 'Left Clavicle',
    system: 'skeletal',
    ta98Code: 'A02.4.02.001',
  },
  Clavicle_Right: {
    meshId: 'Clavicle_Right',
    anatomicalName: 'Right Clavicle',
    system: 'skeletal',
    ta98Code: 'A02.4.02.001',
  },
  Scapula_Left: {
    meshId: 'Scapula_Left',
    anatomicalName: 'Left Scapula',
    system: 'skeletal',
    ta98Code: 'A02.4.01.001',
  },
  Scapula_Right: {
    meshId: 'Scapula_Right',
    anatomicalName: 'Right Scapula',
    system: 'skeletal',
    ta98Code: 'A02.4.01.001',
  },
  Sternum: {
    meshId: 'Sternum',
    anatomicalName: 'Sternum',
    system: 'skeletal',
    ta98Code: 'A02.3.03.001',
  },
  Thoracic_Cage: {
    meshId: 'Thoracic_Cage',
    anatomicalName: 'Thoracic Cage (Ribs)',
    system: 'skeletal',
    ta98Code: 'A02.3.04.001',
  },
  Cervical_Vertebrae: {
    meshId: 'Cervical_Vertebrae',
    anatomicalName: 'Cervical Vertebrae (C1–C7)',
    system: 'skeletal',
    ta98Code: 'A02.2.02.001',
  },
  Thoracic_Vertebrae: {
    meshId: 'Thoracic_Vertebrae',
    anatomicalName: 'Thoracic Vertebrae (T1–T12)',
    system: 'skeletal',
    ta98Code: 'A02.2.03.001',
  },
  Lumbar_Vertebrae: {
    meshId: 'Lumbar_Vertebrae',
    anatomicalName: 'Lumbar Vertebrae (L1–L5)',
    system: 'skeletal',
    ta98Code: 'A02.2.04.001',
  },
  Sacrum: {
    meshId: 'Sacrum',
    anatomicalName: 'Sacrum & Coccyx',
    system: 'skeletal',
    ta98Code: 'A02.2.05.001',
  },
  Pelvis: {
    meshId: 'Pelvis',
    anatomicalName: 'Pelvic Girdle (Hip Bones)',
    system: 'skeletal',
    ta98Code: 'A02.5.02.001',
  },
  Humerus_Left: {
    meshId: 'Humerus_Left',
    anatomicalName: 'Left Humerus',
    system: 'skeletal',
    ta98Code: 'A02.4.04.001',
  },
  Humerus_Right: {
    meshId: 'Humerus_Right',
    anatomicalName: 'Right Humerus',
    system: 'skeletal',
    ta98Code: 'A02.4.04.001',
  },
  Radius_Ulna_Left: {
    meshId: 'Radius_Ulna_Left',
    anatomicalName: 'Left Radius & Ulna',
    system: 'skeletal',
    ta98Code: 'A02.4.05.001',
  },
  Radius_Ulna_Right: {
    meshId: 'Radius_Ulna_Right',
    anatomicalName: 'Right Radius & Ulna',
    system: 'skeletal',
    ta98Code: 'A02.4.05.001',
  },
  Femur_Left: {
    meshId: 'Femur_Left',
    anatomicalName: 'Left Femur',
    system: 'skeletal',
    ta98Code: 'A02.5.04.001',
  },
  Femur_Right: {
    meshId: 'Femur_Right',
    anatomicalName: 'Right Femur',
    system: 'skeletal',
    ta98Code: 'A02.5.04.001',
  },
  Tibia_Fibula_Left: {
    meshId: 'Tibia_Fibula_Left',
    anatomicalName: 'Left Tibia & Fibula',
    system: 'skeletal',
    ta98Code: 'A02.5.06.001',
  },
  Tibia_Fibula_Right: {
    meshId: 'Tibia_Fibula_Right',
    anatomicalName: 'Right Tibia & Fibula',
    system: 'skeletal',
    ta98Code: 'A02.5.06.001',
  },

  // Muscular System (15 Structures)
  Temporalis: {
    meshId: 'Temporalis',
    anatomicalName: 'Temporalis',
    system: 'muscular',
    ta98Code: 'A04.1.04.005',
  },
  Sternocleidomastoid: {
    meshId: 'Sternocleidomastoid',
    anatomicalName: 'Sternocleidomastoid',
    system: 'muscular',
    ta98Code: 'A04.2.01.008',
  },
  Pectoralis_Major_Left: {
    meshId: 'Pectoralis_Major_Left',
    anatomicalName: 'Left Pectoralis Major',
    system: 'muscular',
    ta98Code: 'A04.4.01.002',
  },
  Pectoralis_Major_Right: {
    meshId: 'Pectoralis_Major_Right',
    anatomicalName: 'Right Pectoralis Major',
    system: 'muscular',
    ta98Code: 'A04.4.01.002',
  },
  Deltoid_Left: {
    meshId: 'Deltoid_Left',
    anatomicalName: 'Left Deltoid',
    system: 'muscular',
    ta98Code: 'A04.6.02.002',
  },
  Deltoid_Right: {
    meshId: 'Deltoid_Right',
    anatomicalName: 'Right Deltoid',
    system: 'muscular',
    ta98Code: 'A04.6.02.002',
  },
  Biceps_Brachii_Left: {
    meshId: 'Biceps_Brachii_Left',
    anatomicalName: 'Left Biceps Brachii',
    system: 'muscular',
    ta98Code: 'A04.6.02.013',
  },
  Biceps_Brachii_Right: {
    meshId: 'Biceps_Brachii_Right',
    anatomicalName: 'Right Biceps Brachii',
    system: 'muscular',
    ta98Code: 'A04.6.02.013',
  },
  Rectus_Abdominis: {
    meshId: 'Rectus_Abdominis',
    anatomicalName: 'Rectus Abdominis',
    system: 'muscular',
    ta98Code: 'A04.5.01.001',
  },
  External_Oblique: {
    meshId: 'External_Oblique',
    anatomicalName: 'External Abdominal Oblique',
    system: 'muscular',
    ta98Code: 'A04.5.01.008',
  },
  Gluteus_Maximus: {
    meshId: 'Gluteus_Maximus',
    anatomicalName: 'Gluteus Maximus',
    system: 'muscular',
    ta98Code: 'A04.7.02.006',
  },
  Rectus_Femoris_Left: {
    meshId: 'Rectus_Femoris_Left',
    anatomicalName: 'Left Rectus Femoris',
    system: 'muscular',
    ta98Code: 'A04.7.02.018',
  },
  Rectus_Femoris_Right: {
    meshId: 'Rectus_Femoris_Right',
    anatomicalName: 'Right Rectus Femoris',
    system: 'muscular',
    ta98Code: 'A04.7.02.018',
  },
  Gastrocnemius_Left: {
    meshId: 'Gastrocnemius_Left',
    anatomicalName: 'Left Gastrocnemius',
    system: 'muscular',
    ta98Code: 'A04.7.02.044',
  },
  Gastrocnemius_Right: {
    meshId: 'Gastrocnemius_Right',
    anatomicalName: 'Right Gastrocnemius',
    system: 'muscular',
    ta98Code: 'A04.7.02.044',
  },

  // Visceral & Reproductive System
  Brain: {
    meshId: 'Brain',
    anatomicalName: 'Encephalon (Cerebrum)',
    system: 'visceral',
    ta98Code: 'A14.1.03.001',
  },
  Cerebellum: {
    meshId: 'Cerebellum',
    anatomicalName: 'Cerebellum',
    system: 'visceral',
    ta98Code: 'A14.1.07.001',
  },
  Thyroid_Gland: {
    meshId: 'Thyroid_Gland',
    anatomicalName: 'Thyroid Gland',
    system: 'visceral',
    ta98Code: 'A11.3.00.001',
  },
  Trachea: {
    meshId: 'Trachea',
    anatomicalName: 'Trachea & Primary Bronchi',
    system: 'visceral',
    ta98Code: 'A06.3.01.001',
  },
  Lungs_Left: {
    meshId: 'Lungs_Left',
    anatomicalName: 'Left Lung (Pulmo Sinister)',
    system: 'visceral',
    ta98Code: 'A06.5.01.001',
  },
  Lungs_Right: {
    meshId: 'Lungs_Right',
    anatomicalName: 'Right Lung (Pulmo Dexter)',
    system: 'visceral',
    ta98Code: 'A06.5.01.001',
  },
  Diaphragm: {
    meshId: 'Diaphragm',
    anatomicalName: 'Thoracic Diaphragm',
    system: 'visceral',
    ta98Code: 'A04.4.02.001',
  },
  Liver: {
    meshId: 'Liver',
    anatomicalName: 'Liver (Hepar)',
    system: 'visceral',
    ta98Code: 'A05.8.01.001',
  },
  Gallbladder: {
    meshId: 'Gallbladder',
    anatomicalName: 'Gallbladder',
    system: 'visceral',
    ta98Code: 'A05.8.02.001',
  },
  Stomach: {
    meshId: 'Stomach',
    anatomicalName: 'Stomach (Gaster)',
    system: 'visceral',
    ta98Code: 'A05.5.01.001',
  },
  Pancreas: {
    meshId: 'Pancreas',
    anatomicalName: 'Pancreas',
    system: 'visceral',
    ta98Code: 'A05.9.01.001',
  },
  Spleen: {
    meshId: 'Spleen',
    anatomicalName: 'Spleen (Splen)',
    system: 'visceral',
    ta98Code: 'A13.2.01.001',
  },
  Small_Intestine: {
    meshId: 'Small_Intestine',
    anatomicalName: 'Small Intestine',
    system: 'visceral',
    ta98Code: 'A05.6.01.001',
  },
  Large_Intestine_Colon: {
    meshId: 'Large_Intestine_Colon',
    anatomicalName: 'Large Intestine (Colon)',
    system: 'visceral',
    ta98Code: 'A05.7.01.001',
  },
  Kidneys_Left: {
    meshId: 'Kidneys_Left',
    anatomicalName: 'Left Kidney',
    system: 'visceral',
    ta98Code: 'A08.1.01.001',
  },
  Kidneys_Right: {
    meshId: 'Kidneys_Right',
    anatomicalName: 'Right Kidney',
    system: 'visceral',
    ta98Code: 'A08.1.01.001',
  },
  Urinary_Bladder: {
    meshId: 'Urinary_Bladder',
    anatomicalName: 'Urinary Bladder',
    system: 'visceral',
    ta98Code: 'A08.3.01.001',
  },

  // Male-Specific Reproductive Structures
  Prostate_Gland: {
    meshId: 'Prostate_Gland',
    anatomicalName: 'Prostate Gland',
    system: 'visceral',
    ta98Code: 'A09.3.08.001',
  },
  Testes_Left: {
    meshId: 'Testes_Left',
    anatomicalName: 'Left Testis',
    system: 'visceral',
    ta98Code: 'A09.3.01.001',
  },
  Testes_Right: {
    meshId: 'Testes_Right',
    anatomicalName: 'Right Testis',
    system: 'visceral',
    ta98Code: 'A09.3.01.001',
  },

  // Female-Specific Reproductive Structures
  Uterus: {
    meshId: 'Uterus',
    anatomicalName: 'Uterus',
    system: 'visceral',
    ta98Code: 'A09.1.03.001',
  },
  Ovary_Left: {
    meshId: 'Ovary_Left',
    anatomicalName: 'Left Ovary',
    system: 'visceral',
    ta98Code: 'A09.1.01.001',
  },
  Ovary_Right: {
    meshId: 'Ovary_Right',
    anatomicalName: 'Right Ovary',
    system: 'visceral',
    ta98Code: 'A09.1.01.001',
  },
  Fallopian_Tubes: {
    meshId: 'Fallopian_Tubes',
    anatomicalName: 'Fallopian Tubes (Uterine Tubes)',
    system: 'visceral',
    ta98Code: 'A09.1.02.001',
  },
  Mammary_Glands: {
    meshId: 'Mammary_Glands',
    anatomicalName: 'Mammary Glands',
    system: 'visceral',
    ta98Code: 'A16.0.02.001',
  },

  // Cardiovascular System (10 Structures)
  Heart: {
    meshId: 'Heart',
    anatomicalName: 'Heart (Cor)',
    system: 'cardiovascular',
    ta98Code: 'A12.1.00.001',
  },
  Aorta_Arch: {
    meshId: 'Aorta_Arch',
    anatomicalName: 'Aortic Arch',
    system: 'cardiovascular',
    ta98Code: 'A12.2.04.001',
  },
  Thoracic_Aorta: {
    meshId: 'Thoracic_Aorta',
    anatomicalName: 'Thoracic Aorta',
    system: 'cardiovascular',
    ta98Code: 'A12.2.11.001',
  },
  Abdominal_Aorta: {
    meshId: 'Abdominal_Aorta',
    anatomicalName: 'Abdominal Aorta',
    system: 'cardiovascular',
    ta98Code: 'A12.2.12.001',
  },
  Superior_Vena_Cava: {
    meshId: 'Superior_Vena_Cava',
    anatomicalName: 'Superior Vena Cava',
    system: 'cardiovascular',
    ta98Code: 'A12.3.03.001',
  },
  Inferior_Vena_Cava: {
    meshId: 'Inferior_Vena_Cava',
    anatomicalName: 'Inferior Vena Cava',
    system: 'cardiovascular',
    ta98Code: 'A12.3.09.001',
  },
  Carotid_Arteries: {
    meshId: 'Carotid_Arteries',
    anatomicalName: 'Common Carotid Arteries',
    system: 'cardiovascular',
    ta98Code: 'A12.2.04.006',
  },
  Jugular_Veins: {
    meshId: 'Jugular_Veins',
    anatomicalName: 'Internal Jugular Veins',
    system: 'cardiovascular',
    ta98Code: 'A12.3.05.001',
  },
  Iliac_Vessels: {
    meshId: 'Iliac_Vessels',
    anatomicalName: 'Common Iliac Vessels',
    system: 'cardiovascular',
    ta98Code: 'A12.2.14.001',
  },
  Femoral_Arteries: {
    meshId: 'Femoral_Arteries',
    anatomicalName: 'Femoral Arteries',
    system: 'cardiovascular',
    ta98Code: 'A12.2.16.010',
  },

  // Nervous System (9 Structures)
  Cerebral_Cortex_Nerves: {
    meshId: 'Cerebral_Cortex_Nerves',
    anatomicalName: 'Cerebral & Cranial Pathways',
    system: 'nervous',
    ta98Code: 'A14.1.09.001',
  },
  Spinal_Cord: {
    meshId: 'Spinal_Cord',
    anatomicalName: 'Spinal Cord (Medulla Spinalis)',
    system: 'nervous',
    ta98Code: 'A14.1.02.001',
  },
  Cervical_Plexus: {
    meshId: 'Cervical_Plexus',
    anatomicalName: 'Cervical Plexus (C1–C4)',
    system: 'nervous',
    ta98Code: 'A14.2.02.012',
  },
  Brachial_Plexus_Left: {
    meshId: 'Brachial_Plexus_Left',
    anatomicalName: 'Left Brachial Plexus',
    system: 'nervous',
    ta98Code: 'A14.2.03.001',
  },
  Brachial_Plexus_Right: {
    meshId: 'Brachial_Plexus_Right',
    anatomicalName: 'Right Brachial Plexus',
    system: 'nervous',
    ta98Code: 'A14.2.03.001',
  },
  Vagus_Nerve: {
    meshId: 'Vagus_Nerve',
    anatomicalName: 'Vagus Nerve (CN X)',
    system: 'nervous',
    ta98Code: 'A14.2.01.153',
  },
  Lumbar_Plexus: {
    meshId: 'Lumbar_Plexus',
    anatomicalName: 'Lumbar Plexus (L1–L4)',
    system: 'nervous',
    ta98Code: 'A14.2.07.002',
  },
  Sciatic_Nerve_Left: {
    meshId: 'Sciatic_Nerve_Left',
    anatomicalName: 'Left Sciatic Nerve',
    system: 'nervous',
    ta98Code: 'A14.2.07.046',
  },
  Sciatic_Nerve_Right: {
    meshId: 'Sciatic_Nerve_Right',
    anatomicalName: 'Right Sciatic Nerve',
    system: 'nervous',
    ta98Code: 'A14.2.07.046',
  },
};
