import { z } from 'zod';
import type { Comment, PoiFeature } from './types';

const API_BASE = 'https://www.refuges.info/api';

// ─── Schémas Zod ─────────────────────────────────────────────────────

// schéma minimal et tolérant : varie selon detail=simple|complet|fiche
const PoiPropsSchema = z.looseObject({
  id: z.number().optional(),
  nom: z.string(),
  type: z
    .looseObject({
      id: z.number().optional(),
      valeur: z.string(),
      icone: z.string().optional(),
    })
    .optional(),
  coord: z.looseObject({ alt: z.number().optional() }).optional(),
  lien: z.string().optional(),
});

const PoiFeatureSchema = z.looseObject({
  type: z.literal('Feature'),
  id: z.union([z.number(), z.string()]).optional(),
  geometry: z.looseObject({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: PoiPropsSchema,
});

const BboxResponseSchema = z.looseObject({
  type: z.literal('FeatureCollection'),
  features: z.array(PoiFeatureSchema),
});

const CommentSchema = z.looseObject({
  id_commentaire: z.number(),
  id_point: z.number(),
  date_commentaire: z.string(),
  texte_commentaire: z.string(),
  auteur_commentaire: z.string(),
  'photo-vignette': z.string().optional(),
  'photo-reduite': z.string().optional(),
  'photo-originale': z.string().optional(),
});

// ─── Public API ──────────────────────────────────────────────────────

export type Bbox = [number, number, number, number];

export async function fetchPOIsInBbox(
  bbox: Bbox,
  typesCsv: string,
  signal?: AbortSignal,
): Promise<PoiFeature[]> {
  const url = new URL(`${API_BASE}/bbox`);
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('type_points', typesCsv); // ⚠️ "type_points" et non "types_point"
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('detail', 'simple');
  url.searchParams.set('nb_points', 'all');

  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`refuges.info API → ${r.status}`);
  const data = await r.json();
  const parsed = BboxResponseSchema.parse(data);
  return parsed.features as PoiFeature[];
}

export async function fetchPointFiche(
  id: number,
  signal?: AbortSignal,
): Promise<PoiFeature> {
  const url = new URL(`${API_BASE}/point`);
  url.searchParams.set('id', String(id));
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('detail', 'fiche');
  url.searchParams.set('format_texte', 'html');

  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`refuges.info API → ${r.status}`);
  const data = await r.json();
  const parsed = BboxResponseSchema.parse(data);
  const first = parsed.features[0];
  if (!first) throw new Error(`Point ${id} introuvable`);
  return first as PoiFeature;
}

export async function fetchComments(
  id: number,
  signal?: AbortSignal,
): Promise<Comment[]> {
  const url = new URL(`${API_BASE}/commentaires`);
  url.searchParams.set('id_point', String(id));
  url.searchParams.set('format_texte', 'html');

  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`refuges.info API → ${r.status}`);
  const data = (await r.json()) as Record<string, unknown>;
  const items = Object.entries(data)
    .filter(([k]) => /^\d+$/.test(k))
    .map(([, v]) => v);
  const parsed: Comment[] = [];
  for (const it of items) {
    const r = CommentSchema.safeParse(it);
    if (r.success) parsed.push(r.data as Comment);
  }
  return parsed;
}

export function refugesPhotoUrl(relPath: string): string {
  if (!relPath) return '';
  if (relPath.startsWith('http')) return relPath;
  return `https://www.refuges.info${relPath}`;
}
