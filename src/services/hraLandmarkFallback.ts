/**
 * Static offline fallback index of NIH HRA v0.20.0 Anatomical & Surgical Landmark GLBs
 * derived strictly from extractionSets[organKey]Landmarks in GET /v1/rui-reference-data.
 */

export interface CompactHraLandmarkFallbackRow {
  k: string;
  sl: string;
  ol: string;
  ont: string;
  sx: 'male' | 'female';
  sd: 'left' | 'right' | 'center';
  u: string;
  n: Array<[string, string]>;
}

export const HRA_LANDMARK_ORG_PREFIX = 'https://purl.humanatlas.io/ref-organ/';
export const HRA_LANDMARK_GLB_PREFIX = 'https://cdn.humanatlas.io/digital-objects/landmark/';
export const HRA_LANDMARK_UBERON_PREFIX = 'http://purl.obolibrary.org/obo/';

export const STATIC_HRA_LANDMARK_ROWS: CompactHraLandmarkFallbackRow[] = [
  {
    "k": "eye-female-left/v1.3#primary",
    "sl": "eye-female-left",
    "ol": "Left eye",
    "ont": "UBERON_0004548",
    "sx": "female",
    "sd": "left",
    "u": "eye-female-left-landmarks/v1.0/assets/3d-vh-f-eye-l-landmark.glb",
    "n": [
      [
        "Left Eye Arteries",
        "VH_F_eye_L_landmark_arteries"
      ],
      [
        "Left Eye Dura Mater Optic Nerve",
        "VH_F_eye_L_landmark_dura_mater_optic_nerve"
      ],
      [
        "Left Eye Muscles",
        "VH_F_eye_L_landmark_muscles"
      ],
      [
        "Left Eye Veins",
        "VH_F_eye_L_landmark_veins"
      ]
    ]
  },
  {
    "k": "eye-female-right/v1.3#primary",
    "sl": "eye-female-right",
    "ol": "Right eye",
    "ont": "UBERON_0004549",
    "sx": "female",
    "sd": "right",
    "u": "eye-female-right-landmarks/v1.0/assets/3d-vh-f-eye-r-landmark.glb",
    "n": [
      [
        "Right Eye Arteries",
        "VH_F_eye_R_landmark_arteries"
      ],
      [
        "Right Eye Dura Mater Optic Nerve",
        "VH_F_eye_R_landmark_dura_mater_optic_nerve"
      ],
      [
        "Right Eye Muscles",
        "VH_F_eye_R_landmark_muscles"
      ],
      [
        "Right Eye Veins",
        "VH_F_eye_R_landmark_veins"
      ]
    ]
  },
  {
    "k": "eye-male-left/v1.3#primary",
    "sl": "eye-male-left",
    "ol": "Left eye",
    "ont": "UBERON_0004548",
    "sx": "male",
    "sd": "left",
    "u": "eye-male-left-landmarks/v1.0/assets/3d-vh-m-eye-l-landmark.glb",
    "n": [
      [
        "Left Eye Arteries",
        "VH_M_eye_L_landmark_arteries"
      ],
      [
        "Left Eye Dura Mater Optic Nerve",
        "VH_M_eye_L_landmark_dura_mater_optic_nerve"
      ],
      [
        "Left Eye Muscles",
        "VH_M_eye_L_landmark_muscles"
      ],
      [
        "Left Eye Veins",
        "VH_M_eye_L_landmark_veins"
      ]
    ]
  },
  {
    "k": "eye-male-right/v1.3#primary",
    "sl": "eye-male-right",
    "ol": "Right eye",
    "ont": "UBERON_0004549",
    "sx": "male",
    "sd": "right",
    "u": "eye-male-right-landmarks/v1.0/assets/3d-vh-m-eye-r-landmark.glb",
    "n": [
      [
        "Right Eye Arteries",
        "VH_M_eye_R_landmark_arteries"
      ],
      [
        "Right Eye Dura Mater Optic Nerve",
        "VH_M_eye_R_landmark_dura_mater_optic_nerve"
      ],
      [
        "Right Eye Muscles",
        "VH_M_eye_R_landmark_muscles"
      ],
      [
        "Right Eye Veins",
        "VH_M_eye_R_landmark_veins"
      ]
    ]
  },
  {
    "k": "fallopian-tube-female-left/v1.2#primary",
    "sl": "fallopian-tube-female-left",
    "ol": "Left fallopian tube",
    "ont": "UBERON_0001303",
    "sx": "female",
    "sd": "left",
    "u": "fallopian-tube-female-left-landmarks/v1.0/assets/3d-vh-f-fallopian-tube-l-landmark.glb",
    "n": [
      [
        "left ovary",
        "VH_F_fallopian_tube_L_landmark_left_ovary"
      ],
      [
        "uterus",
        "VH_F_fallopian_tube_L_landmark_uterus"
      ]
    ]
  },
  {
    "k": "fallopian-tube-female-right/v1.2#primary",
    "sl": "fallopian-tube-female-right",
    "ol": "Right fallopian tube",
    "ont": "UBERON_0001302",
    "sx": "female",
    "sd": "right",
    "u": "fallopian-tube-female-right-landmarks/v1.0/assets/3d-vh-f-fallopian-tube-r-landmark.glb",
    "n": [
      [
        "right ovary",
        "VH_F_fallopian_tube_R_landmark_right_ovary"
      ],
      [
        "uterus",
        "VH_F_fallopian_tube_R_landmark_uterus"
      ]
    ]
  },
  {
    "k": "heart-female/v1.3#primary",
    "sl": "heart-female",
    "ol": "heart",
    "ont": "UBERON_0000948",
    "sx": "female",
    "sd": "center",
    "u": "heart-female-landmarks/v1.0/assets/3d-vh-f-heart-landmark.glb",
    "n": [
      [
        "Heart arteries",
        "VH_F_heart_landmark_arteries"
      ],
      [
        "Heart veins",
        "VH_F_heart_landmark_veins"
      ]
    ]
  },
  {
    "k": "heart-male/v1.3#primary",
    "sl": "heart-male",
    "ol": "heart",
    "ont": "UBERON_0000948",
    "sx": "male",
    "sd": "center",
    "u": "heart-male-landmarks/v1.0/assets/VH_M_Heart_Landmarks.glb",
    "n": [
      [
        "Heart arteries",
        "VH_M_heart_landmark_arteries"
      ],
      [
        "Heart veins",
        "VH_M_heart_landmark_veins"
      ]
    ]
  },
  {
    "k": "kidney-female-left/v1.3#primary",
    "sl": "kidney-female-left",
    "ol": "Left kidney",
    "ont": "UBERON_0004538",
    "sx": "female",
    "sd": "left",
    "u": "kidney-female-both-extraction-sites/v1.0/assets/3d-vh-f-kidney-extraction.glb",
    "n": [
      [
        "Bisection Line",
        "VH_F_kidney_bisection_line_L"
      ]
    ]
  },
  {
    "k": "kidney-female-left/v1.3#primary",
    "sl": "kidney-female-left",
    "ol": "Left kidney",
    "ont": "UBERON_0004538",
    "sx": "female",
    "sd": "left",
    "u": "kidney-female-left-landmarks/v1.0/assets/3d-vh-f-kidney-l-landmark.glb",
    "n": [
      [
        "left ureter",
        "VH_F_kidney_L_landmark_left_ureter"
      ],
      [
        "major calyxes",
        "VH_F_kidney_L_landmark_major_calyxes"
      ],
      [
        "minor calyxes",
        "VH_F_kidney_L_landmark_minor_calyxes"
      ],
      [
        "left renal artery",
        "VH_F_kidney_L_landmark_renal_artery"
      ],
      [
        "left renal pelvis",
        "VH_F_kidney_L_landmark_renal_pelvis"
      ],
      [
        "left renal vein",
        "VH_F_kidney_L_landmark_renal_vein"
      ]
    ]
  },
  {
    "k": "kidney-female-right/v1.3#primary",
    "sl": "kidney-female-right",
    "ol": "Right kidney",
    "ont": "UBERON_0004539",
    "sx": "female",
    "sd": "right",
    "u": "kidney-female-both-extraction-sites/v1.0/assets/3d-vh-f-kidney-extraction.glb",
    "n": [
      [
        "Bisection Line",
        "VH_F_kidney_bisection_line_R"
      ]
    ]
  },
  {
    "k": "kidney-female-right/v1.3#primary",
    "sl": "kidney-female-right",
    "ol": "Right kidney",
    "ont": "UBERON_0004539",
    "sx": "female",
    "sd": "right",
    "u": "kidney-female-right-landmarks/v1.0/assets/3d-vh-f-kidney-r-landmark.glb",
    "n": [
      [
        "major calyxes",
        "VH_F_kidney_R_landmark_major_calyxes"
      ],
      [
        "minor calyxes",
        "VH_F_kidney_R_landmark_minor_calyxes"
      ],
      [
        "right renal artery",
        "VH_F_kidney_R_landmark_renal_artery"
      ],
      [
        "right renal pelvis",
        "VH_F_kidney_R_landmark_renal_pelvis"
      ],
      [
        "right renal vein",
        "VH_F_kidney_R_landmark_renal_vein"
      ],
      [
        "right ureter",
        "VH_F_kidney_R_landmark_right_ureter"
      ]
    ]
  },
  {
    "k": "kidney-male-left/v1.3#primary",
    "sl": "kidney-male-left",
    "ol": "Left kidney",
    "ont": "UBERON_0004538",
    "sx": "male",
    "sd": "left",
    "u": "kidney-male-both-extraction-sites/v1.0/assets/VH_M_Kidney_Extraction_Sites.glb",
    "n": [
      [
        "bisection line",
        "VH_M_kidney_HuBMAP_bisection_line_L"
      ]
    ]
  },
  {
    "k": "kidney-male-left/v1.3#primary",
    "sl": "kidney-male-left",
    "ol": "Left kidney",
    "ont": "UBERON_0004538",
    "sx": "male",
    "sd": "left",
    "u": "kidney-male-left-landmarks/v1.0/assets/VH_M_Kidney_L_Landmarks.glb",
    "n": [
      [
        "left renal artery",
        "VH_M_kidney_L_landmark_major_calyxes"
      ],
      [
        "left renal vein",
        "VH_M_kidney_L_landmark_minor_calyxes"
      ],
      [
        "major calyxes",
        "VH_M_kidney_L_landmark_renal_artery"
      ],
      [
        "left ureter",
        "VH_M_kidney_L_landmark_renal_pelvis"
      ],
      [
        "minor calyxes",
        "VH_M_kidney_L_landmark_renal_vein"
      ],
      [
        "left renal pelvis",
        "VH_M_kidney_L_landmark_ureter"
      ]
    ]
  },
  {
    "k": "kidney-male-right/v1.3#primary",
    "sl": "kidney-male-right",
    "ol": "Right kidney",
    "ont": "UBERON_0004539",
    "sx": "male",
    "sd": "right",
    "u": "kidney-male-both-extraction-sites/v1.0/assets/VH_M_Kidney_Extraction_Sites.glb",
    "n": [
      [
        "bisection line",
        "VH_M_kidney_HuBMAP_bisection_line_R"
      ]
    ]
  },
  {
    "k": "kidney-male-right/v1.3#primary",
    "sl": "kidney-male-right",
    "ol": "Right kidney",
    "ont": "UBERON_0004539",
    "sx": "male",
    "sd": "right",
    "u": "kidney-male-right-landmarks/v1.0/assets/VH_M_Kidney_R_Landmarks.glb",
    "n": [
      [
        "major calyxes",
        "VH_M_kidney_R_landmark_major_calyxes"
      ],
      [
        "minor calyxes",
        "VH_M_kidney_R_landmark_minor_calyxes"
      ],
      [
        "right renal artery",
        "VH_M_kidney_R_landmark_renal_artery"
      ],
      [
        "right renal pelvis",
        "VH_M_kidney_R_landmark_renal_pelvis"
      ],
      [
        "right renal vein",
        "VH_M_kidney_R_landmark_renal_vein"
      ],
      [
        "right ureter",
        "VH_M_kidney_R_landmark_ureter"
      ]
    ]
  },
  {
    "k": "knee-female-left/v1.3#primary",
    "sl": "knee-female-left",
    "ol": "Left knee",
    "ont": "http://purl.org/sig/ont/fma/fma24978",
    "sx": "female",
    "sd": "left",
    "u": "knee-female-left-landmarks/v1.0/assets/3d-vh-f-knee-l-landmark.glb",
    "n": [
      [
        "left knee ligaments",
        "VH_F_knee_L_landmark_ligaments"
      ],
      [
        "left rectus femoris",
        "VH_F_knee_L_landmark_rectus_femoris"
      ]
    ]
  },
  {
    "k": "knee-female-right/v1.3#primary",
    "sl": "knee-female-right",
    "ol": "Right knee",
    "ont": "http://purl.org/sig/ont/fma/fma24977",
    "sx": "female",
    "sd": "right",
    "u": "knee-female-right-landmarks/v1.0/assets/3d-vh-f-knee-r-landmark.glb",
    "n": [
      [
        "right knee ligaments",
        "VH_F_knee_R_landmark_ligaments"
      ],
      [
        "right rectus femoris",
        "VH_F_knee_R_landmark_rectus_femoris"
      ]
    ]
  },
  {
    "k": "knee-male-left/v1.2#primary",
    "sl": "knee-male-left",
    "ol": "Left knee",
    "ont": "http://purl.org/sig/ont/fma/fma24978",
    "sx": "male",
    "sd": "left",
    "u": "knee-male-left-landmarks/v1.0/assets/VH_M_Knee_L_Landmarks.glb",
    "n": [
      [
        "left knee ligaments",
        "VH_M_knee_L_landmark_ligaments"
      ],
      [
        "left rectus femoris",
        "VH_M_knee_L_landmark_rectus_femoris"
      ]
    ]
  },
  {
    "k": "knee-male-right/v1.2#primary",
    "sl": "knee-male-right",
    "ol": "Right knee",
    "ont": "http://purl.org/sig/ont/fma/fma24977",
    "sx": "male",
    "sd": "right",
    "u": "knee-male-right-landmarks/v1.0/assets/VH_M_Knee_R_Landmarks.glb",
    "n": [
      [
        "right knee ligaments",
        "VH_M_knee_R_landmark_ligaments"
      ],
      [
        "right rectus femoris",
        "VH_M_knee_R_landmark_rectus_femoris"
      ]
    ]
  },
  {
    "k": "large-intestine-female/v1.3#primary",
    "sl": "large-intestine-female",
    "ol": "large intestine",
    "ont": "UBERON_0000059",
    "sx": "female",
    "sd": "center",
    "u": "large-intestine-female-landmarks/v1.0/assets/3d-vh-f-large-intestine-landmark.glb",
    "n": [
      [
        "large intestine arteries",
        "VH_F_large_intestine_landmark_arteries"
      ],
      [
        "large intestine veins",
        "VH_F_large_intestine_landmark_veins"
      ]
    ]
  },
  {
    "k": "large-intestine-male/v1.3#primary",
    "sl": "large-intestine-male",
    "ol": "large intestine",
    "ont": "UBERON_0000059",
    "sx": "male",
    "sd": "center",
    "u": "large-intestine-male-landmarks/v1.0/assets/VH_M_Large_Intestine_Landmarks.glb",
    "n": [
      [
        "large intestine arteries",
        "VH_M_large_intestine_landmark_arteries"
      ],
      [
        "large intestine veins",
        "VH_M_large_intestine_landmark_veins"
      ]
    ]
  },
  {
    "k": "larynx-female/v1.1#primary",
    "sl": "larynx-female",
    "ol": "larynx",
    "ont": "UBERON_0001737",
    "sx": "female",
    "sd": "center",
    "u": "larynx-female-landmarks/v1.0/assets/3d-vh-f-larynx-landmark.glb",
    "n": [
      [
        "tracheal cartilage",
        "VH_F_larynx_landmark_trachea_tracheal_cartilage"
      ]
    ]
  },
  {
    "k": "larynx-male/v1.1#primary",
    "sl": "larynx-male",
    "ol": "larynx",
    "ont": "UBERON_0001737",
    "sx": "male",
    "sd": "center",
    "u": "larynx-male-landmarks/v1.0/assets/3d-vh-m-larynx-landmark.glb",
    "n": [
      [
        "arytenoid",
        "VH_M_larynx_landmark_arytenoid"
      ],
      [
        "cricothyroids",
        "VH_M_larynx_landmark_cricothyroids"
      ],
      [
        "lateral cricoarytenoids",
        "VH_M_larynx_landmark_lateral_cricoarytenoids"
      ],
      [
        "posterior cricoarytenoids",
        "VH_M_larynx_landmark_posterior_cricoarytenoids"
      ],
      [
        "thyroarytenoids",
        "VH_M_larynx_landmark_thyroarytenoids"
      ],
      [
        "thyroepiglottideus",
        "VH_M_larynx_landmark_thyroepiglottideus"
      ],
      [
        "tracheal cartilage",
        "VH_M_larynx_landmark_trachea_tracheal_cartilage"
      ],
      [
        "vocalis",
        "VH_M_larynx_landmark_vocalis"
      ]
    ]
  },
  {
    "k": "liver-female/v1.2#primary",
    "sl": "liver-female",
    "ol": "liver",
    "ont": "UBERON_0002107",
    "sx": "female",
    "sd": "center",
    "u": "liver-female-landmarks/v1.0/assets/3d-vh-f-liver-landmark.glb",
    "n": [
      [
        "arteries of liver",
        "VH_F_liver_landmark_arteries_of_liver"
      ],
      [
        "biliary tree",
        "VH_F_liver_landmark_biliary_tree"
      ],
      [
        "cystic artery",
        "VH_F_liver_landmark_cystic_artery"
      ],
      [
        "cystic vein",
        "VH_F_liver_landmark_cystic_vein"
      ],
      [
        "gallbladder",
        "VH_F_liver_landmark_gallbladder"
      ],
      [
        "veins of liver",
        "VH_F_liver_landmark_veins_of_liver"
      ]
    ]
  },
  {
    "k": "liver-male/v1.2#primary",
    "sl": "liver-male",
    "ol": "liver",
    "ont": "UBERON_0002107",
    "sx": "male",
    "sd": "center",
    "u": "liver-male-landmarks/v1.0/assets/VH_M_Liver_Landmarks.glb",
    "n": [
      [
        "arteries of liver",
        "VH_M_liver_landmark_arteries_of_liver"
      ],
      [
        "biliary tree",
        "VH_M_liver_landmark_biliary_tree"
      ],
      [
        "cystic artery",
        "VH_M_liver_landmark_cystic_artery"
      ],
      [
        "cystic vein",
        "VH_M_liver_landmark_cystic_vein"
      ],
      [
        "gallbladder",
        "VH_M_liver_landmark_gallbladder"
      ],
      [
        "veins of liver",
        "VH_M_liver_landmark_veins_of_liver"
      ]
    ]
  },
  {
    "k": "lung-female/v1.4#primary",
    "sl": "lung-female",
    "ol": "lung",
    "ont": "UBERON_0001004",
    "sx": "female",
    "sd": "center",
    "u": "lung-female-landmarks/v1.0/assets/3d-vh-f-lung-landmark.glb",
    "n": [
      [
        "carina",
        "VH_F_lung_landmark_carina"
      ],
      [
        "larynx larygneal cartilage",
        "VH_F_lung_landmark_larynx_laryngeal_cartilage"
      ],
      [
        "main bronchus",
        "VH_F_lung_landmark_main_bronchus"
      ],
      [
        "trachea tracheal cartilage",
        "VH_F_lung_landmark_trachea_tracheal_cartilage"
      ]
    ]
  },
  {
    "k": "lung-male/v1.4#primary",
    "sl": "lung-male",
    "ol": "lung",
    "ont": "UBERON_0001004",
    "sx": "male",
    "sd": "center",
    "u": "lung-male-landmarks/v1.0/assets/3d-vh-m-lung-landmark.glb",
    "n": [
      [
        "carina",
        "VH_M_lung_landmark_carina"
      ],
      [
        "larynx laryngeal cartilage",
        "VH_M_lung_landmark_larynx_laryngeal_cartilage"
      ],
      [
        "main bronchus",
        "VH_M_lung_landmark_main_bronchus"
      ],
      [
        "trachea tracheal cartilage",
        "VH_M_lung_landmark_trachea_tracheal_cartilage"
      ]
    ]
  },
  {
    "k": "main-bronchus-female/v1.1#primary",
    "sl": "main-bronchus-female",
    "ol": "main bronchus",
    "ont": "UBERON_0002182",
    "sx": "female",
    "sd": "center",
    "u": "main-bronchus-female-landmarks/v1.0/assets/3d-vh-f-main-bronchus-landmark.glb",
    "n": [
      [
        "carina of trachea",
        "VH_F_main_bronchus_landmark_carina"
      ],
      [
        "intrapulmonary bronchus",
        "VH_F_main_bronchus_landmark_lobar_tertiary_bronchus"
      ],
      [
        "left lung",
        "VH_F_main_bronchus_landmark_lung_L"
      ],
      [
        "right lung",
        "VH_F_main_bronchus_landmark_lung_R"
      ],
      [
        "tracheal cartilage",
        "VH_F_main_bronchus_landmark_trachea_tracheal_cartilage"
      ]
    ]
  },
  {
    "k": "main-bronchus-male/v1.1#primary",
    "sl": "main-bronchus-male",
    "ol": "main bronchus",
    "ont": "UBERON_0002182",
    "sx": "male",
    "sd": "center",
    "u": "main-bronchus-male-landmarks/v1.0/assets/3d-vh-m-main-bronchus-landmark.glb",
    "n": [
      [
        "carina of trachea",
        "VH_M_main_bronchus_landmark_carina"
      ],
      [
        "intrapulmonary bronchi",
        "VH_M_main_bronchus_landmark_lobar_tertiary_bronchus"
      ],
      [
        "left lung",
        "VH_M_main_bronchus_landmark_lung_L"
      ],
      [
        "right lung",
        "VH_M_main_bronchus_landmark_lung_R"
      ],
      [
        "tracheal cartilage",
        "VH_M_main_bronchus_landmark_trachea_tracheal_cartilage"
      ]
    ]
  },
  {
    "k": "mammary-gland-female-left/v1.1#primary",
    "sl": "mammary-gland-female-left",
    "ol": "Left mammary gland",
    "ont": "http://purl.org/sig/ont/fma/fma57991",
    "sx": "female",
    "sd": "left",
    "u": "mammary-gland-female-left-landmarks/v1.0/assets/3d-vh-f-mammary-gland-l-landmark.glb",
    "n": [
      [
        "axillary tail of breast",
        "VH_F_mammary_gland_L_landmark_axillary_tail_of_breast"
      ],
      [
        "clavicle",
        "VH_F_mammary_gland_L_landmark_clavicle"
      ],
      [
        "costal cartilage",
        "VH_F_mammary_gland_L_landmark_costal_cartilage"
      ],
      [
        "humerus",
        "VH_F_mammary_gland_L_landmark_humerus"
      ],
      [
        "lower inner quadrant of breast",
        "VH_F_mammary_gland_L_landmark_lower_inner_quadrant_of_breast"
      ],
      [
        "lower outer quadrant of breast",
        "VH_F_mammary_gland_L_landmark_lower_outer_quadrant_of_breast"
      ],
      [
        "manubrium",
        "VH_F_mammary_gland_L_landmark_manubrium"
      ],
      [
        "pectoralis major",
        "VH_F_mammary_gland_L_landmark_pectoralis_major"
      ],
      [
        "pectoralis minor",
        "VH_F_mammary_gland_L_landmark_pectoralis_minor"
      ],
      [
        "ribs",
        "VH_F_mammary_gland_L_landmark_ribs"
      ],
      [
        "scapula",
        "VH_F_mammary_gland_L_landmark_scapula"
      ],
      [
        "sternum",
        "VH_F_mammary_gland_L_landmark_sternum"
      ],
      [
        "upper inner quadrant of breast",
        "VH_F_mammary_gland_L_landmark_upper_inner_quadrant_of_breast"
      ],
      [
        "upper outer quadrant of breast",
        "VH_F_mammary_gland_L_landmark_upper_outer_quadrant_of_breast"
      ],
      [
        "xiphoid process",
        "VH_F_mammary_gland_L_landmark_xiphoid_process"
      ]
    ]
  },
  {
    "k": "mammary-gland-female-right/v1.1#primary",
    "sl": "mammary-gland-female-right",
    "ol": "Right mammary gland",
    "ont": "http://purl.org/sig/ont/fma/fma57987",
    "sx": "female",
    "sd": "right",
    "u": "mammary-gland-female-right-landmarks/v1.0/assets/3d-vh-f-mammary-gland-r-landmark.glb",
    "n": [
      [
        "axillary tail of breast",
        "VH_F_mammary_gland_R_landmark_axillary_tail_of_breast"
      ],
      [
        "clavicle",
        "VH_F_mammary_gland_R_landmark_clavicle"
      ],
      [
        "costal cartilage",
        "VH_F_mammary_gland_R_landmark_costal_cartilage"
      ],
      [
        "humerus",
        "VH_F_mammary_gland_R_landmark_humerus"
      ],
      [
        "lower inner quadrant of breast",
        "VH_F_mammary_gland_R_landmark_lower_inner_quadrant_of_breast"
      ],
      [
        "lower outer quadrant of breast",
        "VH_F_mammary_gland_R_landmark_lower_outer_quadrant_of_breast"
      ],
      [
        "manubrium",
        "VH_F_mammary_gland_R_landmark_manubrium"
      ],
      [
        "pectoralis major",
        "VH_F_mammary_gland_R_landmark_pectoralis_major"
      ],
      [
        "pectoralis minor",
        "VH_F_mammary_gland_R_landmark_pectoralis_minor"
      ],
      [
        "ribs",
        "VH_F_mammary_gland_R_landmark_ribs"
      ],
      [
        "scapula",
        "VH_F_mammary_gland_R_landmark_scapula"
      ],
      [
        "sternum",
        "VH_F_mammary_gland_R_landmark_sternum"
      ],
      [
        "upper inner quadrant of breast",
        "VH_F_mammary_gland_R_landmark_upper_inner_quadrant_of_breast"
      ],
      [
        "upper outer quadrant of breast",
        "VH_F_mammary_gland_R_landmark_upper_outer_quadrant_of_breast"
      ],
      [
        "xiphoid process",
        "VH_F_mammary_gland_R_landmark_xiphoid_process"
      ]
    ]
  },
  {
    "k": "mouth-female/v1.0#primary",
    "sl": "mouth-female",
    "ol": "mouth",
    "ont": "UBERON_0000165",
    "sx": "female",
    "sd": "center",
    "u": "mouth-female-landmarks/v1.0/assets/3d-vh-f-mouth-landmarks.glb",
    "n": [
      [
        "genioglossus",
        "VH_F_mouth_landmark_genioglossus"
      ],
      [
        "hyoglossus",
        "VH_F_mouth_landmark_hyoglossus"
      ],
      [
        "levator veli palatini",
        "VH_F_mouth_landmark_levator_veli_palatini"
      ],
      [
        "mandible",
        "VH_F_mouth_landmark_mandible"
      ],
      [
        "maxillary",
        "VH_F_mouth_landmark_maxillary"
      ],
      [
        "musculus uvulae",
        "VH_F_mouth_landmark_musculus_uvulae"
      ],
      [
        "palatine",
        "VH_F_mouth_landmark_palatine"
      ],
      [
        "palatine tonsils",
        "VH_F_mouth_landmark_palatine_tonsil"
      ],
      [
        "palatoglossus",
        "VH_F_mouth_landmark_palatoglossus"
      ],
      [
        "palatopharyngeus",
        "VH_F_mouth_landmark_palatopharyngeus"
      ],
      [
        "sphenoid",
        "VH_F_mouth_landmark_sphenoid"
      ],
      [
        "styloglossus",
        "VH_F_mouth_landmark_styloglossus"
      ],
      [
        "tensor veli palatini",
        "VH_F_mouth_landmark_tensor_veli_palatini"
      ]
    ]
  },
  {
    "k": "mouth-male/v1.0#primary",
    "sl": "mouth-male",
    "ol": "mouth",
    "ont": "UBERON_0000165",
    "sx": "male",
    "sd": "center",
    "u": "mouth-male-landmarks/v1.0/assets/3d-vh-m-mouth-landmarks.glb",
    "n": [
      [
        "genioglossus",
        "VH_M_mouth_landmark_genioglossus"
      ],
      [
        "hyoglossus",
        "VH_M_mouth_landmark_hyoglossus"
      ],
      [
        "levator veli palatini",
        "VH_M_mouth_landmark_levator_veli_palatini"
      ],
      [
        "mandible",
        "VH_M_mouth_landmark_mandible"
      ],
      [
        "maxillary",
        "VH_M_mouth_landmark_maxillary"
      ],
      [
        "musculus uvulae",
        "VH_M_mouth_landmark_musculus_uvulae"
      ],
      [
        "palatine",
        "VH_M_mouth_landmark_palatine"
      ],
      [
        "palatine tonsils",
        "VH_M_mouth_landmark_palatine_tonsils"
      ],
      [
        "palatoglossus",
        "VH_M_mouth_landmark_palatoglossus"
      ],
      [
        "palatopharyngeus",
        "VH_M_mouth_landmark_palatopharyngeus"
      ],
      [
        "sphenoid",
        "VH_M_mouth_landmark_sphenoid"
      ],
      [
        "styloglossus",
        "VH_M_mouth_landmark_styloglossus"
      ],
      [
        "tensor veli palatini",
        "VH_M_mouth_landmark_tensor_veli_palatini"
      ]
    ]
  },
  {
    "k": "ovary-female-left/v1.3#primary",
    "sl": "ovary-female-left",
    "ol": "Left ovary",
    "ont": "UBERON_0002119",
    "sx": "female",
    "sd": "left",
    "u": "ovary-female-left-landmarks/v1.0/assets/3d-vh-f-ovary-l-landmark.glb",
    "n": [
      [
        "left fallopian tube",
        "VH_F_ovary_L_landmark_fallopian_tube"
      ],
      [
        "left ligaments of uterus and ovaries",
        "VH_F_ovary_L_landmark_ligaments_of_uterus_and_ovaries"
      ],
      [
        "uterus",
        "VH_F_ovary_L_landmark_uterus"
      ]
    ]
  },
  {
    "k": "ovary-female-right/v1.3#primary",
    "sl": "ovary-female-right",
    "ol": "Right ovary",
    "ont": "UBERON_0002118",
    "sx": "female",
    "sd": "right",
    "u": "ovary-female-right-landmarks/v1.0/assets/3d-vh-f-ovary-r-landmark.glb",
    "n": [
      [
        "Right fallopian tube",
        "VH_F_ovary_R_landmark_fallopian_tube"
      ],
      [
        "Right ligaments of uterus and ovaries",
        "VH_F_ovary_R_landmark_ligaments_of_uterus_and_ovaries"
      ],
      [
        "uterus",
        "VH_F_ovary_R_landmark_uterus"
      ]
    ]
  },
  {
    "k": "palatine-tonsil-female-left/v1.2#primary",
    "sl": "palatine-tonsil-female-left",
    "ol": "Left palatine tonsil",
    "ont": "http://purl.org/sig/ont/fma/fma54974",
    "sx": "female",
    "sd": "left",
    "u": "palatine-tonsil-female-left-landmarks/v1.0/assets/3d-vh-f-palatine-tonsil-l-landmark.glb",
    "n": [
      [
        "musculus uvulae",
        "VH_F_palatine_tonsil_L_landmark_musculus_uvulae"
      ],
      [
        "palatoglossus muscle left",
        "VH_F_palatine_tonsil_L_landmark_palatoglossus_muscle_L"
      ],
      [
        "palatopharyngeus muscle",
        "VH_F_palatine_tonsil_L_landmark_palatopharyngeus_muscle"
      ]
    ]
  },
  {
    "k": "palatine-tonsil-female-right/v1.2#primary",
    "sl": "palatine-tonsil-female-right",
    "ol": "Right palatine tonsil",
    "ont": "http://purl.org/sig/ont/fma/fma54973",
    "sx": "female",
    "sd": "right",
    "u": "palatine-tonsil-female-right-landmarks/v1.0/assets/3d-vh-f-palatine-tonsil-r-landmark.glb",
    "n": [
      [
        "musculus uvulae",
        "VH_F_palatine_tonsil_R_landmark_musculus_uvulae"
      ],
      [
        "palatoglossus muscle right",
        "VH_F_palatine_tonsil_R_landmark_palatoglossus_muscle_R"
      ],
      [
        "palatoglossus muscle right",
        "VH_F_palatine_tonsil_R_landmark_palatopharyngeus_muscle"
      ]
    ]
  },
  {
    "k": "palatine-tonsil-male-left/v1.2#primary",
    "sl": "palatine-tonsil-male-left",
    "ol": "Left palatine tonsil",
    "ont": "http://purl.org/sig/ont/fma/fma54974",
    "sx": "male",
    "sd": "left",
    "u": "palatine-tonsil-male-left-landmarks/v1.0/assets/3d-vh-m-palatine-tonsil-l-landmark.glb",
    "n": [
      [
        "left musculus uvulae",
        "VH_M_palatine_tonsil_L_landmark_musculus_uvulae"
      ],
      [
        "left palatoglossus muscle left",
        "VH_M_palatine_tonsil_L_landmark_palatoglossus_muscle_L"
      ],
      [
        "left palatopharyngeus muscle",
        "VH_M_palatine_tonsil_L_landmark_palatopharyngeus_muscle"
      ]
    ]
  },
  {
    "k": "palatine-tonsil-male-right/v1.2#primary",
    "sl": "palatine-tonsil-male-right",
    "ol": "Right palatine tonsil",
    "ont": "http://purl.org/sig/ont/fma/fma54973",
    "sx": "male",
    "sd": "right",
    "u": "palatine-tonsil-male-right-landmarks/v1.0/assets/3d-vh-m-palatine-tonsil-r-landmark.glb",
    "n": [
      [
        "right musculus uvulae",
        "VH_M_palatine_tonsil_R_landmark_musculus_uvulae"
      ],
      [
        "right palatoglossus muscle right",
        "VH_M_palatine_tonsil_R_landmark_palatoglossus_muscle_R"
      ],
      [
        "right palatopharyngeus muscle",
        "VH_M_palatine_tonsil_R_landmark_palatopharyngeus_muscle"
      ]
    ]
  },
  {
    "k": "pancreas-female/v1.3#primary",
    "sl": "pancreas-female",
    "ol": "pancreas",
    "ont": "UBERON_0001264",
    "sx": "female",
    "sd": "center",
    "u": "pancreas-female-landmarks/v1.0/assets/3d-vh-f-pancreas-landmark.glb",
    "n": [
      [
        "biliary tree",
        "VH_F_pancreas_landmark_biliary_tree"
      ],
      [
        "duodenum",
        "VH_F_pancreas_landmark_duodenum"
      ]
    ]
  },
  {
    "k": "pancreas-male/v1.3#primary",
    "sl": "pancreas-male",
    "ol": "pancreas",
    "ont": "UBERON_0001264",
    "sx": "male",
    "sd": "center",
    "u": "pancreas-male-landmarks/v1.0/assets/VH_M_Pancreas_Landmarks.glb",
    "n": [
      [
        "biliary tree",
        "VH_M_pancreas_landmark_biliary_tree"
      ],
      [
        "duodenum",
        "VH_M_pancreas_landmark_duodenum"
      ]
    ]
  },
  {
    "k": "placenta-full-term-female/v1.1#primary",
    "sl": "placenta-full-term-female",
    "ol": "placenta full term",
    "ont": "UBERON_0001987",
    "sx": "female",
    "sd": "center",
    "u": "placenta-full-term-female-landmarks/v1.0/assets/3d-vh-f-placenta-landmark.glb",
    "n": [
      [
        "basal plate",
        "VH_F_placenta_landmark_basal_plate"
      ],
      [
        "placenta vessels",
        "VH_F_placenta_landmark_placenta_vessels"
      ]
    ]
  },
  {
    "k": "small-intestine-female/v1.2#primary",
    "sl": "small-intestine-female",
    "ol": "small intestine",
    "ont": "UBERON_0002108",
    "sx": "female",
    "sd": "center",
    "u": "small-intestine-female-landmarks/v1.0/assets/3d-vh-f-small-intestine-landmark.glb",
    "n": [
      [
        "10 cm markers",
        "VH_F__small_intestine_disc_at_010_cm"
      ],
      [
        "5 cm markers",
        "VH_F_small_intestine_disc_at_005_cm"
      ],
      [
        "15 cm markers",
        "VH_F_small_intestine_disc_at_015_cm"
      ],
      [
        "20 cm markers",
        "VH_F_small_intestine_disc_at_020_cm"
      ],
      [
        "25 cm markers",
        "VH_F_small_intestine_disc_at_025_cm"
      ],
      [
        "30 cm markers",
        "VH_F_small_intestine_disc_at_030_cm"
      ],
      [
        "35 cm markers",
        "VH_F_small_intestine_disc_at_035_cm"
      ],
      [
        "40 cm markers",
        "VH_F_small_intestine_disc_at_040_cm"
      ],
      [
        "45 cm markers",
        "VH_F_small_intestine_disc_at_045_cm"
      ],
      [
        "50 cm markers",
        "VH_F_small_intestine_disc_at_050_cm"
      ],
      [
        "55 cm markers",
        "VH_F_small_intestine_disc_at_055_cm"
      ],
      [
        "60 cm markers",
        "VH_F_small_intestine_disc_at_060_cm"
      ],
      [
        "65 cm markers",
        "VH_F_small_intestine_disc_at_065_cm"
      ],
      [
        "70 cm markers",
        "VH_F_small_intestine_disc_at_070_cm"
      ],
      [
        "75 cm markers",
        "VH_F_small_intestine_disc_at_075_cm"
      ],
      [
        "80 cm markers",
        "VH_F_small_intestine_disc_at_080_cm"
      ],
      [
        "85 cm markers",
        "VH_F_small_intestine_disc_at_085_cm"
      ],
      [
        "90 cm markers",
        "VH_F_small_intestine_disc_at_090_cm"
      ],
      [
        "95 cm markers",
        "VH_F_small_intestine_disc_at_095_cm"
      ],
      [
        "100 cm markers",
        "VH_F_small_intestine_disc_at_100_cm"
      ],
      [
        "105 cm markers",
        "VH_F_small_intestine_disc_at_105_cm"
      ],
      [
        "110 cm markers",
        "VH_F_small_intestine_disc_at_110_cm"
      ],
      [
        "115 cm markers",
        "VH_F_small_intestine_disc_at_115_cm"
      ],
      [
        "120 cm markers",
        "VH_F_small_intestine_disc_at_120_cm"
      ],
      [
        "125 cm markers",
        "VH_F_small_intestine_disc_at_125_cm"
      ],
      [
        "130 cm markers",
        "VH_F_small_intestine_disc_at_130_cm"
      ],
      [
        "135 cm markers",
        "VH_F_small_intestine_disc_at_135_cm"
      ],
      [
        "140 cm markers",
        "VH_F_small_intestine_disc_at_140_cm"
      ],
      [
        "145 cm markers",
        "VH_F_small_intestine_disc_at_145_cm"
      ],
      [
        "150 cm markers",
        "VH_F_small_intestine_disc_at_150_cm"
      ],
      [
        "155 cm markers",
        "VH_F_small_intestine_disc_at_155_cm"
      ],
      [
        "160 cm markers",
        "VH_F_small_intestine_disc_at_160_cm"
      ],
      [
        "165 cm markers",
        "VH_F_small_intestine_disc_at_165_cm"
      ],
      [
        "170 cm markers",
        "VH_F_small_intestine_disc_at_170_cm"
      ],
      [
        "175 cm markers",
        "VH_F_small_intestine_disc_at_175_cm"
      ],
      [
        "180 cm markers",
        "VH_F_small_intestine_disc_at_180_cm"
      ],
      [
        "185 cm markers",
        "VH_F_small_intestine_disc_at_185_cm"
      ],
      [
        "biliary tree",
        "VH_F_small_intestine_landmark_biliary_tree"
      ],
      [
        "cm line markers",
        "VH_F_small_intestine_landmark_cm_markers"
      ],
      [
        "jejunoileal junction",
        "VH_F_small_intestine_landmark_jejunoileal_junction"
      ],
      [
        "five cm disc markers",
        "VH_F_small_intestine_landmark_measurement_discs"
      ]
    ]
  },
  {
    "k": "small-intestine-male/v1.2#primary",
    "sl": "small-intestine-male",
    "ol": "small intestine",
    "ont": "UBERON_0002108",
    "sx": "male",
    "sd": "center",
    "u": "small-intestine-male-landmarks/v1.0/assets/VH_M_Small_Intestine_Landmarks.glb",
    "n": [
      [
        "5 cm marker",
        "VH_M_small_intestine_disc_at_005_cm"
      ],
      [
        "10 cm marker",
        "VH_M_small_intestine_disc_at_010_cm"
      ],
      [
        "15 cm marker",
        "VH_M_small_intestine_disc_at_015_cm"
      ],
      [
        "20 cm marker",
        "VH_M_small_intestine_disc_at_020_cm"
      ],
      [
        "25 cm marker",
        "VH_M_small_intestine_disc_at_025_cm"
      ],
      [
        "30 cm marker",
        "VH_M_small_intestine_disc_at_030_cm"
      ],
      [
        "35 cm marker",
        "VH_M_small_intestine_disc_at_035_cm"
      ],
      [
        "40 cm marker",
        "VH_M_small_intestine_disc_at_040_cm"
      ],
      [
        "45 cm marker",
        "VH_M_small_intestine_disc_at_045_cm"
      ],
      [
        "50 cm marker",
        "VH_M_small_intestine_disc_at_050_cm"
      ],
      [
        "55 cm marker",
        "VH_M_small_intestine_disc_at_055_cm"
      ],
      [
        "60 cm marker",
        "VH_M_small_intestine_disc_at_060_cm"
      ],
      [
        "65 cm marker",
        "VH_M_small_intestine_disc_at_065_cm"
      ],
      [
        "70 cm marker",
        "VH_M_small_intestine_disc_at_070_cm"
      ],
      [
        "75 cm marker",
        "VH_M_small_intestine_disc_at_075_cm"
      ],
      [
        "80 cm marker",
        "VH_M_small_intestine_disc_at_080_cm"
      ],
      [
        "85 cm marker",
        "VH_M_small_intestine_disc_at_085_cm"
      ],
      [
        "90 cm marker",
        "VH_M_small_intestine_disc_at_090_cm"
      ],
      [
        "95 cm marker",
        "VH_M_small_intestine_disc_at_095_cm"
      ],
      [
        "100 cm marker",
        "VH_M_small_intestine_disc_at_100_cm"
      ],
      [
        "105 cm marker",
        "VH_M_small_intestine_disc_at_105_cm"
      ],
      [
        "110 cm marker",
        "VH_M_small_intestine_disc_at_110_cm"
      ],
      [
        "115 cm marker",
        "VH_M_small_intestine_disc_at_115_cm"
      ],
      [
        "120 cm marker",
        "VH_M_small_intestine_disc_at_120_cm"
      ],
      [
        "125 cm marker",
        "VH_M_small_intestine_disc_at_125_cm"
      ],
      [
        "130 cm marker",
        "VH_M_small_intestine_disc_at_130_cm"
      ],
      [
        "135 cm marker",
        "VH_M_small_intestine_disc_at_135_cm"
      ],
      [
        "140 cm marker",
        "VH_M_small_intestine_disc_at_140_cm"
      ],
      [
        "145 cm marker",
        "VH_M_small_intestine_disc_at_145_cm"
      ],
      [
        "150 cm marker",
        "VH_M_small_intestine_disc_at_150_cm"
      ],
      [
        "155 cm marker",
        "VH_M_small_intestine_disc_at_155_cm"
      ],
      [
        "160 cm marker",
        "VH_M_small_intestine_disc_at_160_cm"
      ],
      [
        "165 cm marker",
        "VH_M_small_intestine_disc_at_165_cm"
      ],
      [
        "170 cm marker",
        "VH_M_small_intestine_disc_at_170_cm"
      ],
      [
        "175 cm marker",
        "VH_M_small_intestine_disc_at_175_cm"
      ],
      [
        "180 cm marker",
        "VH_M_small_intestine_disc_at_180_cm"
      ],
      [
        "185 cm marker",
        "VH_M_small_intestine_disc_at_185_cm"
      ],
      [
        "190 cm marker",
        "VH_M_small_intestine_disc_at_190_cm"
      ],
      [
        "195 cm marker",
        "VH_M_small_intestine_disc_at_195_cm"
      ],
      [
        "200 cm marker",
        "VH_M_small_intestine_disc_at_200_cm"
      ],
      [
        "205 cm marker",
        "VH_M_small_intestine_disc_at_205_cm"
      ],
      [
        "210 cm marker",
        "VH_M_small_intestine_disc_at_210_cm"
      ],
      [
        "215 cm marker",
        "VH_M_small_intestine_disc_at_215_cm"
      ],
      [
        "220 cm marker",
        "VH_M_small_intestine_disc_at_220_cm"
      ],
      [
        "225 cm marker",
        "VH_M_small_intestine_disc_at_225_cm"
      ],
      [
        "230 cm marker",
        "VH_M_small_intestine_disc_at_230_cm"
      ],
      [
        "235 cm marker",
        "VH_M_small_intestine_disc_at_235_cm"
      ],
      [
        "240 cm marker",
        "VH_M_small_intestine_disc_at_240_cm"
      ],
      [
        "245 cm marker",
        "VH_M_small_intestine_disc_at_245_cm"
      ],
      [
        "250 cm marker",
        "VH_M_small_intestine_disc_at_250_cm"
      ],
      [
        "255 cm marker",
        "VH_M_small_intestine_disc_at_255_cm"
      ],
      [
        "260 cm marker",
        "VH_M_small_intestine_disc_at_260_cm"
      ],
      [
        "265 cm marker",
        "VH_M_small_intestine_disc_at_265_cm"
      ],
      [
        "270 cm marker",
        "VH_M_small_intestine_disc_at_270_cm"
      ],
      [
        "275 cm marker",
        "VH_M_small_intestine_disc_at_275_cm"
      ],
      [
        "280 cm marker",
        "VH_M_small_intestine_disc_at_280_cm"
      ],
      [
        "285 cm marker",
        "VH_M_small_intestine_disc_at_285_cm"
      ],
      [
        "biliary tree",
        "VH_M_small_intestine_landmark_biliary_tree"
      ],
      [
        "cm line markers",
        "VH_M_small_intestine_landmark_cm_markers"
      ],
      [
        "jejunoileal junction",
        "VH_M_small_intestine_landmark_jejunoileal_junction"
      ],
      [
        "five cm disc markers",
        "VH_M_small_intestine_landmark_measurement_discs"
      ]
    ]
  },
  {
    "k": "spinal-cord-female/v1.1#primary",
    "sl": "spinal-cord-female",
    "ol": "spinal cord",
    "ont": "UBERON_0002240",
    "sx": "female",
    "sd": "center",
    "u": "spinal-cord-female-landmarks/v1.0/assets/3d-vh-f-spinal-cord-landmark.glb",
    "n": [
      [
        "cervical vertebrae",
        "VH_F_spinal_cord_landmark_cervical_vertebrae"
      ],
      [
        "lumbar vertebrae",
        "VH_F_spinal_cord_landmark_lumbar_vertebrae"
      ],
      [
        "thoracic vertebrae",
        "VH_F_spinal_cord_landmark_thoracic_vertebrae"
      ]
    ]
  },
  {
    "k": "spinal-cord-male/v1.1#primary",
    "sl": "spinal-cord-male",
    "ol": "spinal cord",
    "ont": "UBERON_0002240",
    "sx": "male",
    "sd": "center",
    "u": "spinal-cord-male-landmarks/v1.0/assets/VH_M_Spinal_Cord_Landmarks.glb",
    "n": [
      [
        "cervical vertebrae",
        "VH_M_spinal_cord_landmark_cervical_vertebrae"
      ],
      [
        "lumbar vertebrae",
        "VH_M_spinal_cord_landmark_lumbar_vertebrae"
      ],
      [
        "thoracic vertebrae",
        "VH_M_spinal_cord_landmark_thoracic_vertebrae"
      ]
    ]
  },
  {
    "k": "spleen-female/v1.3#primary",
    "sl": "spleen-female",
    "ol": "spleen",
    "ont": "UBERON_0002106",
    "sx": "female",
    "sd": "center",
    "u": "spleen-female-landmarks/v1.0/assets/3d-vh-f-spleen-landmark.glb",
    "n": [
      [
        "splenic artery",
        "VH_F_spleen_landmark_splenic_artery"
      ],
      [
        "splenic vein",
        "VH_F_spleen_landmark_splenic_vein"
      ]
    ]
  },
  {
    "k": "spleen-male/v1.3#primary",
    "sl": "spleen-male",
    "ol": "spleen",
    "ont": "UBERON_0002106",
    "sx": "male",
    "sd": "center",
    "u": "spleen-male-landmarks/v1.0/assets/VH_M_Spleen_Landmarks.glb",
    "n": [
      [
        "splenic artery",
        "VH_M_spleen_landmark_splenic_artery"
      ],
      [
        "splenic vein",
        "VH_M_spleen_landmark_splenic_vein"
      ]
    ]
  },
  {
    "k": "trachea-female/v1.1#primary",
    "sl": "trachea-female",
    "ol": "trachea",
    "ont": "UBERON_0003126",
    "sx": "female",
    "sd": "center",
    "u": "trachea-female-landmarks/v1.0/assets/3d-vh-f-trachea-landmark.glb",
    "n": [
      [
        "larynxgeal cartilage",
        "VH_F_trachea_landmark_larynx_laryngeal_cartilage"
      ],
      [
        "main bronchus",
        "VH_F_trachea_landmark_main_bronchus"
      ]
    ]
  },
  {
    "k": "trachea-male/v1.1#primary",
    "sl": "trachea-male",
    "ol": "trachea",
    "ont": "UBERON_0003126",
    "sx": "male",
    "sd": "center",
    "u": "trachea-male-landmarks/v1.0/assets/3d-vh-m-trachea-landmark.glb",
    "n": [
      [
        "larynxgeal cartilage",
        "VH_M_trachea_landmark_larynx_laryngeal_cartilage"
      ],
      [
        "main bronchus",
        "VH_M_trachea_landmark_main_bronchus"
      ],
      [
        "muscles of larynx",
        "VH_M_trachea_landmark_muscles_of_larynx"
      ]
    ]
  },
  {
    "k": "ureter-female-left/v1.2#primary",
    "sl": "ureter-female-left",
    "ol": "Left ureter",
    "ont": "UBERON_0001223",
    "sx": "female",
    "sd": "left",
    "u": "ureter-female-left-landmarks/v1.0/assets/3d-vh-f-ureter-l-landmark.glb",
    "n": [
      [
        "kidney calyx",
        "VH_F_ureter_L_landmark_kidney_calyx"
      ],
      [
        "renal pelvis",
        "VH_F_ureter_L_landmark_renal_pelvis"
      ],
      [
        "urinary bladder",
        "VH_F_ureter_L_landmark_urinary_bladder"
      ]
    ]
  },
  {
    "k": "ureter-female-right/v1.2#primary",
    "sl": "ureter-female-right",
    "ol": "Right ureter",
    "ont": "UBERON_0001222",
    "sx": "female",
    "sd": "right",
    "u": "ureter-female-right-landmarks/v1.0/assets/3d-vh-f-ureter-r-landmark.glb",
    "n": [
      [
        "kidney calyx",
        "VH_F_ureter_R_landmark_kidney_calyx"
      ],
      [
        "renal pelvis",
        "VH_F_ureter_R_landmark_renal_pelvis"
      ],
      [
        "urinary bladder",
        "VH_F_ureter_R_landmark_urinary_bladder"
      ]
    ]
  },
  {
    "k": "ureter-male-left/v1.2#primary",
    "sl": "ureter-male-left",
    "ol": "Left ureter",
    "ont": "UBERON_0001223",
    "sx": "male",
    "sd": "left",
    "u": "ureter-male-both-landmarks/v1.0/assets/VH_M_Ureter_Landmarks.glb",
    "n": [
      [
        "urinary bladder",
        "VH_M_ureter_L_landmark_urinary_bladder"
      ]
    ]
  },
  {
    "k": "ureter-male-right/v1.2#primary",
    "sl": "ureter-male-right",
    "ol": "Right ureter",
    "ont": "UBERON_0001222",
    "sx": "male",
    "sd": "right",
    "u": "ureter-male-both-landmarks/v1.0/assets/VH_M_Ureter_Landmarks.glb",
    "n": [
      [
        "urinary bladder",
        "VH_M_ureter_R_landmark_urinary_bladder"
      ]
    ]
  },
  {
    "k": "urinary-bladder-female/v1.2#primary",
    "sl": "urinary-bladder-female",
    "ol": "urinary bladder",
    "ont": "UBERON_0001255",
    "sx": "female",
    "sd": "center",
    "u": "urinary-bladder-female-landmarks/v1.0/assets/3d-vh-f-urinary-bladder-landmark.glb",
    "n": [
      [
        "left ureter",
        "VH_F_urinary_bladder_landmark_left_ureter"
      ],
      [
        "right ureter",
        "VH_F_urinary_bladder_landmark_right_ureter"
      ]
    ]
  },
  {
    "k": "urinary-bladder-male/v1.2#primary",
    "sl": "urinary-bladder-male",
    "ol": "urinary bladder",
    "ont": "UBERON_0001255",
    "sx": "male",
    "sd": "center",
    "u": "urinary-bladder-male-landmarks/v1.0/assets/VH_M_Urinary_Bladder_Landmarks.glb",
    "n": [
      [
        "left ureter",
        "VH_M_urinary_bladder_landmark_ureter_L"
      ],
      [
        "right ureter",
        "VH_M_urinary_bladder_landmark_ureter_R"
      ],
      [
        "urethra",
        "VH_M_urinary_bladder_landmark_urethra"
      ]
    ]
  },
  {
    "k": "uterus-female/v1.2#primary",
    "sl": "uterus-female",
    "ol": "uterus",
    "ont": "UBERON_0000995",
    "sx": "female",
    "sd": "center",
    "u": "uterus-female-landmarks/v1.0/assets/3d-vh-f-uterus-landmark.glb",
    "n": [
      [
        "left fallopian tube",
        "VH_F_uterus_landmark_fallopian_tube_L"
      ],
      [
        "right fallopian tube",
        "VH_F_uterus_landmark_fallopian_tube_R"
      ],
      [
        "left uterine artery",
        "VH_F_uterus_landmark_left_uterine_artery"
      ],
      [
        "left uterine vein",
        "VH_F_uterus_landmark_left_uterine_vein"
      ],
      [
        "ligaments of uterus and ovary",
        "VH_F_uterus_landmark_ligaments_of_uterus_and_ovaries"
      ],
      [
        "right uterine artery",
        "VH_F_uterus_landmark_right_uterine_artery"
      ],
      [
        "right uterine vein",
        "VH_F_uterus_landmark_right_uterine_vein"
      ],
      [
        "vagina",
        "VH_F_uterus_landmark_vagina"
      ]
    ]
  }
];
