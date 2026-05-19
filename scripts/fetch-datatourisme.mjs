#!/usr/bin/env node
/**
 * Télécharge les CSV régionaux de DATAtourisme (ADN Tourisme, data.gouv.fr),
 * filtre les POIs de type hébergement (Accommodation / LodgingBusiness et
 * sous-classes), et écrit un fichier GeoJSON par département dans
 * public/data/datatourisme-lodging/<code-dept>.geojson, accompagné d'un
 * index.json listant les départements disponibles avec leur bbox réelle.
 *
 * Lancer à la main quand on veut rafraîchir l'asset :
 *     node scripts/fetch-datatourisme.mjs
 *
 * Source : https://www.data.gouv.fr/datasets/datatourisme-la-base-nationale-des-donnees-publiques-dinformation-touristique-en-open-data
 * Licence : Licence Ouverte (fr-lo) — attribution "ADN Tourisme / DATAtourisme".
 *
 * Le dataset upstream est régénéré tous les jours à ~3h du matin.
 *
 * Pourquoi un fichier par département :
 *  - L'asset national filtré pèse ~39 MB / 8.5 MB gzippé, soit trop pour un
 *    fetch unique côté client.
 *  - En découpant par département (96 métropole + DOM), chaque fichier fait
 *    typiquement <1 MB, et le client n'en charge que 1 à 3 pour une trace
 *    donnée (selon le bbox du tracé).
 *  - L'index.json permet au client de savoir quels fichiers intersectent
 *    la bbox de sa trace, sans avoir à les télécharger spéculativement.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'data', 'datatourisme-lodging');

const REGION_RESOURCES = {
  ara: '5b3c2cee-44b7-48bd-b4e8-439a03ff6cd2',
  bfc: 'd92f0184-e9cb-4bc9-81b0-b43fbcf2a0d2',
  bre: 'ab746af8-d21a-42d1-acae-fdfb2e52ecd5',
  cor: '2aefffc5-42f5-4e68-ba85-ba19c13fcb4c',
  cvl: '6063e108-f8bd-4541-ba67-a5cadac804fb',
  gde: '59956d74-969b-4c42-8ea4-9348f6a70f7a',
  glp: 'f73506d6-a336-4743-827b-64a39d891158',
  guf: '338bb298-cc1f-4bfd-adfd-a3c13fbfa393',
  hdf: '838b6af3-74e5-4d51-873d-d359af3f1855',
  idf: 'b31a1eca-f2ff-495a-9b67-7c0bc281ea57',
  mtq: '4f95a530-d106-4ecd-aa39-1b9d639ee45c',
  myt: '77114c00-9928-49c1-9a1c-5545c10c7101',
  naq: '734a4e86-d571-48f6-bdc0-596914066606',
  nor: 'cb1ebc9c-73fb-43e8-9386-a7b3cf83a642',
  occ: '0c463ef6-c00a-48e2-b50a-d17cfe998b84',
  pac: '83a1f131-9e23-4c3b-b1c6-e58f33fe7b80',
  pdl: '56d437a7-eb0c-4c31-9138-539be94bc490',
  reu: '2b52bb1f-8676-43f2-b883-f673e7015ed9',
};

const LODGING_URIS = new Set([
  'Accommodation',
  'LodgingBusiness',
  'CollectiveAccommodation',
  'Hotel',
  'HotelTrade',
  'HotelRestaurant',
  'HolidayResort',
  'Camping',
  'CampingAndCaravanning',
  'BedAndBreakfast',
  'Hostel',
  'YouthHostel',
  'Rental',
  'GuestRoom',
  'MountainHut',
  'MountainRefuge',
  'Gite',
  'GiteEtape',
  'RuralAccommodation',
]);

const SUBTYPE_PRIORITY = [
  'MountainHut',
  'MountainRefuge',
  'Gite',
  'GiteEtape',
  'BedAndBreakfast',
  'Hostel',
  'YouthHostel',
  'Camping',
  'CampingAndCaravanning',
  'HotelRestaurant',
  'Hotel',
  'HotelTrade',
  'HolidayResort',
  'RuralAccommodation',
  'Rental',
  'GuestRoom',
  'CollectiveAccommodation',
  'LodgingBusiness',
  'Accommodation',
];

function categoryTails(rawCategories) {
  const tails = [];
  for (const url of (rawCategories || '').split('|')) {
    const tail = url.split('#').pop().split('/').pop();
    if (tail) tails.push(tail);
  }
  return tails;
}

function pickSubtype(tails) {
  for (const t of SUBTYPE_PRIORITY) if (tails.includes(t)) return t;
  return null;
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

/**
 * Code département à partir du code postal. La Poste assigne les CP par
 * dept en métropole (2 premiers chiffres), 3 chiffres pour les DOM (97x).
 * La Corse a un code postal à 5 chiffres qui débute par "20" mais la
 * convention administrative utilise "2A" (Corse-du-Sud) et "2B" (Haute-
 * Corse). Mapping pragmatique : 20000-20199 → 2A, 20200+ → 2B (suit la
 * convention de La Poste pour les codes commune).
 */
function cpToDept(cp) {
  if (!cp || cp.length < 2) return null;
  const c2 = cp.slice(0, 2);
  if (c2 === '20') {
    const n = parseInt(cp.slice(0, 5), 10);
    if (!Number.isFinite(n)) return '2B';
    return n < 20200 ? '2A' : '2B';
  }
  if (c2 === '97' || c2 === '98') return cp.slice(0, 3); // DOM-TOM
  return c2;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function extractFirstUrl(contactStr) {
  if (!contactStr) return null;
  const m = contactStr.match(/https?:\/\/[^\s|]+/);
  return m ? m[0] : null;
}

async function processRegion(code, resourceId) {
  const url = `https://www.data.gouv.fr/api/1/datasets/r/${resourceId}`;
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${code} → HTTP ${r.status}`);
  const text = await r.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const required = [
    'Nom_du_POI',
    'Categories_de_POI',
    'Latitude',
    'Longitude',
    'URI_ID_du_POI',
  ];
  for (const col of required) {
    if (!(col in idx)) throw new Error(`${code} : colonne manquante "${col}"`);
  }

  const features = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < required.length) continue;
    const tails = categoryTails(row[idx.Categories_de_POI]);
    const isLodging = tails.some((t) => LODGING_URIS.has(t));
    if (!isLodging) continue;

    const lat = parseFloat(row[idx.Latitude]);
    const lon = parseFloat(row[idx.Longitude]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const subtype = pickSubtype(tails) ?? 'Accommodation';
    const nom = (row[idx.Nom_du_POI] ?? '').trim() || 'Hébergement';
    const cpCommune = (row[idx['Code_postal_et_commune']] ?? '').trim();
    const dept = cpToDept(cpCommune);
    if (!dept) continue;
    const commune = cpCommune || null;
    const contacts = row[idx['Contacts_du_POI']] ?? '';
    const website = extractFirstUrl(contacts);
    const uri = row[idx['URI_ID_du_POI']] ?? '';

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
      properties: {
        nom,
        sub: subtype,
        cm: commune,
        web: website,
        uri,
        dept,
        reg: code,
      },
    });
  }
  return features;
}

// ─── Pipeline ──────────────────────────────────────────────────────────

// Nettoyage : on supprime l'ancien dossier pour ne pas garder de dept
// fantômes (ex : une région qui ne renverrait plus aucun hébergement).
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const codes = Object.keys(REGION_RESOURCES);
console.log(`Téléchargement de ${codes.length} régions…`);

const allFeatures = [];
const regionStats = {};

for (const code of codes) {
  const start = Date.now();
  try {
    const feats = await processRegion(code, REGION_RESOURCES[code]);
    allFeatures.push(...feats);
    regionStats[code] = feats.length;
    console.log(
      `  ${code.padEnd(4)} ${feats.length.toString().padStart(6)} hébergements (${(
        (Date.now() - start) /
        1000
      ).toFixed(1)}s)`,
    );
  } catch (e) {
    regionStats[code] = `ERR ${e.message}`;
    console.error(`  ${code.padEnd(4)} ÉCHEC : ${e.message}`);
  }
}

// Dédoublonnage par URI
const seen = new Set();
const uniq = [];
for (const f of allFeatures) {
  const u = f.properties.uri;
  if (u && seen.has(u)) continue;
  if (u) seen.add(u);
  uniq.push(f);
}

// Groupement par département + calcul bbox réelle
const byDept = new Map();
for (const f of uniq) {
  const d = f.properties.dept;
  if (!byDept.has(d)) byDept.set(d, []);
  byDept.get(d).push(f);
}

function computeBbox(feats) {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const f of feats) {
    const [lon, lat] = f.geometry.coordinates;
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [round5(w), round5(s), round5(e), round5(n)];
}

const depts = [];
let totalBytes = 0;
for (const [dept, feats] of [...byDept.entries()].sort()) {
  const fc = {
    type: 'FeatureCollection',
    features: feats,
  };
  const payload = JSON.stringify(fc);
  await writeFile(resolve(OUT_DIR, `${dept}.geojson`), payload, 'utf8');
  totalBytes += payload.length;
  depts.push({
    dept,
    count: feats.length,
    bbox: computeBbox(feats),
    kb: Math.round(payload.length / 1024),
  });
}

const index = {
  source: 'DATAtourisme — ADN Tourisme',
  dataset:
    'https://www.data.gouv.fr/datasets/datatourisme-la-base-nationale-des-donnees-publiques-dinformation-touristique-en-open-data',
  license: 'Licence Ouverte (fr-lo)',
  attribution: 'ADN Tourisme / DATAtourisme',
  generated_at: new Date().toISOString(),
  count: uniq.length,
  per_region: regionStats,
  filter: 'Accommodation / LodgingBusiness et sous-classes',
  departments: depts,
};
await writeFile(resolve(OUT_DIR, 'index.json'), JSON.stringify(index), 'utf8');

console.log();
console.log(
  `✓ ${depts.length} départements · ${uniq.length} hébergements · ${(totalBytes / 1024 / 1024).toFixed(2)} MB total`,
);
console.log(`  index.json + ${depts.length} fichiers dans ${OUT_DIR}`);
const sorted = depts.slice().sort((a, b) => b.kb - a.kb);
console.log();
console.log('Top 5 dépts les plus volumineux :');
for (const d of sorted.slice(0, 5)) {
  console.log(`  ${d.dept.padEnd(4)} ${d.count.toString().padStart(5)} POIs · ${d.kb} KB`);
}
