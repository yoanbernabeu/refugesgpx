import { z } from 'zod';
import type { PoiFeature } from './types';
import { bboxToGridKey, readCache, writeCache, TTL } from './cache';

const C2C_BASE = 'https://api.camptocamp.org';
const BBOX_CACHE_PREFIX = 'c2c-bivouacs';
const FICHE_CACHE_PREFIX = 'c2c-fiche';

/** Offset appliqué à l'ID C2C dans la sélection (id négatif).
 * OSM node ids sont bornés à ~12 milliards : `-(c2cId + 1e12)` reste donc
 * disjoint de `-osmId`. */
const C2C_ID_OFFSET = 1e12;

const LocaleSchema = z.looseObject({
  lang: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  access: z.string().nullable().optional(),
  external_resources: z.string().nullable().optional(),
});

const WaypointSchema = z.looseObject({
  document_id: z.number(),
  type: z.string(),
  waypoint_type: z.string(),
  elevation: z.number().nullable().optional(),
  quality: z.string().optional(),
  locales: z.array(LocaleSchema).optional(),
  geometry: z
    .looseObject({
      geom: z.string().optional(),
    })
    .optional(),
});

const ResponseSchema = z.looseObject({
  total: z.number(),
  documents: z.array(z.looseObject({ document_id: z.number() })),
});

export type Bbox = [number, number, number, number]; // [west, south, east, north] lon/lat

const EARTH_R = 20037508.342789244;

function lonLatToMerc(lon: number, lat: number): [number, number] {
  const x = (lon / 180) * EARTH_R;
  const latRad = (lat * Math.PI) / 180;
  const y = (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_R) / Math.PI;
  return [x, y];
}

function mercToLonLat(x: number, y: number): [number, number] {
  const lon = (x / EARTH_R) * 180;
  const latRad = Math.atan(Math.sinh((y / EARTH_R) * Math.PI));
  const lat = (latRad * 180) / Math.PI;
  return [lon, lat];
}

function pickFrLocale(
  locales: z.infer<typeof LocaleSchema>[] | undefined,
): z.infer<typeof LocaleSchema> | undefined {
  if (!locales || locales.length === 0) return undefined;
  return locales.find((l) => l.lang === 'fr') ?? locales[0];
}

/**
 * Récupère les bivouacs Camptocamp dans une bbox (lon/lat).
 * Cache IndexedDB par bbox grid 0,02° (TTL 24 h).
 */
export async function fetchBivouacsC2C(
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<PoiFeature[]> {
  const cacheKey = bboxToGridKey(bbox);
  const cached = await readCache<PoiFeature[]>(BBOX_CACHE_PREFIX, cacheKey, TTL.BBOX);
  if (cached) return cached;

  // Élargir à la bbox grid avant la requête (cohérence avec la clé)
  const [gw, gs, ge, gn] = cacheKey.split(',').map(Number) as Bbox;
  const [xmin, ymin] = lonLatToMerc(gw, gs);
  const [xmax, ymax] = lonLatToMerc(ge, gn);

  const url = new URL(`${C2C_BASE}/waypoints`);
  url.searchParams.set('bbox', `${xmin},${ymin},${xmax},${ymax}`);
  url.searchParams.set('wtyp', 'bivouac');
  url.searchParams.set('limit', '100');
  url.searchParams.set('pl', 'fr');

  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Camptocamp API → ${r.status}`);
  const data = await r.json();
  const parsed = ResponseSchema.parse(data);

  const features: PoiFeature[] = [];
  for (const doc of parsed.documents) {
    const safe = WaypointSchema.safeParse(doc);
    if (!safe.success) continue;
    const wpt = safe.data;
    let coords: [number, number] | null = null;
    try {
      if (wpt.geometry?.geom) {
        const g = JSON.parse(wpt.geometry.geom) as {
          type?: string;
          coordinates?: [number, number];
        };
        if (g.coordinates && g.coordinates.length === 2) {
          coords = mercToLonLat(g.coordinates[0], g.coordinates[1]);
        }
      }
    } catch {
      /* geom illisible : on saute */
    }
    if (!coords) continue;

    const locale = pickFrLocale(wpt.locales);
    const nom = locale?.title ?? `Bivouac ${wpt.document_id}`;
    const alt =
      typeof wpt.elevation === 'number' ? Math.round(wpt.elevation) : undefined;
    const negId = -(wpt.document_id + C2C_ID_OFFSET);
    features.push({
      type: 'Feature',
      id: negId,
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: negId,
        nom,
        type: { id: -2, valeur: 'c2c_bivouac' },
        coord: alt !== undefined ? { alt } : undefined,
        lien: `https://www.camptocamp.org/waypoints/${wpt.document_id}`,
        c2cId: wpt.document_id,
        c2cWaypointType: wpt.waypoint_type,
        c2cSummary: locale?.summary ?? undefined,
        c2cQuality: wpt.quality,
      },
    } as unknown as PoiFeature);
  }

  await writeCache(BBOX_CACHE_PREFIX, cacheKey, features);
  return features;
}

interface C2CFiche {
  title: string;
  summary?: string;
  description?: string;
  access?: string;
  elevation?: number;
  waypoint_type: string;
  lang: string;
  document_id: number;
}

/** Charge la fiche complète d'un bivouac (description + accès). Cache 7 jours. */
export async function fetchBivouacFicheC2C(
  c2cId: number,
  signal?: AbortSignal,
): Promise<C2CFiche | null> {
  const key = String(c2cId);
  const cached = await readCache<C2CFiche | null>(FICHE_CACHE_PREFIX, key, TTL.FICHE);
  if (cached !== null) return cached;

  const url = new URL(`${C2C_BASE}/waypoints/${c2cId}`);
  url.searchParams.set('pl', 'fr');
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`Camptocamp API → ${r.status}`);
  const data = await r.json();
  const safe = WaypointSchema.safeParse(data);
  if (!safe.success) return null;
  const wpt = safe.data;
  const locale = pickFrLocale(wpt.locales);
  const fiche: C2CFiche = {
    title: locale?.title ?? `Bivouac ${wpt.document_id}`,
    summary: locale?.summary ?? undefined,
    description: locale?.description ?? undefined,
    access: locale?.access ?? undefined,
    elevation: typeof wpt.elevation === 'number' ? wpt.elevation : undefined,
    waypoint_type: wpt.waypoint_type,
    lang: locale?.lang ?? 'fr',
    document_id: wpt.document_id,
  };
  await writeCache(FICHE_CACHE_PREFIX, key, fiche);
  return fiche;
}
