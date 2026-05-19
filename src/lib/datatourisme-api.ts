import { z } from 'zod';
import type { PoiFeature } from './types';

/**
 * Charge les hébergements DATAtourisme (regénérés via
 * scripts/fetch-datatourisme.mjs) en lecture statique, fichier par département.
 *
 * Architecture : public/data/datatourisme-lodging/index.json donne la liste
 * des départements avec leur bbox réelle. Pour une bbox de requête donnée,
 * on charge uniquement les fichiers dept dont la bbox intersecte. Une trace
 * en montagne tient typiquement dans 1 à 3 départements, soit quelques
 * centaines de KB gzippés au lieu des 9 MB du dataset complet.
 *
 * Les fichiers sont gardés en cache mémoire après le premier fetch.
 */

const BASE = '/data/datatourisme-lodging';
const INDEX_URL = `${BASE}/index.json`;

/** Offset pour garder les ID disjoints des autres sources annexes.
 * Au-delà de SNCF (qui plafonne à ~1e13). */
const DT_ID_OFFSET = 5e13;

const FeatureSchema = z.looseObject({
  type: z.literal('Feature'),
  geometry: z.looseObject({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).min(2),
  }),
  properties: z.looseObject({
    nom: z.string(),
    sub: z.string(),
    cm: z.string().nullable().optional(),
    web: z.string().nullable().optional(),
    uri: z.string(),
    dept: z.string().optional(),
    reg: z.string().optional(),
  }),
});

const FCSchema = z.looseObject({
  type: z.literal('FeatureCollection'),
  features: z.array(FeatureSchema),
});

const IndexEntrySchema = z.looseObject({
  dept: z.string(),
  count: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  kb: z.number().optional(),
});

const IndexSchema = z.looseObject({
  departments: z.array(IndexEntrySchema),
});

export type Bbox = [number, number, number, number]; // [west, south, east, north]

interface DeptEntry {
  dept: string;
  count: number;
  bbox: Bbox;
}

export const DT_SUBTYPE_LABEL: Record<string, string> = {
  MountainHut: 'Refuge de montagne',
  MountainRefuge: 'Refuge de montagne',
  Gite: 'Gîte',
  GiteEtape: "Gîte d'étape",
  BedAndBreakfast: "Chambre d'hôtes",
  Hostel: 'Auberge de jeunesse',
  YouthHostel: 'Auberge de jeunesse',
  Camping: 'Camping',
  CampingAndCaravanning: 'Camping / caravaning',
  Hotel: 'Hôtel',
  HotelTrade: 'Hôtel',
  HotelRestaurant: 'Hôtel-restaurant',
  HolidayResort: 'Village de vacances',
  RuralAccommodation: 'Hébergement rural',
  Rental: 'Location',
  GuestRoom: 'Chambre',
  CollectiveAccommodation: 'Hébergement collectif',
  LodgingBusiness: 'Hébergement',
  Accommodation: 'Hébergement',
};

export function dtSubtypeLabel(sub: string | undefined | null): string {
  if (!sub) return 'Hébergement';
  return DT_SUBTYPE_LABEL[sub] ?? 'Hébergement';
}

/** Hash FNV-1a 32 bits sur l'URI pour fabriquer un ID numérique stable.
 * Sur ~128k entrées et un espace 2^32, la chance de collision est négligeable.
 * En cas de collision, le pire effet est que deux hébergements partageraient
 * la même case de sélection. */
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function bboxIntersects(a: Bbox, b: Bbox): boolean {
  // a = [w, s, e, n] ; intersect ssi pas séparés sur un axe
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

// ─── Cache ─────────────────────────────────────────────────────────────

let indexCache: DeptEntry[] | null = null;
let indexInflight: Promise<DeptEntry[]> | null = null;
const deptCache = new Map<string, PoiFeature[]>();
const deptInflight = new Map<string, Promise<PoiFeature[]>>();

async function loadIndex(signal?: AbortSignal): Promise<DeptEntry[]> {
  if (indexCache) return indexCache;
  if (indexInflight) return indexInflight;
  indexInflight = (async () => {
    const r = await fetch(INDEX_URL, { signal });
    if (!r.ok) throw new Error(`Datatourisme index → ${r.status}`);
    const raw = await r.json();
    const parsed = IndexSchema.parse(raw);
    const out: DeptEntry[] = parsed.departments.map((d) => ({
      dept: d.dept,
      count: d.count,
      bbox: d.bbox as Bbox,
    }));
    indexCache = out;
    return out;
  })();
  try {
    return await indexInflight;
  } finally {
    indexInflight = null;
  }
}

async function loadDept(dept: string, signal?: AbortSignal): Promise<PoiFeature[]> {
  const cached = deptCache.get(dept);
  if (cached) return cached;
  const inflight = deptInflight.get(dept);
  if (inflight) return inflight;

  const p = (async () => {
    const r = await fetch(`${BASE}/${dept}.geojson`, { signal });
    if (!r.ok) throw new Error(`Datatourisme dept ${dept} → ${r.status}`);
    const raw = await r.json();
    const parsed = FCSchema.parse(raw);
    const out: PoiFeature[] = [];
    for (const f of parsed.features) {
      const [lon, lat] = f.geometry.coordinates;
      const pp = f.properties;
      const id = -(fnv1a32(pp.uri) + DT_ID_OFFSET);
      out.push({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          id,
          nom: pp.nom,
          type: { id: -5, valeur: 'dt_lodging' },
          dtSubtype: pp.sub,
          dtCommune: pp.cm ?? undefined,
          dtWeb: pp.web ?? undefined,
          dtUri: pp.uri,
          dtRegion: pp.reg,
          dtDept: dept,
          lien: pp.web ?? undefined,
        },
      } as unknown as PoiFeature);
    }
    deptCache.set(dept, out);
    return out;
  })();

  deptInflight.set(dept, p);
  try {
    return await p;
  } finally {
    deptInflight.delete(dept);
  }
}

export async function fetchDatatourismeLodging(
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<PoiFeature[]> {
  const index = await loadIndex(signal);
  const needed = index.filter((d) => bboxIntersects(d.bbox, bbox));
  if (needed.length === 0) return [];

  const chunks = await Promise.all(needed.map((d) => loadDept(d.dept, signal)));
  const merged = chunks.flat();

  const [w, s, e, n] = bbox;
  return merged.filter((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  });
}
