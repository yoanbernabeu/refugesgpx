import { z } from 'zod';
import type { PoiFeature } from './types';

/**
 * Charge l'export statique des gares de voyageurs SNCF
 * (public/data/gares-sncf.geojson, regénéré via scripts/fetch-gares-sncf.mjs)
 * et le filtre par bbox.
 *
 * On reste sur un fetch unique en module : le fichier fait ~420 KB (76 KB
 * gzippé) et le navigateur le cache via les en-têtes HTTP. Pas de cache
 * IndexedDB nécessaire — le GeoJSON est plus petit que la plupart des bbox
 * Overpass qu'on stocke déjà.
 */

const GARES_URL = '/data/gares-sncf.geojson';

/** Offset pour garder les ID négatifs et disjoints de toutes les autres
 * sources. Codes UIC : ~10^8, OSM ways : +1e10, C2C : +1e12. */
const SNCF_ID_OFFSET = 1e13;

const FeatureSchema = z.looseObject({
  type: z.literal('Feature'),
  geometry: z.looseObject({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).min(2),
  }),
  properties: z.looseObject({
    nom: z.string().nullable().optional(),
    lc: z.string().nullable().optional(),
    seg: z.string().nullable().optional(),
    uic: z.string().nullable().optional(),
  }),
});

const FCSchema = z.looseObject({
  type: z.literal('FeatureCollection'),
  features: z.array(FeatureSchema),
});

export type Bbox = [number, number, number, number]; // [west, south, east, north]

let cache: PoiFeature[] | null = null;
let inflight: Promise<PoiFeature[]> | null = null;

async function loadAllGares(signal?: AbortSignal): Promise<PoiFeature[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const r = await fetch(GARES_URL, { signal });
    if (!r.ok) throw new Error(`SNCF gares → ${r.status}`);
    const raw = await r.json();
    const parsed = FCSchema.parse(raw);
    const out: PoiFeature[] = [];
    for (const f of parsed.features) {
      const [lon, lat] = f.geometry.coordinates;
      const uic = f.properties.uic;
      // Sans UIC on n'a pas d'ID stable → on saute (cas marginal)
      if (!uic) continue;
      const uicNum = parseInt(uic, 10);
      if (!Number.isFinite(uicNum)) continue;
      const id = -(uicNum + SNCF_ID_OFFSET);
      const nom = f.properties.nom ?? 'Gare';
      out.push({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          id,
          nom,
          type: { id: -4, valeur: 'sncf_gare' },
          sncfUic: uic,
          sncfLibelleCourt: f.properties.lc ?? undefined,
          sncfSegment: f.properties.seg ?? undefined,
        },
      } as unknown as PoiFeature);
    }
    cache = out;
    return out;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function fetchGaresSNCF(
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<PoiFeature[]> {
  const all = await loadAllGares(signal);
  const [w, s, e, n] = bbox;
  return all.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  });
}
