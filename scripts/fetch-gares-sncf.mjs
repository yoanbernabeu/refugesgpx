#!/usr/bin/env node
/**
 * Télécharge l'export GeoJSON officiel des gares de voyageurs SNCF
 * (data.gouv.fr / ressources.data.sncf.com) et écrit une version simplifiée
 * dans public/data/gares-sncf.geojson.
 *
 * Lancer à la main quand on veut rafraîchir l'asset :
 *     node scripts/fetch-gares-sncf.mjs
 *
 * Source : https://www.data.gouv.fr/datasets/gares-de-voyageurs-1
 * Licence : Licence Ouverte v2 / Etalab (attribution SNCF).
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'public', 'data', 'gares-sncf.geojson');
const SRC =
  'https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/gares-de-voyageurs/exports/geojson';

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

const res = await fetch(SRC);
if (!res.ok) throw new Error(`Fetch SNCF → ${res.status}`);
const raw = await res.json();
if (raw?.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
  throw new Error('GeoJSON inattendu (pas une FeatureCollection)');
}

const features = [];
for (const f of raw.features) {
  const c = f?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) continue;
  const p = f.properties ?? {};
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [round5(c[0]), round5(c[1])] },
    properties: {
      nom: p.nom ?? null,
      lc: p.libellecourt ?? null, // code 3-lettres SNCF
      seg: p.segment_drg ?? null, // A | B | C — taille de gare
      uic: p.codes_uic ?? null, // ID UIC international (clé stable)
    },
  });
}

const out = {
  type: 'FeatureCollection',
  metadata: {
    source: 'SNCF — Gares de voyageurs',
    dataset: 'https://www.data.gouv.fr/datasets/gares-de-voyageurs-1',
    license: 'LOV2 / Etalab',
    generated_at: new Date().toISOString(),
    count: features.length,
  },
  features,
};

const payload = JSON.stringify(out);
await writeFile(OUT, payload, 'utf8');
console.log(`✓ ${OUT}`);
console.log(`  ${features.length} gares · ${(payload.length / 1024).toFixed(1)} KB`);
