import type { Feature, Point, LineString, Polygon } from 'geojson';

export interface TrackPoint {
  lon: number;
  lat: number;
  ele?: number;
}

export interface ParsedGpx {
  name: string;
  points: TrackPoint[];
}

export interface PoiProperties {
  id?: number;
  nom: string;
  type?: {
    id?: number;
    valeur: string;
    icone?: string;
  };
  coord?: { alt?: number };
  lien?: string;
  places?: { nom?: string; valeur?: number; nb?: number };
  etat?: { valeur: string };
  [key: string]: unknown;
}

export type PoiFeature = Feature<Point, PoiProperties>;
export type TraceLineFeature = Feature<LineString>;
export type BufferPolygonFeature = Feature<Polygon>;

export interface PoiCandidate {
  feature: PoiFeature;
  distM: number;
  /** id garanti (filtré en amont si manquant) */
  id: number;
}

export interface Comment {
  id_commentaire: number;
  id_point: number;
  date_commentaire: string;
  texte_commentaire: string;
  auteur_commentaire: string;
  'photo-vignette'?: string;
  'photo-reduite'?: string;
  'photo-originale'?: string;
}

export interface FicheData {
  feature: PoiFeature;
  comments: Comment[];
}

export const TYPE_LABELS = {
  refuge: { id: 10, label: 'Refuges gardés', emoji: '🏠', valeurAPI: 'refuge gardé' },
  cabane: { id: 7, label: 'Cabanes non gardées', emoji: '⛺', valeurAPI: 'cabane non gardée' },
  gite: { id: 9, label: "Gîtes d'étape", emoji: '🛏️', valeurAPI: "gîte d'étape" },
  pt_eau: { id: 23, label: "Points d'eau", emoji: '💧', valeurAPI: "point d'eau" },
  pt_passage: { id: 3, label: 'Passages délicats', emoji: '⚠️', valeurAPI: 'passage délicat' },
} as const;

export type TypeKey = keyof typeof TYPE_LABELS;

export const ALL_TYPE_KEYS: TypeKey[] = Object.keys(TYPE_LABELS) as TypeKey[];

const VALEUR_TO_EMOJI: Record<string, string> = Object.fromEntries(
  Object.values(TYPE_LABELS).map((t) => [t.valeurAPI, t.emoji]),
);
// extras hors filtres
VALEUR_TO_EMOJI['bâtiment en montagne'] = '🏚️';
VALEUR_TO_EMOJI['sommet'] = '⛰️';
VALEUR_TO_EMOJI['lac'] = '🏞️';
VALEUR_TO_EMOJI['grotte'] = '🕳️';

export function getEmoji(typeValeur: string | undefined): string {
  if (!typeValeur) return '•';
  return VALEUR_TO_EMOJI[typeValeur] ?? '•';
}

export interface BufferStep {
  meters: number;
  label: string;
}

export const BUFFER_STEPS: BufferStep[] = [
  { meters: 100, label: '100 m' },
  { meters: 200, label: '200 m' },
  { meters: 500, label: '500 m' },
  { meters: 1000, label: '1 km' },
  { meters: 2000, label: '2 km' },
  { meters: 3000, label: '3 km' },
  { meters: 5000, label: '5 km' },
];
