/**
 * Offline Bilingual / Clinical Anatomy Textbook Extraction & GLB Audit Script
 *
 * Parses:
 *   - Book 1 (Atlas & Regional Inventory): d:/AOA/Netter's Atlas of Human Anatomy 7ed.pdf
 *   - Book 2 (Descriptions, Supply & Clinical): d:/AOA/Gray's Anatomy for Students 4th Edition NO Watermark.pdf
 *
 * Audits all `.glb` scene graphs in `public/models/` against Book 1's inventory and outputs:
 *   - src/data/textbookKnowledge.json
 *
 * Usage:
 *   node scripts/extractAnatomyPdfs.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const NETTER_PDF_PATH = path.join(ROOT, "Netter's Atlas of Human Anatomy 7ed.pdf");
const GRAYS_PDF_PATH = path.join(ROOT, "Gray's Anatomy for Students 4th Edition NO Watermark.pdf");
const OUTPUT_JSON_PATH = path.join(ROOT, 'src', 'data', 'textbookKnowledge.json');

const pdfjsLib = await import(
  pathToFileURL(path.join(ROOT, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
);

// ---------------------------------------------------------------------------
// Text Normalization & Canonical Key Helpers
// ---------------------------------------------------------------------------

function dehyphenate(text) {
  return text
    .replace(/([a-z])-\s+([a-z])/gi, '$1$2')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(raw) {
  let s = String(raw || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\b(cut|left|right|bilateral|anterior view|posterior view|lateral view|medial view|schema)\b/gi, ' ')
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Normalize "X muscle" -> "X" for muscles so "Trapezius muscle" and "Trapezius" share a key
  if (/\bmuscle$/i.test(s) && s.split(' ').length <= 4) {
    s = s.replace(/\s+muscle$/i, '').trim();
  }
  return s;
}

function titleCase(str) {
  const minor = new Set(['of', 'and', 'the', 'in', 'to', 'for', 'on', 'with', 'or', 'at', 'by', 'et']);
  return String(str || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i > 0 && minor.has(lw)) return lw;
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(' ');
}

function truncateClean(text, maxLen = 480) {
  const s = dehyphenate(text || '');
  if (s.length <= maxLen) return s;
  const slice = s.slice(0, maxLen - 1);
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '));
  if (lastPeriod > maxLen * 0.45) {
    return slice.slice(0, lastPeriod + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLen - 3).trim()}...`;
}

function inferSystemFromText(name, plateTitle = '') {
  const n = String(name || '').toLowerCase();
  // Check exact structure name first so region keywords ("pelvis", "thorax", "head") never override organ system!
  const checkText = (txt) => {
    if (/\b(muscle|muscles|muscular|biceps|triceps|deltoid|pectoralis|trapezius|latissimus|gluteus|sartorius|quadriceps|hamstring|rectus|oblique|diaphragm|sphincter|flexor|extensor|abductor|adductor|pronator|supinator|rotator|sternocleidomastoid|masseter|temporalis|buccinator|platysma|iliopsoas|piriformis|gastrocnemius|soleus|tibialis|fibularis|peroneus|lumbrical|interosseous|tendon|aponeurosis|erector spinae|serratus|rhomboid|levator|supraspinatus|infraspinatus|teres|subscapularis|brachialis|coracobrachialis|gracilis|pectineus|popliteus|plantaris|scalene|omohyoid|sternohyoid|thyrohyoid|mylohyoid|digastric|auricularis)\b/.test(txt)) {
      return 'muscular';
    }
    if (/\b(heart|atrium|ventricle|valve|aorta|artery|arteries|vein|veins|vascular|vena cava|venous|sinus|trunk|carotid|jugular|subclavian|axillary|brachial|radial artery|ulnar artery|iliac|femoral artery|femoral vein|popliteal|tibial artery|coronary|pulmonary|celiac|mesenteric|renal artery|renal vein|hepatic portal|azygos|saphenous|pericardium|myocardium|endocardium|epicardium|chordae tendineae|papillary|septum|lymphatic|thoracic duct|cisterna chyli)\b/.test(txt)) {
      return 'cardiovascular';
    }
    if (/\b(nerve|nerves|nervous|plexus|ganglion|ganglia|brain|cerebrum|cerebral|cerebellum|brainstem|midbrain|pons|medulla|spinal cord|thalamus|hypothalamus|hippocampus|amygdala|corpus callosum|ventricle of brain|caudate|putamen|globus pallidus|basal nuclei|cortex|gyrus|sulcus|meninges|dura mater|arachnoid|pia mater|cranial nerve|vagus|phrenic|sciatic|median nerve|ulnar nerve|radial nerve|femoral nerve|obturator nerve|trigeminal|facial nerve|optic nerve|olfactory|oculomotor|trochlear|abducens|vestibulocochlear|glossopharyngeal|accessory nerve|hypoglossal|brachial plexus|cervical plexus|lumbosacral|sympathetic|parasympathetic|splanchnic|cauda equina|conus medullaris|tract|retina|cochlea)\b/.test(txt)) {
      return 'nervous';
    }
    if (/\b(lung|lungs|trachea|bronchus|bronchi|larynx|pharynx|pleura|mediastinum|esophagus|stomach|duodenum|jejunum|ileum|colon|cecum|appendix|rectum|anal canal|liver|gallbladder|bile duct|pancreas|spleen|kidney|kidneys|ureter|urinary bladder|bladder|urethra|adrenal|suprarenal|thyroid|parathyroid|pituitary|thymus|pineal|ovary|ovaries|uterus|uterine tube|fallopian|vagina|testis|testes|epididymis|ductus deferens|prostate|seminal|tongue|palate|tonsil|salivary|parotid|submandibular|sublingual|peritoneum|viscera|visceral|bowel|intestine|alveoli|nephron|hepat)\b/.test(txt)) {
      return 'visceral';
    }
    if (/\b(skin|integument|epidermis|dermis|subcutaneous|fascia|mammary|breast|areola|nipple|nail|hair follicle|sweat gland|sebaceous)\b/.test(txt)) {
      return 'integumentary';
    }
    if (/\b(bone|bones|skeletal|skull|cranium|mandible|maxilla|zygomatic|nasal bone|lacrimal|vomer|palatine|ethmoid|sphenoid|frontal|parietal|temporal bone|occipital|hyoid|vertebra|vertebrae|sacrum|coccyx|sternum|manubrium|xiphoid|rib|ribs|costal|clavicle|scapula|acromion|coracoid|humerus|radius|ulna|carpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx|phalanges|pelvis|ilium|ischium|pubis|femur|patella|tibia|fibula|tarsal|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|joint|ligament|cartilage|meniscus|symphysis|intervertebral disc|foramen|fossa|process|acetabulum|trochanter|condyle|epicondyle|malleolus)\b/.test(txt)) {
      return 'skeletal';
    }
    return null;
  };
  return checkText(n) || checkText(String(plateTitle || '').toLowerCase()) || 'visceral';
}

function splitSentencesSafe(text) {
  // Shield abbreviations (Fig., eFig., Figs., Table, No., e.g., i.e., vs., Dr.) before sentence split
  const shielded = String(text || '')
    .replace(/\b(Figs?|eFigs?|Plates?|e\.g|i\.e|vs|Dr|Prof|al|approx|No|p|pp|ch|Ch)\./g, '$1\u0001')
    .replace(/\.(\s*\d)/g, '\u0001$1');
  return shielded
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\u0001/g, '.').trim())
    .filter((s) => s.length >= 25);
}

function isBadHeadingOrLabel(str) {
  const s = (str || '').trim();
  if (!s || s.length < 3 || s.length > 90) return true;
  if (/^(page|plate|table|clinical table|muscle tables?|electronic bonus|fig\.?|efig\.?|see also|references?|index|chapter|contents|acknowledgments|preface|dedication|in the clinic|clinical cases|conceptual overview|Regional Anatomy|Surface Anatomy|Body Systems|Introduction)\b/i.test(s)) {
    return true;
  }
  if (/^\d+[\w.\-]*$/.test(s)) return true;
  if (/^[A-Z](\s+[A-Z])?$/.test(s)) return true;
  if (/\((?:cut|schematic|continued|cont'd|anterior|posterior|after .*)\)/i.test(s)) return true;
  if (/\b(A\.|B\.|C\.|D\.|E\.|eFig\.|Fig\.|www\.|\.com|©|Elsevier|Chapter \d+)\b/i.test(s)) return true;
  if (/^(from|to|with|and|or|of|in|by|the|a|an|is|are|was|for)\b/i.test(s)) return true;
  if (s.split(/\s+/).length > 7) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Knowledge Accumulator Store
// ---------------------------------------------------------------------------

const storeEntries = new Map();
const aliasToCanonical = new Map();

function getOrCreateEntry(canonicalRaw, seed = {}) {
  const key = normalizeKey(canonicalRaw);
  if (!key || key.length < 3) return null;

  const existingCanonical = aliasToCanonical.get(key) || key;
  let rec = storeEntries.get(existingCanonical);
  if (!rec) {
    rec = {
      key: existingCanonical,
      canonicalNameEn: titleCase(canonicalRaw.replace(/\([^)]*\)/g, '').trim()),
      latinName: seed.latinName || '',
      system: seed.system || inferSystemFromText(canonicalRaw, seed.region || ''),
      region: seed.region || '',
      muscleGroup: seed.muscleGroup || '',
      summaryEn: '',
      primaryFunctionEn: '',
      origin: '',
      insertion: '',
      action: '',
      relationsEn: '',
      arterialSupply: '',
      venousDrainage: '',
      innervation: '',
      clinicalNotesEn: '',
      netterPlates: [],
      grayRef: '',
      netterRef: '',
      sources: [],
    };
    storeEntries.set(existingCanonical, rec);
    aliasToCanonical.set(existingCanonical, existingCanonical);
  }

  // Register aliases
  const lowerClean = canonicalRaw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (lowerClean) aliasToCanonical.set(lowerClean, existingCanonical);
  if (rec.canonicalNameEn.toLowerCase().endsWith(' muscle')) {
    aliasToCanonical.set(rec.canonicalNameEn.toLowerCase().replace(/\s+muscle$/, '').trim(), existingCanonical);
  }

  if (seed.system && rec.system === 'visceral' && seed.system !== 'visceral') {
    rec.system = seed.system;
  }
  if (seed.region && !rec.region) rec.region = seed.region;
  if (seed.muscleGroup && !rec.muscleGroup) rec.muscleGroup = seed.muscleGroup;

  return rec;
}

function addSource(rec, src) {
  if (!rec.sources.includes(src)) rec.sources.push(src);
}

function addPlate(rec, plate) {
  if (plate && !rec.netterPlates.includes(plate) && rec.netterPlates.length < 10) {
    rec.netterPlates.push(plate);
  }
}

// ---------------------------------------------------------------------------
// Book 1 Parser: Netter's Atlas of Human Anatomy (7th Ed.)
// ---------------------------------------------------------------------------

async function resolveOutlineRanges(doc, chapterFilter) {
  const outline = (await doc.getOutline()) || [];
  const chapters = [];
  for (const item of outline) {
    if (!chapterFilter(item.title)) continue;
    let pageNum = null;
    try {
      const d = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
      if (Array.isArray(d)) pageNum = (await doc.getPageIndex(d[0])) + 1;
      if (pageNum === null && Array.isArray(item.items)) {
        for (const sub of item.items) {
          const sd = typeof sub.dest === 'string' ? await doc.getDestination(sub.dest) : sub.dest;
          if (Array.isArray(sd)) {
            pageNum = (await doc.getPageIndex(sd[0])) + 1;
            break;
          }
        }
      }
    } catch {}
    if (pageNum !== null) {
      chapters.push({ title: item.title.replace(/^\d+\s+/, '').trim(), startPage: pageNum, raw: item });
    }
  }
  chapters.sort((a, b) => a.startPage - b.startPage);
  for (let i = 0; i < chapters.length; i++) {
    chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].startPage - 1 : doc.numPages;
  }
  return chapters;
}

function groupItemsByLine(items, yTolerance = 3.2) {
  const filtered = items
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      h: Math.round(it.height || 0),
    }))
    .filter((it) => it.str && it.str.trim().length > 0);
  filtered.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const item of filtered) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - item.y) <= yTolerance) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((it) => it.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
    line.maxH = Math.max(...line.items.map((it) => it.h));
  }
  return lines;
}

async function parseNetter(filePath) {
  console.log('📖 [Book 1] Loading Netter\'s Atlas of Human Anatomy (7th Ed.)...');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const task = pdfjsLib.getDocument({ data, verbosity: 0 });
  const doc = await task.promise;

  const chapters = await resolveOutlineRanges(doc, (t) => /^[1-8]\s/.test(t));
  // Clamp last chapter end before References/Index
  const refOutline = await resolveOutlineRanges(doc, (t) => /^(References|Index)$/i.test(t));
  if (chapters.length > 0 && refOutline.length > 0) {
    const cutoff = Math.min(...refOutline.map((r) => r.startPage)) - 1;
    chapters[chapters.length - 1].endPage = Math.min(chapters[chapters.length - 1].endPage, cutoff);
  }

  let stats = { plates: 0, plateLabels: 0, muscleRows: 0, clinicalRows: 0 };
  const regionalInventory = {};

  function chapterAtPage(p) {
    for (const c of chapters) {
      if (p >= c.startPage && p <= c.endPage) return c.title;
    }
    return 'General Anatomy';
  }

  // Helper to reconstruct Netter Muscle Table pages (multi-column)
  function extractNetterMuscleTable(lines, region, pageNum) {
    const headerIdx = lines.findIndex(
      (l) => /\bMUSCLE\b/.test(l.text) && /\bINNERVATION\b/.test(l.text)
    );
    if (headerIdx < 0) return 0;

    // Identify column start boundaries from header items
    const hdrItems = lines.slice(Math.max(0, headerIdx - 2), headerIdx + 2).flatMap((l) => l.items);
    const findX = (re, fallback) => hdrItems.find((i) => re.test(i.str))?.x ?? fallback;
    const xCols = [
      { key: 'muscle', x: findX(/^MUSCLE$/i, 58) - 10 },
      { key: 'group', x: findX(/^GROUP$/i, 134) - 8 },
      { key: 'origin', x: findX(/^(PROXIMAL|\(ORIGIN\))$/i, 189) - 8 },
      { key: 'insertion', x: findX(/^(DISTAL|\(INSERTION\))$/i, 269) - 8 },
      { key: 'innervation', x: findX(/^INNERVATION$/i, 348) - 8 },
      { key: 'blood', x: findX(/^BLOOD/i, 417) - 8 },
      { key: 'actions', x: findX(/^MAIN/i, 501) - 8 },
    ].sort((a, b) => a.x - b.x);

    const colForX = (x) => {
      let chosen = xCols[0].key;
      for (const c of xCols) {
        if (x >= c.x) chosen = c.key;
      }
      return chosen;
    };

    const bodyLines = lines.slice(headerIdx + 1).filter(
      (l) => !/^Table \d+/i.test(l.text) && !/^Muscle Tables?$/i.test(l.text) && !/^\d+$/.test(l.text)
    );

    const rows = [];
    let current = null;
    for (const line of bodyLines) {
      const mItems = line.items.filter((it) => colForX(it.x) === 'muscle');
      const gItems = line.items.filter((it) => colForX(it.x) === 'group');
      // A new row starts when muscle column has unindented text (near col start ~58, not continuation indent +9) and either group/origin starts on same line
      const startsNewRow =
        mItems.length > 0 &&
        mItems[0].x <= xCols[0].x + 15 &&
        (gItems.length > 0 || !current || line.items.some((it) => colForX(it.x) === 'actions'));

      if (startsNewRow) {
        if (current) rows.push(current);
        current = { muscle: [], group: [], origin: [], insertion: [], innervation: [], blood: [], actions: [] };
      }
      if (!current) continue;
      for (const it of line.items) {
        current[colForX(it.x)].push(it.str);
      }
    }
    if (current) rows.push(current);

    let count = 0;
    for (const r of rows) {
      const mName = dehyphenate(r.muscle.join(' '));
      if (!mName || mName.length < 3 || /^MUSCLE\b/i.test(mName)) continue;
      const group = dehyphenate(r.group.join(' '));
      const origin = dehyphenate(r.origin.join(' '));
      const insertion = dehyphenate(r.insertion.join(' '));
      const innervation = dehyphenate(r.innervation.join(' '));
      const blood = dehyphenate(r.blood.join(' '));
      const actions = dehyphenate(r.actions.join(' '));
      if (!origin && !insertion && !innervation && !actions) continue;

      const canonicalName = /\bmuscle$/i.test(mName) ? mName : `${mName} Muscle`;
      const rec = getOrCreateEntry(canonicalName, { system: 'muscular', region, muscleGroup: group });
      if (!rec) continue;
      rec.canonicalNameEn = titleCase(mName);
      rec.region = region; // Muscle table region is authoritative
      if (group) rec.muscleGroup = group;
      if (origin) rec.origin = origin;
      if (insertion) rec.insertion = insertion;
      if (innervation) rec.innervation = innervation;
      if (blood) rec.arterialSupply = blood;
      if (actions) {
        rec.action = actions;
        if (!rec.primaryFunctionEn) rec.primaryFunctionEn = actions;
      }
      if (!rec.summaryEn) {
        rec.summaryEn = truncateClean(
          `${rec.canonicalNameEn} (${group || region} musculature). Action: ${actions || 'See functional summary'}. Innervated by ${innervation || 'regional motor nerves'} and vascularized by ${blood || 'regional arteries'}.`,
          420
        );
      }
      rec.netterRef = rec.netterRef || `Netter 7e ${region} Muscle Table (p.${pageNum})`;
      addSource(rec, 'netter');
      aliasToCanonical.set(mName.toLowerCase(), rec.key);
      aliasToCanonical.set(`${mName.toLowerCase()} muscle`, rec.key);
      count += 1;
    }
    return count;
  }

  // Helper to reconstruct Netter Clinical Table pages
  function extractNetterClinicalTable(lines, region, pageNum) {
    const headerIdx = lines.findIndex(
      (l) => /ANATOMIC STRUCTURES/i.test(l.text) && /CLINICAL IMPORTANCE/i.test(l.text)
    );
    if (headerIdx < 0) return 0;

    const hdrItems = lines.slice(Math.max(0, headerIdx - 2), headerIdx + 2).flatMap((l) => l.items);
    const impX = (hdrItems.find((i) => /CLINICAL IMPORTANCE/i.test(i.str))?.x ?? 181) - 10;
    const plateX = (hdrItems.find((i) => /NUMBERS|PLATE/i.test(i.str))?.x ?? 520) - 15;

    let currentSys = 'visceral';
    const rows = [];
    let current = null;

    for (const line of lines.slice(headerIdx + 1)) {
      if (/^\*Selections were based|^Table \d+/i.test(line.text)) continue;
      if (line.maxH >= 11 && /\bSYSTEM\b/i.test(line.text)) {
        const t = line.text.toLowerCase();
        if (t.includes('skeletal')) currentSys = 'skeletal';
        else if (t.includes('muscular')) currentSys = 'muscular';
        else if (t.includes('nervous')) currentSys = 'nervous';
        else if (t.includes('cardiovascular')) currentSys = 'cardiovascular';
        else currentSys = 'visceral';
        continue;
      }
      const sItems = line.items.filter((i) => i.x < impX);
      const iItems = line.items.filter((i) => i.x >= impX && i.x < plateX);
      const pItems = line.items.filter((i) => i.x >= plateX);

      if (sItems.length > 0 && (iItems.length > 0 || pItems.length > 0 || !current)) {
        if (current) rows.push(current);
        current = { struct: [], imp: [], plates: [], system: currentSys };
      }
      if (!current) continue;
      for (const i of sItems) current.struct.push(i.str);
      for (const i of iItems) current.imp.push(i.str);
      for (const i of pItems) current.plates.push(i.str);
    }
    if (current) rows.push(current);

    let count = 0;
    for (const r of rows) {
      const sName = dehyphenate(r.struct.join(' '));
      const imp = dehyphenate(r.imp.join(' '));
      const platesStr = dehyphenate(r.plates.join(' '));
      if (!sName || !imp || sName.length < 3) continue;
      const rec = getOrCreateEntry(sName, { system: r.system, region });
      if (!rec) continue;
      rec.clinicalNotesEn = rec.clinicalNotesEn
        ? truncateClean(`${rec.clinicalNotesEn} ${imp}`, 480)
        : truncateClean(imp, 460);
      if (platesStr) {
        for (const p of platesStr.split(/[,\s]+/).filter((x) => /^\w?\d+$/.test(x))) {
          addPlate(rec, `Plate ${p}`);
        }
      }
      rec.netterRef = rec.netterRef || `Netter 7e ${region} Clinical Table (p.${pageNum})`;
      if (!rec.summaryEn) {
        rec.summaryEn = truncateClean(
          `${rec.canonicalNameEn} (${region} — ${rec.system} system). Netter clinical highlight: ${imp}`,
          400
        );
      }
      addSource(rec, 'netter');
      count += 1;
    }
    return count;
  }

  const maxPage = Math.min(doc.numPages, chapters[chapters.length - 1]?.endPage ?? 745);
  for (let p = chapters[0]?.startPage ?? 35; p <= maxPage; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = groupItemsByLine(tc.items);
    const region = chapterAtPage(p);

    const mCount = extractNetterMuscleTable(lines, region, p);
    if (mCount > 0) {
      stats.muscleRows += mCount;
      continue;
    }
    const cCount = extractNetterClinicalTable(lines, region, p);
    if (cCount > 0) {
      stats.clinicalRows += cCount;
      continue;
    }

    // Atlas Plate page extraction (Plate id can sit near top OR bottom margin of Netter pages)
    let plateId = '';
    let plateTitle = '';
    const candidateHeaderLines = [...lines.slice(0, 22), ...lines.slice(-10)];
    for (const l of candidateHeaderLines) {
      const m = l.text.match(/\bPlate\s+(BP\d+|\d+)\b/i);
      if (m && !plateId) {
        plateId = `Plate ${m[1]}`;
      } else if (plateId && !plateTitle && l.maxH >= 12 && l.maxH <= 18 && !/^\d+$/.test(l.text)) {
        plateTitle = l.text;
      }
    }
    if (!plateId) {
      // Fallback: match standalone "PLATE" and number on nearby line, or section plate title >=13pt
      for (const l of lines.slice(0, 15)) {
        if (l.maxH >= 13 && l.maxH <= 18 && l.text.length > 4 && !/^\d+$/.test(l.text)) {
          plateTitle = plateTitle || l.text;
        }
      }
    }
    if (plateId) {
      stats.plates += 1;
      const plateDesc = plateTitle ? `${plateId}: ${plateTitle}` : plateId;
      // Extract clean plate labels (h 7..10, not header/footer/caption)
      const labelsSeen = new Set();
      let buf = [];
      const flushBuf = () => {
        if (buf.length === 0) return;
        const candidate = dehyphenate(buf.join(' '));
        buf = [];
        if (isBadHeadingOrLabel(candidate)) return;
        const nKey = normalizeKey(candidate);
        if (!nKey || labelsSeen.has(nKey)) return;
        labelsSeen.add(nKey);
        const sys = inferSystemFromText(candidate, plateTitle);
        const rec = getOrCreateEntry(candidate, { system: sys, region });
        if (!rec) return;
        addPlate(rec, plateId);
        rec.netterRef = rec.netterRef || `Netter 7e ${plateDesc}`;
        addSource(rec, 'netter');
        if (!rec.summaryEn) {
          rec.__isStubSummary = true;
          rec.summaryEn = truncateClean(
            `${rec.canonicalNameEn} — ${plateDesc} (${region} region).`
          );
        }
        regionalInventory[region] ??= {};
        regionalInventory[region][rec.system] ??= new Set();
        regionalInventory[region][rec.system].add(rec.key);
        stats.plateLabels += 1;
      };

      // Group vertically adjacent label lines slightly to reassemble wrapped labels in Netter diagrams
      // Better approach: single-item lines with font height 8-9 matching anatomical structures
      for (const l of lines) {
        if (l.maxH >= 11 || l.maxH < 7.5 || l.y > 730) {
          flushBuf();
          continue;
        }
        const t = l.text.trim();
        if (!t || /^See also\b/i.test(t) || /^\(/.test(t)) {
          flushBuf();
          continue;
        }
        // Only register standalone label phrases cleanly (1 to 6 words)
        flushBuf();
        if (!isBadHeadingOrLabel(t)) {
          buf.push(t);
          flushBuf();
        }
      }
      flushBuf();
    }
  }

  await doc.cleanup();
  await task.destroy();
  console.log(
    `   ✅ Netter 7e extracted: ${stats.plates} plates, ${stats.muscleRows} muscle rows, ${stats.clinicalRows} clinical rows, ${stats.plateLabels} plate inventory labels`
  );
  return { stats, regionalInventory };
}

// ---------------------------------------------------------------------------
// Book 2 Parser: Gray's Anatomy for Students (4th Ed.)
// ---------------------------------------------------------------------------

async function parseGrays(filePath) {
  console.log('📖 [Book 2] Loading Gray\'s Anatomy for Students (4th Ed.)...');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const task = pdfjsLib.getDocument({ data, verbosity: 0 });
  const doc = await task.promise;

  const chapters = await resolveOutlineRanges(doc, (t) => /^[1-9]\s/.test(t));
  let stats = { pages: doc.numPages, topicMatches: 0, clinicBoxes: 0, tablesParsed: 0 };

  function chapterAtPage(p) {
    for (const c of chapters) {
      if (p >= c.startPage && p <= c.endPage) return c.title;
    }
    return 'Anatomy';
  }

  // Reconstruct 2-column ordered blocks for a Gray's page
  function extractTwoColumnLines(items) {
    const body = items
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        h: Math.round(it.height || 0),
      }))
      .filter((it) => it.str && it.str.trim() && it.y > 58 && it.y < 735);

    const splitColumn = (colItems) => {
      colItems.sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      for (const it of colItems) {
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y - it.y) <= 3.5) {
          last.items.push(it);
        } else {
          lines.push({ y: it.y, items: [it] });
        }
      }
      for (const l of lines) {
        l.items.sort((a, b) => a.x - b.x);
        l.text = l.items.map((x) => x.str.trim()).join(' ').replace(/\s+/g, ' ').trim();
        l.maxH = Math.max(...l.items.map((x) => x.h));
      }
      return lines;
    };

    // Detect if page has a full-width Table or two-column prose
    const isTablePage = body.some((i) => /^Table\s+\d+\.\d+/i.test(i.str.trim()) && i.x < 120);
    if (isTablePage) {
      return { isTable: true, lines: splitColumn(body) };
    }
    const left = splitColumn(body.filter((i) => i.x < 295));
    const right = splitColumn(body.filter((i) => i.x >= 295));
    return { isTable: false, lines: [...left, ...right] };
  }

  // Helper to match existing canonical topic key cleanly
  function findMatchingCanonicalKey(topicStr) {
    const rawKey = normalizeKey(topicStr);
    if (!rawKey) return null;
    if (aliasToCanonical.has(rawKey)) return aliasToCanonical.get(rawKey);
    if (storeEntries.has(rawKey)) return rawKey;
    // Strip plural 's'/'es'/'ies' -> 'y' for exact match (e.g. Kidneys -> Kidney, Ovaries -> Ovary, Testes -> Testis)
    const variants = [];
    if (rawKey.endsWith('ies') && rawKey.length > 4) variants.push(`${rawKey.slice(0, -3)}y`);
    if (rawKey.endsWith('es') && rawKey.length > 4) {
      variants.push(rawKey.slice(0, -2));
      if (rawKey.endsWith('tes')) variants.push(`${rawKey.slice(0, -2)}is`);
    }
    if (rawKey.endsWith('s') && rawKey.length > 4) variants.push(rawKey.slice(0, -1));
    for (const v of variants) {
      if (aliasToCanonical.has(v)) return aliasToCanonical.get(v);
      if (storeEntries.has(v)) return v;
    }
    return null;
  }

  function applyParagraphToEntry(rec, subType, text, region, pageNum) {
    const clean = dehyphenate(text).replace(/\s+[A-Z]$/, '').trim();
    if (clean.length < 28) return;

    const refTag = `Gray's 4e ${region} (p.${pageNum})`;
    if (!rec.grayRef) rec.grayRef = refTag;
    // Authoritative primary chapter prose overrides cross-section plate region tags
    if (region && subType === 'overview' && clean.length > 90 && !rec.__hasGrayProse) {
      rec.region = region;
    }
    addSource(rec, 'grays');

    if (subType === 'clinic') {
      if (!rec.clinicalNotesEn || clean.length > rec.clinicalNotesEn.length) {
        rec.clinicalNotesEn = truncateClean(clean, 480);
      }
      return;
    }
    if (subType === 'arterial') {
      if (!rec.arterialSupply || rec.arterialSupply.length < 40) {
        rec.arterialSupply = truncateClean(clean, 300);
      }
      return;
    }
    if (subType === 'venous') {
      if (!rec.venousDrainage || rec.venousDrainage.length < 30) {
        rec.venousDrainage = truncateClean(clean, 260);
      }
      return;
    }
    if (subType === 'innervation') {
      if (!rec.innervation || rec.innervation.length < 35) {
        rec.innervation = truncateClean(clean, 280);
      }
      return;
    }
    if (subType === 'relations') {
      if (!rec.relationsEn || clean.length > rec.relationsEn.length) {
        rec.relationsEn = truncateClean(clean, 360);
      }
      return;
    }

    // Overview / Function
    const isRichProse = clean.length > 65;
    if (isRichProse && (!rec.summaryEn || rec.__isStubSummary || /\)\.\s*Action:/i.test(rec.summaryEn))) {
      rec.summaryEn = truncateClean(clean, 480);
      rec.__isStubSummary = false;
      rec.__hasGrayProse = true;
    }

    // Opportunistically harvest inline supply / relations sentences from Gray's overview text
    const sentences = splitSentencesSafe(clean);
    for (const s of sentences) {
      if (s.length < 25 || s.length > 260) continue;
      if (!rec.arterialSupply && /\b(arterial supply|blood supply|supplied by|branches of the .* artery|receives blood from)\b/i.test(s)) {
        rec.arterialSupply = s;
      } else if (!rec.venousDrainage && /\b(venous drainage|drains into the|drained by)\b/i.test(s)) {
        rec.venousDrainage = s;
      } else if (!rec.innervation && /\b(innervated by|innervation is|nerve supply|motor supply)\b/i.test(s)) {
        rec.innervation = s;
      } else if (
        !rec.relationsEn &&
        !rec.origin &&
        /\b(lies (?:anterior|posterior|medial|lateral|superior|inferior) to|is (?:anterior|posterior|medial|lateral|superior|inferior) to|extends from .* to|attaches to)\b/i.test(s)
      ) {
        rec.relationsEn = s;
      }
    }
  }

  let activeTopicKey = null;
  let activeSubType = 'overview';
  let activeClinicMode = false;
  let clinicTargetKey = null;

  for (let p = chapters[0]?.startPage ?? 5; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const region = chapterAtPage(p);
    const { isTable, lines } = extractTwoColumnLines(tc.items);

    // Try extracting Gray's Muscle Table (Muscle | Origin | Insertion | Innervation | Function)
    if (isTable) {
      const hdrIdx = lines.findIndex(
        (l) => /\bMuscle\b/i.test(l.text) && /\bOrigin\b/i.test(l.text) && /\bInsertion\b/i.test(l.text)
      );
      if (hdrIdx >= 0) {
        stats.tablesParsed += 1;
        const hdrItems = lines[hdrIdx].items;
        const cols = hdrItems
          .filter((i) => /^(Muscle|Origin|Insertion|Innervation|Function|Action)/i.test(i.str.trim()))
          .map((i) => ({ key: i.str.trim().toLowerCase(), x: i.x - 10 }))
          .sort((a, b) => a.x - b.x);
        if (cols.length >= 3) {
          const colForX = (x) => {
            let k = cols[0].key;
            for (const c of cols) if (x >= c.x) k = c.key;
            return k;
          };
          let row = null;
          const flushRow = () => {
            if (!row) return;
            const mName = dehyphenate((row.muscle || []).join(' '));
            if (mName && mName.length >= 3 && !/^Table \d+/i.test(mName)) {
              const rec = getOrCreateEntry(mName, { system: 'muscular', region });
              if (rec) {
                const org = dehyphenate((row.origin || []).join(' '));
                const ins = dehyphenate((row.insertion || []).join(' '));
                const inn = dehyphenate((row.innervation || []).join(' '));
                const fn = dehyphenate((row.function || row.action || []).join(' '));
                if (org && !rec.origin) rec.origin = org;
                if (ins && !rec.insertion) rec.insertion = ins;
                if (inn && !rec.innervation) rec.innervation = inn;
                if (fn) {
                  if (!rec.action) rec.action = fn;
                  if (!rec.primaryFunctionEn) rec.primaryFunctionEn = fn;
                }
                rec.grayRef = rec.grayRef || `Gray's 4e ${region} Table (p.${p})`;
                addSource(rec, 'grays');
              }
            }
            row = null;
          };
          for (const l of lines.slice(hdrIdx + 1)) {
            if (l.maxH > 9 || /^(■|Fig\.|In the clinic)/i.test(l.text)) break;
            const mParts = l.items.filter((i) => colForX(i.x) === 'muscle');
            if (mParts.length > 0 && l.items.some((i) => colForX(i.x) !== 'muscle')) {
              flushRow();
              row = {};
            }
            if (!row) continue;
            for (const i of l.items) {
              const ck = colForX(i.x);
              row[ck] ??= [];
              row[ck].push(i.str);
            }
          }
          flushRow();
        }
      }
    }

    let paraBuf = [];
    const flushPara = () => {
      if (paraBuf.length === 0) return;
      const full = dehyphenate(paraBuf.join(' '));
      paraBuf = [];
      if (full.length < 30) return;

      if (activeClinicMode) {
        if (!clinicTargetKey) {
          // Try finding an anatomical structure mentioned in first sentence
          const first = full.slice(0, 180).toLowerCase();
          for (const [k, rec] of storeEntries) {
            if (k.length >= 5 && first.includes(k)) {
              clinicTargetKey = k;
              break;
            }
          }
        }
        const target = clinicTargetKey && storeEntries.get(clinicTargetKey);
        if (target) {
          applyParagraphToEntry(target, 'clinic', full, region, p);
          stats.clinicBoxes += 1;
        }
        return;
      }

      if (activeTopicKey && storeEntries.has(activeTopicKey)) {
        applyParagraphToEntry(storeEntries.get(activeTopicKey), activeSubType, full, region, p);
        stats.topicMatches += 1;
      }
    };

    for (const line of lines) {
      const t = line.text.trim();
      if (!t || /^(Fig\.|eFig\.|Table \d+)/i.test(t) || line.maxH <= 9) continue;

      if (/^In the clinic/i.test(t)) {
        flushPara();
        activeClinicMode = true;
        clinicTargetKey = activeTopicKey;
        continue;
      }

      // Section headings in Gray's (h >= 11)
      if (line.maxH >= 11 && t.length <= 75) {
        flushPara();
        activeClinicMode = false;

        if (/^(Arterial supply|Blood supply|Branches of .*artery)$/i.test(t)) {
          activeSubType = 'arterial';
        } else if (/^(Venous drainage|Veins)$/i.test(t)) {
          activeSubType = 'venous';
        } else if (/^(Innervation|Nerve supply|Nerves)$/i.test(t)) {
          activeSubType = 'innervation';
        } else if (/^(Relations|Borders|Attachments|Contents|Boundaries)$/i.test(t)) {
          activeSubType = 'relations';
        } else if (!isBadHeadingOrLabel(t)) {
          const matched = findMatchingCanonicalKey(t);
          if (matched) {
            activeTopicKey = matched;
            activeSubType = 'overview';
          } else {
            const newRec = getOrCreateEntry(t, {
              system: inferSystemFromText(t, ''),
              region,
            });
            activeTopicKey = newRec?.key ?? null;
            activeSubType = 'overview';
          }
        }
        continue;
      }

      // Prose paragraph lines (h == 10)
      if (line.maxH === 10) {
        // Check inline topic lead like "Sciatic nerve. The sciatic nerve..." or "Heart. The heart..."
        const leadMatch = t.match(/^([A-Z][a-zA-Z\s\-]{2,38})\.\s+(?:The|This|It|These|A|An)\s+/);
        if (leadMatch) {
          flushPara();
          const matched = findMatchingCanonicalKey(leadMatch[1]);
          if (matched) {
            activeTopicKey = matched;
            activeSubType = 'overview';
          } else if (!isBadHeadingOrLabel(leadMatch[1])) {
            const created = getOrCreateEntry(leadMatch[1], {
              system: inferSystemFromText(leadMatch[1], ''),
              region,
            });
            activeTopicKey = created?.key ?? activeTopicKey;
            activeSubType = 'overview';
          }
        }
        paraBuf.push(t);
        if (paraBuf.join(' ').length > 650) flushPara();
      }
    }
    flushPara();
  }

  await doc.cleanup();
  await task.destroy();
  console.log(
    `   ✅ Gray's 4e extracted: ${stats.topicMatches} prose matches, ${stats.clinicBoxes} clinical correlations, ${stats.tablesParsed} tables parsed`
  );
  return stats;
}

// ---------------------------------------------------------------------------
// GLB Inventory Audit vs Book 1
// ---------------------------------------------------------------------------

function walkGlbs(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walkGlbs(full));
    else if (ent.name.endsWith('.glb')) out.push(full);
  }
  return out;
}

function readGlbJsonHeader(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'glTF') return null;
  const chunkLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + chunkLen));
}

function cleanGlbNodeName(name) {
  return String(name || '')
    .replace(/\.\d{3,}$/i, '')
    .replace(/^(VH_[MF]_|Yao_)/i, '')
    .replace(/(?:_(?:Left|Right|[LR]))$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function runGlbAudit() {
  const glbFiles = walkGlbs(path.join(ROOT, 'public', 'models'));
  const uniqueNames = new Set();
  const matchedNames = new Set();
  const unmatchedSample = [];
  const genericNodesByModel = {};
  const hiddenOrMisclassifiedFindings = [];

  for (const fullPath of glbFiles) {
    const rel = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    const json = readGlbJsonHeader(fullPath);
    if (!json) continue;

    let genericCount = 0;
    const nodes = json.nodes || [];
    const mats = json.materials || [];
    const meshes = json.meshes || [];

    let peritCount = 0;
    let lymphNodeCount = 0;
    let femaleVisceralMats = new Set();

    for (const n of nodes) {
      const raw = n.name || '';
      if (!raw || /^(Object|Mesh|Node|Group|Primitive|Part|Cube|Plane|Sphere)[_\-\s]?\d*$/i.test(raw)) {
        if (n.mesh !== undefined) genericCount += 1;
        continue;
      }
      if (/^Sketchfab_|^RootNode$|\.cleaner\.materialmerger/i.test(raw)) continue;

      if (rel.includes('zanatomy/visceral.glb')) {
        if (/(Greater_omentum|Lesser_omentum|Mesocolon)/i.test(raw)) peritCount += 1;
        if (/(_nodes?\b|^Node_of_|^Lymph_node$)/i.test(raw)) lymphNodeCount += 1;
      }

      const cleaned = cleanGlbNodeName(raw);
      const norm = normalizeKey(cleaned);
      if (!norm) continue;
      uniqueNames.add(norm);

      const canonKey = aliasToCanonical.get(norm);
      if (canonKey && storeEntries.has(canonKey)) {
        matchedNames.add(norm);
      } else {
        // Fallback word-stem check (e.g. "Proximal phalanx of third finger of foot" -> "phalanx" / "phalanges")
        const tokens = norm.split(' ').filter((w) => w.length >= 4);
        const partialHit = tokens.find((t) => aliasToCanonical.has(t));
        if (partialHit) {
          matchedNames.add(norm);
        } else if (unmatchedSample.length < 30 && !unmatchedSample.includes(cleaned)) {
          unmatchedSample.push(cleaned);
        }
      }
    }

    if (rel.includes('female/female_pelvis_viscera.glb')) {
      for (const m of mats) if (m.name) femaleVisceralMats.add(m.name);
      hiddenOrMisclassifiedFindings.push(
        `female_pelvis_viscera.glb uses ${genericCount} Object_N nodes whose true organ identities reside on materials (${Array.from(femaleVisceralMats).join(', ')})`
      );
    }
    if (rel.includes('female/female_muscular.glb') && genericCount > 0) {
      hiddenOrMisclassifiedFindings.push(
        `female_muscular.glb contains ${genericCount} generic Object_N nodes requiring 3D spatial anatomy resolution + material disambiguation`
      );
    }
    if (rel.includes('female/female_skeletal.glb') && genericCount > 0) {
      hiddenOrMisclassifiedFindings.push(
        `female_skeletal.glb contains ${genericCount} generic Object_N nodes requiring 3D spatial anatomy resolution`
      );
    }
    if (rel.includes('zanatomy/visceral.glb')) {
      hiddenOrMisclassifiedFindings.push(
        `zanatomy/visceral.glb contains ${peritCount} omentum/mesocolon apron meshes & ${lymphNodeCount} floating lymph node meshes obstructing viscera`
      );
    }
    if (genericCount > 0) {
      genericNodesByModel[rel] = genericCount;
    }
  }

  return {
    totalGlbFiles: glbFiles.length,
    totalUniqueGlbNames: uniqueNames.size,
    matchedByTextbookCount: matchedNames.size,
    matchedPercentage: uniqueNames.size
      ? Number(((matchedNames.size / uniqueNames.size) * 100).toFixed(1))
      : 0,
    unmatchedSample,
    genericNodesByModel,
    hiddenOrMisclassifiedFindings,
  };
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------

if (!fs.existsSync(NETTER_PDF_PATH) || !fs.existsSync(GRAYS_PDF_PATH)) {
  console.error('❌ Missing required textbook PDFs in project root!');
  process.exit(1);
}

const { stats: netterStats, regionalInventory } = await parseNetter(NETTER_PDF_PATH);
const grayStats = await parseGrays(GRAYS_PDF_PATH);

// Compact & prioritize entries so frontend JSON remains fast & focused (<~1.2 MB)
// Retain every entry that has substantive clinical/textbook content (from Muscle Tables, Clinical Tables, Gray's prose, OR major Plate structures)
const compactEntries = {};
const compactAliases = {};
const compactRegional = {};

for (const [key, rec] of storeEntries.entries()) {
  const hasRichTextbookData =
    Boolean(rec.origin || rec.insertion || rec.arterialSupply || rec.innervation || rec.clinicalNotesEn) ||
    rec.sources.includes('grays') ||
    rec.netterPlates.length >= 2 ||
    rec.summaryEn.length > 90;

  if (!hasRichTextbookData && storeEntries.size > 1200) continue;

  const slim = {
    canonicalNameEn: rec.canonicalNameEn,
    system: rec.system,
    region: rec.region || 'General',
    summaryEn: rec.summaryEn,
    ...(rec.muscleGroup ? { muscleGroup: rec.muscleGroup } : {}),
    ...(rec.primaryFunctionEn ? { primaryFunctionEn: truncateClean(rec.primaryFunctionEn, 240) } : {}),
    ...(rec.origin ? { origin: truncateClean(rec.origin, 240) } : {}),
    ...(rec.insertion ? { insertion: truncateClean(rec.insertion, 240) } : {}),
    ...(rec.action ? { action: truncateClean(rec.action, 240) } : {}),
    ...(rec.relationsEn ? { relationsEn: truncateClean(rec.relationsEn, 300) } : {}),
    ...(rec.arterialSupply ? { arterialSupply: truncateClean(rec.arterialSupply, 240) } : {}),
    ...(rec.venousDrainage ? { venousDrainage: truncateClean(rec.venousDrainage, 220) } : {}),
    ...(rec.innervation ? { innervation: truncateClean(rec.innervation, 240) } : {}),
    ...(rec.clinicalNotesEn ? { clinicalNotesEn: truncateClean(rec.clinicalNotesEn, 380) } : {}),
    ...(rec.netterPlates.length ? { netterPlates: rec.netterPlates.slice(0, 6) } : {}),
    ...(rec.netterRef ? { netterRef: rec.netterRef } : {}),
    ...(rec.grayRef ? { grayRef: rec.grayRef } : {}),
    sources: rec.sources,
  };
  compactEntries[key] = slim;
}

for (const [alias, canon] of aliasToCanonical.entries()) {
  if (compactEntries[canon] && alias !== canon) {
    compactAliases[alias] = canon;
  }
}

for (const [region, sysMap] of Object.entries(regionalInventory)) {
  compactRegional[region] = {};
  for (const [sys, keySet] of Object.entries(sysMap)) {
    compactRegional[region][sys] = Array.from(keySet)
      .filter((k) => Boolean(compactEntries[k]))
      .slice(0, 45);
  }
}

const glbAudit = runGlbAudit();

const payload = {
  version: '2.0.0',
  generatedAt: new Date().toISOString(),
  books: {
    book1: "Netter's Atlas of Human Anatomy (7th Edition)",
    book2: "Gray's Anatomy for Students (4th Edition)",
  },
  audit: {
    netterPlatesCount: netterStats.plates,
    netterMuscleTableRows: netterStats.muscleRows,
    netterClinicalTableRows: netterStats.clinicalRows,
    netterPlateLabels: netterStats.plateLabels,
    grayTopicsCount: grayStats.topicMatches,
    grayClinicBoxesCount: grayStats.clinicBoxes,
    grayTablesParsed: grayStats.tablesParsed,
    totalCanonicalEntries: Object.keys(compactEntries).length,
    totalAliases: Object.keys(compactAliases).length,
    glbAudit,
  },
  spatialRegions: compactRegional,
  aliases: compactAliases,
  entries: compactEntries,
};

fs.mkdirSync(path.dirname(OUTPUT_JSON_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(payload), 'utf8');
const fileSizeKb = (fs.statSync(OUTPUT_JSON_PATH).size / 1024).toFixed(1);

console.log('\n📊 EXTRACTION & AUDIT SUMMARY:');
console.log(`   - Canonical Textbook Entries: ${payload.audit.totalCanonicalEntries} (+ ${payload.audit.totalAliases} aliases)`);
console.log(`   - GLB Scene Graph Match Coverage: ${glbAudit.matchedByTextbookCount}/${glbAudit.totalUniqueGlbNames} (${glbAudit.matchedPercentage}%)`);
console.log(`   - Generic Nodes Detected: ${JSON.stringify(glbAudit.genericNodesByModel)}`);
console.log(`   - Key Findings:\n     * ${glbAudit.hiddenOrMisclassifiedFindings.join('\n     * ')}`);
console.log(`   - Written: ${OUTPUT_JSON_PATH} (${fileSizeKb} KB)`);
